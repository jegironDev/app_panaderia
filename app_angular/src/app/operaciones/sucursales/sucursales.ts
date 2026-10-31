import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, SucursalAdministracion } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

export function sucursalEditable(sucursal: SucursalAdministracion): boolean { return sucursal.ESTADO === 'A'; }
export function nuevaSucursalEdicion(): SucursalAdministracion { return { ID_SUCURSAL: 0, NOMBRE: '', ESTADO: 'A' }; }

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, BarraNavegacion],
  templateUrl: './sucursales.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sucursales implements OnInit {
  sucursales: SucursalAdministracion[] = [];
  sucursalEdicion: SucursalAdministracion | null = null;
  sucursalConfirmacion: SucursalAdministracion | null = null;
  nombre = '';
  cargando = false;
  procesando = false;
  error = '';
  mensaje = '';

  constructor(private readonly api: ApiService, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.cargar(); }
  puedeEditar(sucursal: SucursalAdministracion): boolean { return sucursalEditable(sucursal); }

  cargar(): void {
    this.cargando = true; this.error = '';
    this.api.sucursalesAdministracion().subscribe({
      next: sucursales => { this.sucursales = sucursales; this.cargando = false; this.cdr.markForCheck(); },
      error: () => { this.error = 'No fue posible cargar las sucursales.'; this.cargando = false; this.cdr.markForCheck(); },
    });
  }

  editar(sucursal: SucursalAdministracion): void {
    if (!this.puedeEditar(sucursal)) return;
    this.sucursalEdicion = sucursal; this.nombre = sucursal.NOMBRE; this.error = ''; this.mensaje = ''; this.cdr.markForCheck();
  }

  crear(): void {
    this.sucursalEdicion = nuevaSucursalEdicion();
    this.nombre = ''; this.error = ''; this.mensaje = ''; this.cdr.markForCheck();
  }

  cancelarEdicion(): void { this.sucursalEdicion = null; this.nombre = ''; this.cdr.markForCheck(); }

  guardar(): void {
    if (!this.sucursalEdicion || this.procesando) return;
    const nombre = this.nombre.trim();
    if (!nombre) { this.error = 'Ingrese el nombre de la sucursal.'; this.cdr.markForCheck(); return; }
    this.procesando = true; this.error = '';
    const esNueva = this.sucursalEdicion.ID_SUCURSAL === 0;
    const operacion = esNueva ? this.api.crearSucursal(nombre) : this.api.editarSucursal(this.sucursalEdicion.ID_SUCURSAL, nombre);
    operacion.subscribe({
      next: () => { this.procesando = false; this.sucursalEdicion = null; this.nombre = ''; this.mensaje = esNueva ? 'Sucursal creada correctamente.' : 'Sucursal actualizada correctamente.'; this.cargar(); this.cdr.markForCheck(); },
      error: e => { this.procesando = false; this.error = e?.error?.error || (esNueva ? 'No fue posible crear la sucursal.' : 'No fue posible actualizar la sucursal.'); this.cdr.markForCheck(); },
    });
  }

  solicitarInhabilitacion(sucursal: SucursalAdministracion): void { if (this.puedeEditar(sucursal)) { this.sucursalConfirmacion = sucursal; this.error = ''; this.cdr.markForCheck(); } }
  cancelarInhabilitacion(): void { this.sucursalConfirmacion = null; this.cdr.markForCheck(); }

  inhabilitar(): void {
    if (!this.sucursalConfirmacion || this.procesando) return;
    this.procesando = true; this.error = '';
    this.api.inhabilitarSucursal(this.sucursalConfirmacion.ID_SUCURSAL).subscribe({
      next: () => { this.procesando = false; this.sucursalConfirmacion = null; this.mensaje = 'Sucursal inhabilitada correctamente.'; this.cargar(); this.cdr.markForCheck(); },
      error: e => { this.procesando = false; this.error = e?.error?.error || 'No fue posible inhabilitar la sucursal.'; this.cdr.markForCheck(); },
    });
  }
}
