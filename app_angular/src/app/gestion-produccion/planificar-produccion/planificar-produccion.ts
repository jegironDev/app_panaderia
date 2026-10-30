import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService, OpcionPlanificacionProduccion, PedidoResumen, PlanificacionProduccion, obtenerMensajeErrorHttp } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, BarraNavegacion],
  templateUrl: './planificar-produccion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanificarProduccion implements OnInit, OnDestroy {
  pedidos: PedidoResumen[] = [];
  opciones: OpcionPlanificacionProduccion | null = null;
  plan: PlanificacionProduccion | null = null;
  selecciones: Array<{ identificadorDetallePedido: number; identificadorReceta: number }> = [];
  cargando = true;
  procesando = false;
  error = '';
  exito = '';
  confirmarAutorizacion = false;

  constructor(private readonly api: ApiService, private readonly router: Router, private readonly cdr: ChangeDetectorRef) {}
  ngOnInit() { this.cargarPedidos(); }
  ngOnDestroy() { this.limpiarModal(); }
  cargarPedidos() {
    this.cargando = true; this.error = '';
    this.api.pedidosEnCola().subscribe({
      next: pedidos => { this.pedidos = pedidos; this.cargando = false; this.cdr.markForCheck(); },
      error: error => this.mostrarError(error, 'No fue posible consultar la cola de pedidos.'),
    });
  }
  seleccionarPedido(idPedido: number) {
    if (this.procesando) return;
    this.cargando = true; this.error = ''; this.plan = null; this.opciones = null; this.selecciones = [];
    this.api.opcionesPlanificacionProduccion(idPedido).subscribe({
      next: opciones => { this.opciones = opciones; this.cargando = false; this.cdr.markForCheck(); },
      error: error => this.mostrarError(error, 'No fue posible cargar las recetas compatibles.'),
    });
  }
  agregarSeleccion(idDetalle: number, evento: Event) {
    const idReceta = Number((evento.target as HTMLSelectElement).value);
    if (Number.isInteger(idReceta) && idReceta > 0) this.selecciones = [...this.selecciones, { identificadorDetallePedido: idDetalle, identificadorReceta: idReceta }];
    (evento.target as HTMLSelectElement).value = '';
    this.actualizarPlan();
  }
  eliminarSeleccion(indice: number) { this.selecciones = this.selecciones.filter((_, actual) => actual !== indice); this.actualizarPlan(); }
  puedeAutorizar() { return !!this.plan && !this.plan.disponibilidad.some(disponibilidad => Number(disponibilidad.faltante) > 0) && !this.plan.cobertura.some(cobertura => Number(cobertura.faltante) > 0) && !this.procesando; }
  hayFaltantesCobertura() { return !!this.plan?.cobertura.some(cobertura => Number(cobertura.faltante) > 0); }
  hayFaltantesInventario() { return !!this.plan?.disponibilidad.some(disponibilidad => Number(disponibilidad.faltante) > 0); }
  abrirConfirmacion() { if (this.puedeAutorizar()) { this.confirmarAutorizacion = true; this.cdr.markForCheck(); } }
  cancelarConfirmacion() { this.confirmarAutorizacion = false; this.limpiarModal(); this.cdr.markForCheck(); }
  autorizar() {
    const datos = this.obtenerSolicitud();
    if (!datos || this.procesando) return;
    this.procesando = true; this.error = '';
    this.api.autorizarProduccion(datos).subscribe({
      next: respuesta => { this.procesando = false; this.confirmarAutorizacion = false; this.limpiarModal(); this.exito = `Producción autorizada. Se crearon ${respuesta.producciones.length} producción(es).`; this.cdr.markForCheck(); this.router.navigate(['/producciones/listado']); },
      error: error => { this.confirmarAutorizacion = false; this.limpiarModal(); this.mostrarError(error, 'No fue posible autorizar la producción.'); },
    });
  }
  nombreProducto(id: number) { return this.opciones?.detalles.find(detalle => detalle.identificadorProducto === id)?.producto || `Producto #${id}`; }
  private obtenerSolicitud() {
    if (!this.opciones || !this.selecciones.length) { this.error = 'Agregue al menos una receta para planificar.'; this.cdr.markForCheck(); return null; }
    return { identificadorPedido: this.opciones.identificadorPedido, recetas: this.selecciones };
  }
  recetaSeleccionada(seleccion: { identificadorDetallePedido: number; identificadorReceta: number }) {
    return this.opciones?.detalles.find(detalle => detalle.identificadorDetallePedido === seleccion.identificadorDetallePedido)?.recetas.find(receta => receta.ID_RECETA === seleccion.identificadorReceta);
  }
  productoSeleccionado(seleccion: { identificadorDetallePedido: number; identificadorReceta: number }) { return this.opciones?.detalles.find(detalle => detalle.identificadorDetallePedido === seleccion.identificadorDetallePedido)?.producto || 'Producto'; }
  private actualizarPlan() {
    const datos = this.obtenerSolicitud();
    if (!datos) { this.plan = null; return; }
    this.procesando = true; this.error = '';
    this.api.planificarProduccion(datos).subscribe({ next: plan => { this.plan = plan; this.procesando = false; this.cdr.markForCheck(); }, error: error => this.mostrarError(error, 'No fue posible calcular la planificación.') });
  }
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
