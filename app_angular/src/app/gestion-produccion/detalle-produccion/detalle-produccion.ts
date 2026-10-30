import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, ProduccionDetalle, obtenerMensajeErrorHttp } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, BarraNavegacion],
  templateUrl: './detalle-produccion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleProduccion implements OnInit, OnDestroy {
  produccion: ProduccionDetalle | null = null;
  cargando = true;
  procesando = false;
  error = '';
  exito = '';
  accion: 'iniciar' | 'finalizar' | null = null;
  private identificador = 0;

  constructor(readonly api: ApiService, private readonly route: ActivatedRoute, private readonly router: Router, private readonly cdr: ChangeDetectorRef) {}
  ngOnInit() {
    const valor = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(valor) || valor <= 0) { this.error = 'El identificador de producción no es válido.'; this.cargando = false; this.cdr.markForCheck(); return; }
    this.identificador = valor; this.cargar();
  }
  ngOnDestroy() { this.limpiarModal(); }
  cargar() {
    this.cargando = true; this.error = '';
    this.api.produccionPorId(this.identificador).subscribe({
      next: produccion => { this.produccion = produccion; this.cargando = false; this.cdr.markForCheck(); },
      error: error => this.mostrarError(error, 'No fue posible cargar la producción.'),
    });
  }
  puedeIniciar() { return this.produccion?.ESTADO === 'AUTORIZADA' && this.api.tienePermiso('INICIAR_PRODUCCION'); }
  puedeFinalizar() { return this.produccion?.ESTADO === 'EN_PRODUCCION' && this.api.tienePermiso('CONFIRMAR_PRODUCCION'); }
  esHistorica() { return this.produccion?.ESTADO === 'FINALIZADA' && !(this.produccion.DETALLES?.length); }
  abrirConfirmacion(accion: 'iniciar' | 'finalizar') { if (!this.procesando) { this.accion = accion; this.cdr.markForCheck(); } }
  cancelarConfirmacion() { this.accion = null; this.limpiarModal(); this.cdr.markForCheck(); }
  confirmarAccion() {
    if (!this.accion || this.procesando) return;
    const accion = this.accion; this.procesando = true; this.error = '';
    const solicitud = accion === 'iniciar' ? this.api.iniciarProduccion(this.identificador) : this.api.finalizarProduccion(this.identificador);
    solicitud.subscribe({
      next: () => { this.accion = null; this.limpiarModal(); this.procesando = false; this.exito = accion === 'iniciar' ? 'La producción fue iniciada.' : 'La producción fue finalizada e inventario actualizado.'; this.cargar(); this.cdr.markForCheck(); },
      error: error => { this.accion = null; this.limpiarModal(); this.mostrarError(error, 'No fue posible completar la operación.'); },
    });
  }
  etiquetaEstado(estado: string) { return estado.replaceAll('_', ' '); }
  private mostrarError(error: any, alternativa: string) {
    this.cargando = false; this.procesando = false;
    if (error?.status === 401) { this.api.limpiarSesion(); this.router.navigate(['/ingresar']); return; }
    this.error = obtenerMensajeErrorHttp(error, alternativa); this.cdr.markForCheck();
  }
  private limpiarModal() {
    if (typeof document === 'undefined') return;
    document.body.classList.remove('modal-open');
    document.querySelectorAll('body > .modal-backdrop').forEach(elemento => elemento.remove());
  }
}
