import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService, CrearUsuarioRequest, Sucursal } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink, BarraNavegacion],
  templateUrl: './crear-usuario.html'
})
export class CrearUsuario {
  contrasena = '';
  primerNombre = '';
  segundoNombre: string | null = null;
  primerApellido = '';
  segundoApellido: string | null = null;
  puesto: string | null = null;
  tipo: 'ADMIN' | 'OPERATIVO' | 'ESTANDAR' = 'ESTANDAR';
  identificadorSucursal: number | null = null;
  sucursales: Sucursal[] = [];
  error = '';
  exito = false;
  usuarioGenerado = '';
  cargandoSucursales = false;

  readonly tiposUsuario = ['ADMIN', 'OPERATIVO', 'ESTANDAR'];

  constructor(private api: ApiService, private router: Router, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.cargarSucursales();
  }

  cargarSucursales() {
    this.cargandoSucursales = true;
    this.api.sucursales().subscribe({
      next: (sucursales) => {
        this.sucursales = sucursales;
        this.cargandoSucursales = false;
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.cargandoSucursales = false;
        this.error = 'No fue posible cargar las sucursales';
        this.cdr.markForCheck();
      }
    });
  }

  normalizarCampo(valor: any, campo: string) {
    if (valor === '' || valor === null || valor === undefined) {
      if (campo === 'segundoNombre') this.segundoNombre = null;
      if (campo === 'segundoApellido') this.segundoApellido = null;
      if (campo === 'puesto') this.puesto = null;
    }
  }

  onTipoChange() {
    if (this.tipo === 'ADMIN' || this.tipo === 'OPERATIVO') {
      this.identificadorSucursal = null;
    }
  }

  guardarUsuario() {
    if (!this.contrasena || !this.primerNombre || !this.primerApellido || !this.tipo) {
      this.error = 'Todos los campos obligatorios deben completarse';
      return;
    }

    if (this.tipo === 'ESTANDAR' && !this.identificadorSucursal) {
      this.error = 'Para usuarios ESTANDAR debe seleccionar una sucursal';
      return;
    }

    if (this.cargandoSucursales && this.tipo === 'ESTANDAR') {
      this.error = 'Espere a que se carguen las sucursales';
      return;
    }

    const datos: CrearUsuarioRequest = {
      contrasena: this.contrasena,
      primerNombre: this.primerNombre,
      primerApellido: this.primerApellido,
      tipo: this.tipo
    };

    if (this.segundoNombre !== null && this.segundoNombre !== '') {
      datos.segundoNombre = this.segundoNombre;
    }

    if (this.segundoApellido !== null && this.segundoApellido !== '') {
      datos.segundoApellido = this.segundoApellido;
    }

    if (this.puesto !== null && this.puesto !== '') {
      datos.puesto = this.puesto;
    }

    if (this.tipo === 'ESTANDAR' && this.identificadorSucursal !== null) {
      datos.identificadorSucursal = this.identificadorSucursal;
    } else {
      datos.identificadorSucursal = null;
    }

    this.api.crearUsuario(datos).subscribe({
      next: (usuario) => {
        this.usuarioGenerado = usuario.USUARIO;
        this.exito = true;
        this.error = '';
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.exito = false;
        if (e.status === 401) {
          this.error = 'Sesión expirada. Ingrese nuevamente.';
          sessionStorage.removeItem('token');
          this.router.navigate(['/ingresar']);
        } else if (e.status === 403) {
          this.error = 'No tiene permisos para realizar esta operación';
        } else if (e.status === 404) {
          this.error = 'Sucursal no encontrada o inactiva';
        } else if (e.status === 409) {
          this.error = 'El usuario ya existe';
        } else {
          this.error = e.error?.error || 'No fue posible crear el usuario';
        }
        this.cdr.markForCheck();
      }
    });
  }

  irAlListado() {
    this.router.navigate(['/usuarios']);
  }
}
