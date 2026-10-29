import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, ProductoDetallado, CrearRecetaRequest, obtenerMensajeErrorHttp } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

interface IngredienteFormulario {
  identificadorProducto: number;
  identificadorUnidadMedida: number;
  cantidad: number;
  abreviaturaUnidad: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BarraNavegacion],
  templateUrl: './crear-receta.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CrearReceta {
  productosTerminados: ProductoDetallado[] = [];
  productosIngredientes: ProductoDetallado[] = [];
  ingredientes: IngredienteFormulario[] = [];
  identificadorProducto: number | null = null;
  nombre = '';
  unidadesProducidas: number | null = null;
  error = '';
  exito = '';
  guardando = false;
  cargandoCatalogos = true;

  constructor(private readonly api: ApiService, private readonly router: Router, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.cargarCatalogos();
  }

  cargarCatalogos() {
    this.api.productosTerminadosDetallados().subscribe({
      next: (productos) => {
        this.productosTerminados = productos;
        this.api.productosDetallados().subscribe({
          next: (productos) => {
            this.productosIngredientes = productos.filter(p => p.TIPO === 'MAT' || p.TIPO === 'INS');
            this.cargandoCatalogos = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.cargandoCatalogos = false;
            this.error = 'No fue posible cargar los productos';
            this.cdr.markForCheck();
          }
        });
      },
      error: () => {
        this.cargandoCatalogos = false;
        this.error = 'No fue posible cargar los productos';
        this.cdr.markForCheck();
      }
    });
  }

  agregarIngrediente() {
    this.ingredientes.push({ identificadorProducto: 0, identificadorUnidadMedida: 0, cantidad: 0, abreviaturaUnidad: '' });
    this.cdr.markForCheck();
  }

  onProductoIngredienteChange(index: number) {
    const ingrediente = this.ingredientes[index];
    const idProducto = Number(ingrediente.identificadorProducto);
    const producto = this.productosIngredientes.find(p => p.ID_PRODUCTO === idProducto);
    if (producto) {
      ingrediente.identificadorProducto = idProducto;
      ingrediente.identificadorUnidadMedida = producto.ID_UNIDAD_MEDIDA;
      ingrediente.abreviaturaUnidad = producto.ABREVIATURA;
    } else {
      ingrediente.identificadorUnidadMedida = 0;
      ingrediente.abreviaturaUnidad = '';
    }
    this.cdr.markForCheck();
  }

  quitarIngrediente(index: number) {
    this.ingredientes.splice(index, 1);
    this.cdr.markForCheck();
  }

  guardarReceta() {
    if (!this.identificadorProducto || !this.nombre || !this.unidadesProducidas || this.unidadesProducidas <= 0) {
      this.error = 'Complete todos los campos obligatorios';
      return;
    }
    if (!Number.isInteger(this.unidadesProducidas)) {
      this.error = 'El rendimiento debe ser un número entero';
      return;
    }
    if (this.ingredientes.length === 0) {
      this.error = 'La receta debe contener al menos un ingrediente';
      return;
    }
    const idsProductos = this.ingredientes.map(i => i.identificadorProducto);
    const unicos = new Set(idsProductos);
    if (unicos.size !== idsProductos.length) {
      this.error = 'No se permiten ingredientes repetidos';
      return;
    }
    for (const ing of this.ingredientes) {
      if (!ing.identificadorProducto || !ing.identificadorUnidadMedida || !ing.cantidad || ing.cantidad <= 0) {
        this.error = 'Complete todos los campos de los ingredientes';
        return;
      }
      const cantidadStr = ing.cantidad.toString();
      if (cantidadStr.includes('.') && cantidadStr.split('.')[1].length > 2) {
        this.error = 'Las cantidades de ingredientes pueden tener máximo dos decimales';
        return;
      }
    }
    const datos: CrearRecetaRequest = {
      identificadorProducto: this.identificadorProducto,
      nombre: this.nombre,
      unidadesProducidas: this.unidadesProducidas,
      ingredientes: this.ingredientes.map(ing => ({
        identificadorProducto: ing.identificadorProducto,
        identificadorUnidadMedida: ing.identificadorUnidadMedida,
        cantidad: ing.cantidad
      }))
    };
    this.guardando = true;
    this.api.crearReceta(datos).subscribe({
      next: (receta) => {
        this.guardando = false;
        this.exito = 'Receta registrada correctamente.';
        this.error = '';
        this.router.navigate(['/recetas', receta.ID_RECETA]);
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.guardando = false;
        this.exito = '';
        this.error = obtenerMensajeErrorHttp(error, 'No fue posible crear la receta.');
        this.cdr.markForCheck();
      }
    });
  }
}
