import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, ProduccionResumen, obtenerMensajeErrorHttp } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BarraNavegacion],
  templateUrl: './producciones.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Producciones implements OnInit {
  producciones: ProduccionResumen[] = [];
  estado = '';
  identificadorPedido: number | null = null;
  cargando = true;
  error = '';
  porPedido: Array<{ identificadorPedido: number; sucursal: string | null; estadoPedido: string | null; estadoVisual: string; producciones: ProduccionResumen[] }> = [];
  sinPedido: ProduccionResumen[] = [];
  readonly estados = ['AUTORIZADA', 'EN_PRODUCCION', 'FINALIZADA', 'CANCELADA'];

  constructor(readonly api: ApiService, private readonly router: Router, private readonly cdr: ChangeDetectorRef) {}
  ngOnInit() { this.cargar(); }
  cargar() {
    this.cargando = true; this.error = '';
    const identificadorPedido = Number(this.identificadorPedido);
    this.api.producciones({ estado: this.estado || undefined, identificadorPedido: Number.isInteger(identificadorPedido) && identificadorPedido > 0 ? identificadorPedido : undefined }).subscribe({
      next: producciones => { this.producciones = producciones; this.porPedido = this.agruparPorPedido(producciones); this.sinPedido = producciones.filter(produccion => !produccion.ID_PEDIDO); this.cargando = false; this.cdr.markForCheck(); },
      error: error => this.mostrarError(error),
    });
  }
  puedePlanificar() { return this.api.tienePermiso('AUTORIZAR_PRODUCCION'); }
  etiquetaEstado(estado: string) { return estado.replaceAll('_', ' '); }
  claseEstado(estado: string) {
    if (estado === 'FINALIZADA') return 'text-bg-success';
    if (estado === 'EN_PRODUCCION') return 'text-bg-warning';
    if (estado === 'CANCELADA' || estado === 'ANULADA') return 'text-bg-danger';
    return 'text-bg-secondary';
  }
  private agruparPorPedido(producciones: ProduccionResumen[]) {
    const grupos = new Map<number, { identificadorPedido: number; sucursal: string | null; estadoPedido: string | null; estadoVisual: string; producciones: ProduccionResumen[] }>();
    for (const produccion of producciones) {
      if (!produccion.ID_PEDIDO) continue;
      const grupo = grupos.get(produccion.ID_PEDIDO) || { identificadorPedido: produccion.ID_PEDIDO, sucursal: produccion.SUCURSAL || null, estadoPedido: produccion.ESTADO_PEDIDO || null, estadoVisual: '', producciones: [] };
      grupo.producciones.push(produccion); grupos.set(produccion.ID_PEDIDO, grupo);
    }
    return [...grupos.values()].map(grupo => ({ ...grupo, estadoVisual: this.obtenerEstadoVisual(grupo.producciones) }));
  }
  private obtenerEstadoVisual(producciones: ProduccionResumen[]) {
    const estados = new Set(producciones.map(produccion => produccion.ESTADO));
    if (estados.size === 1) return this.etiquetaEstado(producciones[0].ESTADO);
    if (estados.has('EN_PRODUCCION') || estados.has('AUTORIZADA')) return 'Parcial / En proceso';
    return 'Estados mixtos';
  }
  private mostrarError(error: any) {
    this.cargando = false;
    if (error?.status === 401) { this.api.limpiarSesion(); this.router.navigate(['/ingresar']); return; }
    this.error = obtenerMensajeErrorHttp(error, 'No fue posible cargar las producciones.');
    this.cdr.markForCheck();
  }
}
