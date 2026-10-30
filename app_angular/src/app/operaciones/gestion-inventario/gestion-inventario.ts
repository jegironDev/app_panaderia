import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, ExistenciaInventario } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BarraNavegacion],
  templateUrl: './gestion-inventario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestionInventario implements OnInit {
  existencias: ExistenciaInventario[] = [];
  texto = '';
  tipo = '';
  cargando = true;
  error = '';

  constructor(private readonly api: ApiService, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.api.existenciasInventario().subscribe({
      next: filas => { this.existencias = filas; this.cargando = false; this.cdr.markForCheck(); },
      error: error => { this.error = error.error?.error || 'No fue posible consultar el inventario.'; this.cargando = false; this.cdr.markForCheck(); },
    });
  }

  get filtradas() {
    const texto = this.texto.trim().toLowerCase();
    return this.existencias.filter(fila => (!texto || String(fila.NOMBRE).toLowerCase().includes(texto)) && (!this.tipo || fila.TIPO === this.tipo));
  }

  disponibilidad(fila: ExistenciaInventario) { return Number(fila.DISPONIBLE ?? (Number(fila.CANTIDAD) - Number(fila.CANTIDAD_RESERVADA))); }
  bajoMinimo(fila: ExistenciaInventario) { return this.disponibilidad(fila) <= Number(fila.EXISTENCIA_MINIMA || 0); }
}
