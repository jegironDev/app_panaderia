import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, DetallePedido as DatosPedido, obtenerMensajeErrorHttp } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

export function puedeAutorizarEstado(estado: string | undefined): boolean { return estado === 'PENDIENTE'; }

export function puedeAutorizarPedido(estado: string | undefined, tienePermisoAutorizacion: boolean): boolean {
  return puedeAutorizarEstado(estado) && tienePermisoAutorizacion;
}

export function puedeSolicitarCancelacionPedido(
  identificadorSucursalSesion: number | null,
  identificadorSucursalPedido: number | undefined,
  tienePermisoSolicitud: boolean,
): boolean {
  return tienePermisoSolicitud
    && identificadorSucursalSesion !== null
    && identificadorSucursalSesion === identificadorSucursalPedido;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BarraNavegacion],
  templateUrl: './detalle-pedido.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetallePedido implements OnInit {
  pedido: DatosPedido | null = null;
  cargando = true;
  procesando = false;
  motivo = '';
  error = '';
  exito = '';
  private identificadorPedido = 0;

  constructor(private readonly ruta: ActivatedRoute, private readonly api: ApiService, private readonly router: Router, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.identificadorPedido = Number(this.ruta.snapshot.paramMap.get('id'));
    if (!Number.isInteger(this.identificadorPedido) || this.identificadorPedido <= 0) { this.error = 'El identificador de pedido no es válido.'; this.cargando = false; return; }
    this.cargarPedido();
  }

  cargarPedido() {
    this.api.pedidoPorId(this.identificadorPedido).subscribe({
      next: pedido => { this.pedido = pedido; this.cargando = false; this.cdr.markForCheck(); },
      error: error => this.mostrarError(error, 'No fue posible consultar el pedido.'),
    });
  }

  puedeAutorizar(): boolean {
    return puedeAutorizarPedido(this.pedido?.ESTADO, this.api.tienePermiso('AUTORIZAR_PRODUCCION'));
  }

  puedeSolicitarCancelacion(): boolean {
    return puedeSolicitarCancelacionPedido(
      this.api.obtenerIdentificadorSucursalSesion(),
      this.pedido?.ID_SUCURSAL,
      this.api.tienePermiso('SOLICITAR_CANCELACION_PEDIDOS'),
    );
  }

  solicitarCancelacion() {
    if (!this.motivo.trim()) { this.error = 'Ingrese el motivo de cancelación.'; return; }
    this.procesando = true; this.error = ''; this.exito = ''; this.cdr.markForCheck();
    this.api.solicitarCancelacion(this.identificadorPedido, this.motivo.trim()).subscribe({
      next: () => { this.procesando = false; this.motivo = ''; this.exito = 'Solicitud de cancelación registrada.'; this.cdr.markForCheck(); },
      error: error => { this.procesando = false; this.mostrarError(error, 'No fue posible registrar la solicitud.'); },
    });
  }

  private mostrarError(error: any, mensaje: string) {
    this.cargando = false;
    if (error.status === 401) { sessionStorage.removeItem('token'); this.router.navigate(['/ingresar']); return; }
    this.error = obtenerMensajeErrorHttp(error, mensaje);
    this.cdr.markForCheck();
  }
}
