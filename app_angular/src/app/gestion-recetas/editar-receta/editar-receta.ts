import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { ApiService, ProductoDetallado, EditarRecetaRequest, obtenerMensajeErrorHttp } from '../../api.service';
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
  templateUrl: './editar-receta.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditarReceta implements OnInit {
  idReceta: number = 0;
  productosTerminados: ProductoDetallado[] = [];
  productosIngredientes: ProductoDetallado[] = [];
  ingredientes: IngredienteFormulario[] = [];
  identificadorProducto: number | null = null;
  nombre = '';
  unidadesProducidas: number | null = null;
  error = '';
  exito = '';
  guardando = false;
  cargando = true;
  cargandoCatalogos = true;

  constructor(private readonly api: ApiService, private readonly router: Router, private readonly route: ActivatedRoute, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.idReceta = Number(id);
      this.cargarReceta();
    } else {
      this.error = 'Identificador de receta no válido';
      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  cargarReceta() {
    this.api.recetaPorId(this.idReceta).subscribe({
      next: (receta) => {
        this.identificadorProducto = receta.ID_PRODUCTO;
        this.nombre = receta.NOMBRE;
        this.unidadesProducidas = receta.UNIDADES_PRODUCIDAS;
        this.ingredientes = receta.INGREDIENTES.map(ing => ({
          identificadorProducto: ing.ID_PRODUCTO,
          identificadorUnidadMedida: ing.ID_UNIDAD_MEDIDA,
          cantidad: ing.CANTIDAD,
          abreviaturaUnidad: ing.ABREVIATURA
        }));
        this.cargarCatalogos();
      },
      error: (error) => {
        this.cargando = false;
        if (error.status === 401) {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('permisos');
          sessionStorage.removeItem('identidad');
          this.router.navigate(['/ingresar']);
        } else {
          this.error = obtenerMensajeErrorHttp(error, 'No fue posible cargar la receta.');
        }
        this.cdr.markForCheck();
      }
    });
  }

  cargarCatalogos() {
    this.api.productosTerminadosDetallados().subscribe({
      next: (productos) => {
        this.productosTerminados = productos;
        this.api.productosDetallados().subscribe({
          next: (productos) => {
            this.productosIngredientes = productos.filter(p => p.TIPO === 'MAT' || p.TIPO === 'INS');
            this.ingredientes.forEach((_, indice) => this.onProductoIngredienteChange(indice));
            this.cargandoCatalogos = false;
            this.cargando = false;
            this.cdr.markForCheck();
          },
          error: () => {
            this.cargandoCatalogos = false;
            this.cargando = false;
            this.error = 'No fue posible cargar los productos';
            this.cdr.markForCheck();
          }
        });
      },
      error: () => {
        this.cargando = false;
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
    const datos: EditarRecetaRequest = {
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
    this.api.editarReceta(this.idReceta, datos).subscribe({
      next: () => {
        this.guardando = false;
        this.exito = 'Receta actualizada correctamente.';
        this.error = '';
        this.router.navigate(['/recetas', this.idReceta]);
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.guardando = false;
        this.exito = '';
        if (error.status === 409) {
          this.error = 'Esta receta no se puede editar porque ya fue utilizada en producción.';
        } else {
          this.error = obtenerMensajeErrorHttp(error, 'No fue posible actualizar la receta.');
        }
        this.cdr.markForCheck();
      }
    });
  }
}
