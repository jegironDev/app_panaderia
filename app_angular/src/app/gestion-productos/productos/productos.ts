import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ProductoAdministracion, UnidadMedida } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({ standalone: true, imports: [CommonModule, FormsModule, BarraNavegacion], templateUrl: './productos.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class Productos implements OnInit {
  productos: ProductoAdministracion[] = []; unidades: UnidadMedida[] = [];
  cargando = false; error = ''; mensaje = '';
  actual: ProductoAdministracion | null = null; nombre = ''; tipo = 'PFI'; identificadorUnidadMedida: number | null = null; precio: number | null = null;
  confirmacion: ProductoAdministracion | null = null; procesando = false; detalle: ProductoAdministracion | null = null;
  constructor(public readonly api: ApiService, private readonly cdr: ChangeDetectorRef) {}
  ngOnInit() { this.cargar(); this.api.unidadesMedida().subscribe({ next: unidades => { this.unidades = unidades; this.identificadorUnidadMedida = unidades.find(unidad => unidad.ABREVIATURA.toUpperCase() === 'UND')?.ID_UNIDAD_MEDIDA ?? null; this.cdr.markForCheck(); }, error: () => { this.error = 'No fue posible cargar las unidades de medida.'; this.cdr.markForCheck(); } }); }
  cargar() { this.cargando = true; this.api.productosAdministracion({ tipo: 'PFI' }).subscribe({ next: productos => { this.productos = productos; this.cargando = false; this.cdr.markForCheck(); }, error: error => { this.error = error.error?.error || 'No fue posible cargar los productos.'; this.cargando = false; this.cdr.markForCheck(); } }); }
  nuevo() { this.actual = null; this.nombre = ''; this.tipo = 'PFI'; this.identificadorUnidadMedida = this.unidades.find(unidad => unidad.ABREVIATURA.toUpperCase() === 'UND')?.ID_UNIDAD_MEDIDA ?? null; this.precio = null; this.error = ''; }
  editar(producto: ProductoAdministracion) { this.actual = producto; this.nombre = producto.NOMBRE; this.tipo = producto.TIPO; this.identificadorUnidadMedida = producto.ID_UNIDAD_MEDIDA; this.precio = Number(producto.PRECIO); this.error = ''; }
  guardar() { const precio = Number(this.precio); if (!this.nombre.trim() || !this.identificadorUnidadMedida || !Number.isFinite(precio) || precio < 0 || (this.tipo === 'PFI' && precio <= 0)) { this.error = this.tipo === 'PFI' ? 'Ingrese nombre, unidad y un precio de venta mayor que cero.' : 'Ingrese nombre, unidad y un precio válido.'; return; } const datos = { nombre: this.nombre, tipo: this.tipo, identificadorUnidadMedida: this.identificadorUnidadMedida, precio }; const solicitud = this.actual ? this.api.editarProducto(this.actual.ID_PRODUCTO, datos) : this.api.crearProducto(datos); this.procesando = true; solicitud.subscribe({ next: () => { this.mensaje = this.actual ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.'; this.procesando = false; this.nuevo(); this.cargar(); this.cdr.markForCheck(); }, error: error => { this.error = error.error?.error || 'No fue posible guardar el producto.'; this.procesando = false; this.cdr.markForCheck(); } }); }
  solicitarEstado(producto: ProductoAdministracion) { this.confirmacion = producto; this.cdr.markForCheck(); }
  cambiarEstado() { if (!this.confirmacion || this.procesando) return; const estado = this.confirmacion.ESTADO === 'A' ? 'I' : 'A'; this.procesando = true; this.api.cambiarEstadoProducto(this.confirmacion.ID_PRODUCTO, estado).subscribe({ next: () => { this.mensaje = estado === 'A' ? 'Producto activado correctamente.' : 'Producto desactivado correctamente.'; this.confirmacion = null; this.procesando = false; this.cargar(); this.cdr.markForCheck(); }, error: error => { this.confirmacion = null; this.error = error.error?.error || 'No fue posible actualizar el producto.'; this.procesando = false; this.cdr.markForCheck(); } }); }
  esVendible(producto: ProductoAdministracion) { return producto.TIPO === 'PFI'; }
}
