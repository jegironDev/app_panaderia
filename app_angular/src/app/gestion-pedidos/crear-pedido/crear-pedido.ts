import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, CrearPedidoRequest, Jornada, obtenerMensajeErrorHttp, Producto } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

interface LineaPedido { identificadorProducto: number | null; cantidad: number | null; }

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BarraNavegacion],
  templateUrl: './crear-pedido.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrearPedido implements OnInit {
  jornadas: Jornada[] = [];
  productos: Producto[] = [];
  identificadorJornada: number | null = null;
  observaciones = '';
  lineas: LineaPedido[] = [{ identificadorProducto: null, cantidad: 1 }];
  cargandoCatalogos = true;
  guardando = false;
  error = '';
  exito = '';

  constructor(private readonly api: ApiService, private readonly router: Router, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.api.jornadasPedido().subscribe({ next: jornadas => { this.jornadas = jornadas; this.finalizarCargaCatalogos(); }, error: error => this.mostrarError(error) });
    this.api.productosTerminados().subscribe({ next: productos => { this.productos = productos; this.finalizarCargaCatalogos(); }, error: error => this.mostrarError(error) });
  }

  agregarLinea() { this.lineas = [...this.lineas, { identificadorProducto: null, cantidad: 1 }]; }
  quitarLinea(indice: number) { if (this.lineas.length > 1) this.lineas = this.lineas.filter((_, posicion) => posicion !== indice); }
  cancelar() { this.router.navigate(['/pedidos']); }

  guardar() {
    this.error = ''; this.exito = '';
    if (!this.identificadorJornada) { this.error = 'Selecciona una jornada para continuar.'; return; }
    const detalles = this.lineas.map(linea => ({ identificadorProducto: Number(linea.identificadorProducto), cantidad: Number(linea.cantidad) }));
    if (detalles.some(detalle => !Number.isInteger(detalle.identificadorProducto) || detalle.identificadorProducto <= 0)) {
      this.error = 'Selecciona un producto en todas las líneas.'; return;
    }
    if (detalles.some(detalle => !Number.isInteger(detalle.cantidad) || detalle.cantidad <= 0)) { this.error = 'Ingresa una cantidad mayor que cero, sin decimales.'; return; }
    if (new Set(detalles.map(detalle => detalle.identificadorProducto)).size !== detalles.length) { this.error = 'Este producto ya está agregado al pedido.'; return; }
    const datos: CrearPedidoRequest = { identificadorJornada: this.identificadorJornada, observaciones: this.observaciones.trim() || null, detalles };
    this.guardando = true; this.cdr.markForCheck();
    this.api.crearPedido(datos).subscribe({
      next: () => { this.router.navigate(['/pedidos']); },
      error: error => { this.guardando = false; this.mostrarError(error); },
    });
  }

  private finalizarCargaCatalogos() { if (this.jornadas.length && this.productos.length) this.cargandoCatalogos = false; this.cdr.markForCheck(); }
  obtenerPrecio(linea: LineaPedido): number { return this.productos.find(producto => producto.ID_PRODUCTO === linea.identificadorProducto)?.PRECIO || 0; }
  obtenerSubtotal(linea: LineaPedido): number { return this.obtenerPrecio(linea) * (Number(linea.cantidad) || 0); }
  get totalEstimado(): number { return this.lineas.reduce((total, linea) => total + this.obtenerSubtotal(linea), 0); }
  private mostrarError(error: any) {
    this.cargandoCatalogos = false;
    if (error.status === 401) { sessionStorage.removeItem('token'); this.router.navigate(['/ingresar']); return; }
    this.error = obtenerMensajeErrorHttp(error, 'No fue posible completar la operación.');
    this.cdr.markForCheck();
  }
}
