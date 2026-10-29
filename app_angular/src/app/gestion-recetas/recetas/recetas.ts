import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService, RecetaResumen, obtenerMensajeErrorHttp } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, BarraNavegacion],
  templateUrl: './recetas.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Recetas implements OnInit {
  recetas: RecetaResumen[] = [];
  cargando = true;
  error = '';
  exito = '';
  idRecetaDesactivar: number | null = null;
  mostrarDialogoConfirmacion = false;
  accionPendiente: 'activar' | 'desactivar' | null = null;
  idRecetaConfirmacion: number | null = null;
  procesandoCambioEstado = false;

  constructor(private readonly api: ApiService, private readonly router: Router, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.api.recetas().subscribe({
      next: (recetas) => {
        this.recetas = recetas;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.cargando = false;
        this.error = obtenerMensajeErrorHttp(error, 'No fue posible cargar las recetas. Intenta nuevamente.');
        this.cdr.markForCheck();
      }
    });
  }

  confirmarCambioEstado(id: number, estadoActual: string) {
    this.idRecetaConfirmacion = id;
    this.accionPendiente = estadoActual === 'A' ? 'desactivar' : 'activar';
    this.mostrarDialogoConfirmacion = true;
    this.cdr.markForCheck();
  }

  cancelarConfirmacion() {
    this.mostrarDialogoConfirmacion = false;
    this.accionPendiente = null;
    this.idRecetaConfirmacion = null;
    this.cdr.markForCheck();
  }

  ejecutarAccionPendiente() {
    if (!this.idRecetaConfirmacion || !this.accionPendiente || this.procesandoCambioEstado) return;
    const estado = this.accionPendiente === 'desactivar' ? 'I' : 'A';
    this.procesandoCambioEstado = true;
    this.cambiarEstadoReceta(this.idRecetaConfirmacion, estado);
    this.cdr.markForCheck();
  }

  cambiarEstadoReceta(id: number, estado: string) {
    this.api.cambiarEstadoReceta(id, estado).subscribe({
      next: () => {
        this.exito = estado === 'I' ? 'Receta desactivada correctamente.' : 'Receta activada correctamente.';
        this.error = '';
        this.idRecetaDesactivar = null;
        this.procesandoCambioEstado = false;
        this.cancelarConfirmacion();
        this.ngOnInit();
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.exito = '';
        this.procesandoCambioEstado = false;
        this.error = obtenerMensajeErrorHttp(error, 'No fue posible cambiar el estado de la receta.');
        this.cdr.markForCheck();
      }
    });
  }

  obtenerEstado(estado: string): string {
    return estado === 'A' ? 'Activa' : 'Inactiva';
  }
}
