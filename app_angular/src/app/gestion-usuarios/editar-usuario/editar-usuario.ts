import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, EditarUsuarioRequest, Puesto, Sucursal, TipoUsuario, Usuario } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, BarraNavegacion],
  templateUrl: './editar-usuario.html',
})
export class EditarUsuario implements OnInit {
  idUsuario = 0;
  usuario = '';
  primerNombre = '';
  segundoNombre: string | null = null;
  primerApellido = '';
  segundoApellido: string | null = null;
  identificadorPuesto: number | null = null;
  puestos: Puesto[] = [];
  tipo: TipoUsuario = 'ESTANDAR';
  identificadorSucursal: number | null = null;
  sucursales: Sucursal[] = [];
  error = '';
  exito = false;
  cargando = true;
  cargandoSucursales = true;
  hayCambios = false;
  mostrarConfirmacionSalida = false;
  private estadoGuardado = '';

  readonly tiposUsuario: TipoUsuario[] = ['ADMIN', 'OPERATIVO', 'ESTANDAR'];

  constructor(
    private readonly api: ApiService,
    private readonly router: Router,
    private readonly ruta: ActivatedRoute,
    private readonly detectorCambios: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    const identificador = Number(this.ruta.snapshot.paramMap.get('id'));
    if (!Number.isInteger(identificador) || identificador <= 0) {
      this.error = 'Identificador de usuario no válido';
      this.cargando = false;
      return;
    }
    this.idUsuario = identificador;
    this.cargarSucursales();
    this.api.puestosAsignables().subscribe({ next: puestos => { this.puestos = puestos; this.asignarPuestoDesdeTexto(); this.detectorCambios.markForCheck(); }, error: () => { this.error = 'No fue posible cargar los puestos.'; this.detectorCambios.markForCheck(); } });
    this.cargarUsuario();
  }

  cargarUsuario() {
    this.api.usuarioPorId(this.idUsuario).subscribe({
      next: usuario => {
        this.asignarUsuario(usuario);
        this.guardarEstadoActual();
        this.cargando = false;
        this.detectorCambios.markForCheck();
      },
      error: error => {
        this.cargando = false;
        this.mostrarErrorCarga(error, 'No fue posible cargar el usuario');
        this.detectorCambios.markForCheck();
      },
    });
  }

  cargarSucursales() {
    this.api.sucursales().subscribe({
      next: sucursales => {
        this.sucursales = sucursales;
        this.cargandoSucursales = false;
        this.detectorCambios.markForCheck();
      },
      error: error => {
        this.cargandoSucursales = false;
        this.mostrarErrorCarga(error, 'No fue posible cargar las sucursales');
        this.detectorCambios.markForCheck();
      },
    });
  }

  cambiarTipo() {
    if (this.tipo !== 'ESTANDAR') this.identificadorSucursal = null;
  }

  cambiarPuesto() {
    const puesto = this.puestos.find(item => item.ID_ROL === this.identificadorPuesto);
    if (!puesto) return;
    this.tipo = puesto.NOMBRE === 'ADMINISTRADOR' ? 'ADMIN' : puesto.NOMBRE === 'USUARIO_SUCURSAL' ? 'ESTANDAR' : 'OPERATIVO';
    this.cambiarTipo();
  }

  actualizarUsuario() {
    this.error = '';
    this.exito = false;
    if (!this.primerNombre.trim() || !this.primerApellido.trim()) {
      this.error = 'Primer nombre y primer apellido son obligatorios';
      return;
    }
    if (this.tipo === 'ESTANDAR' && !this.identificadorSucursal) {
      this.error = 'Para usuarios ESTANDAR debe seleccionar una sucursal';
      return;
    }

    const datos: EditarUsuarioRequest = {
      primerNombre: this.primerNombre,
      segundoNombre: this.normalizarOpcional(this.segundoNombre),
      primerApellido: this.primerApellido,
      segundoApellido: this.normalizarOpcional(this.segundoApellido),
      identificadorPuesto: this.identificadorPuesto,
      tipo: this.tipo,
      identificadorSucursal: this.tipo === 'ESTANDAR' ? this.identificadorSucursal : null,
    };

    this.api.editarUsuario(this.idUsuario, datos).subscribe({
      next: usuario => {
        this.asignarUsuario(usuario);
        this.guardarEstadoActual();
        this.exito = true;
        this.detectorCambios.markForCheck();
      },
      error: error => {
        this.mostrarErrorCarga(error, 'No fue posible actualizar el usuario');
        this.detectorCambios.markForCheck();
      },
    });
  }

  private asignarUsuario(usuario: Usuario) {
    this.usuario = usuario.USUARIO;
    this.primerNombre = usuario.PRIMER_NOMBRE;
    this.segundoNombre = usuario.SEGUNDO_NOMBRE;
    this.primerApellido = usuario.PRIMER_APELLIDO;
    this.segundoApellido = usuario.SEGUNDO_APELLIDO;
    this.puestoTexto = usuario.PUESTO;
    this.asignarPuestoDesdeTexto();
    this.tipo = usuario.TIPO;
    this.identificadorSucursal = usuario.ID_SUCURSAL;
  }

  marcarCambios() {
    this.hayCambios = this.serializarFormulario() !== this.estadoGuardado;
    this.exito = false;
  }

  solicitarSalida() {
    if (this.hayCambios) {
      this.mostrarConfirmacionSalida = true;
      this.detectorCambios.markForCheck();
      return;
    }
    this.router.navigate(['/usuarios']);
  }

  cancelarSalida() {
    this.mostrarConfirmacionSalida = false;
    this.detectorCambios.markForCheck();
  }

  confirmarSalida() {
    this.hayCambios = false;
    this.mostrarConfirmacionSalida = false;
    this.router.navigate(['/usuarios']);
  }

  @HostListener('window:beforeunload', ['$event'])
  advertirSalidaNavegador(evento: BeforeUnloadEvent) {
    if (!this.hayCambios) return;
    evento.preventDefault();
    evento.returnValue = true;
  }

  private guardarEstadoActual() {
    this.estadoGuardado = this.serializarFormulario();
    this.hayCambios = false;
  }

  private serializarFormulario() {
    return JSON.stringify({
      primerNombre: this.primerNombre.trim(), segundoNombre: this.normalizarOpcional(this.segundoNombre),
      primerApellido: this.primerApellido.trim(), segundoApellido: this.normalizarOpcional(this.segundoApellido),
      identificadorPuesto: this.identificadorPuesto, tipo: this.tipo,
      identificadorSucursal: this.tipo === 'ESTANDAR' ? this.identificadorSucursal : null,
    });
  }

  private puestoTexto: string | null = null;
  private asignarPuestoDesdeTexto() {
    if (this.puestoTexto && this.puestos.length) { this.identificadorPuesto = this.puestos.find(puesto => puesto.NOMBRE === this.puestoTexto)?.ID_ROL ?? null; this.cambiarPuesto(); }
  }

  private normalizarOpcional(valor: string | null) {
    const texto = valor?.trim();
    return texto ? texto : null;
  }

  private mostrarErrorCarga(error: any, mensajePredeterminado: string) {
    if (error.status === 401) {
      sessionStorage.removeItem('token');
      this.router.navigate(['/ingresar']);
      return;
    }
    this.error = error.status === 403
      ? 'No tiene permisos para realizar esta operación'
      : error.error?.error || mensajePredeterminado;
  }
}
