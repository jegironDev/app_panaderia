import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService, ProductoAdministracion, UnidadMedida } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({ standalone:true, imports:[CommonModule, FormsModule, BarraNavegacion], templateUrl:'./materias-primas.html', changeDetection:ChangeDetectionStrategy.OnPush })
export class MateriasPrimas implements OnInit {
  productos: ProductoAdministracion[]=[]; unidades:UnidadMedida[]=[]; actual:ProductoAdministracion|null=null;
  nombre=''; identificadorUnidadMedida:number|null=null; tipo:'MAT'|'INS'='MAT'; error=''; mensaje=''; procesando=false;
  constructor(private api:ApiService,private cdr:ChangeDetectorRef){}
  ngOnInit(){this.cargar();this.api.unidadesMedida().subscribe({next:x=>{this.unidades=x;this.cdr.markForCheck();},error:e=>this.mostrarError(e)});}
  cargar(){forkJoin([this.api.productosAdministracion({tipo:'MAT'}),this.api.productosAdministracion({tipo:'INS'})]).subscribe({next:([materias,insumos])=>{this.productos=[...materias,...insumos].sort((a,b)=>a.NOMBRE.localeCompare(b.NOMBRE));this.cdr.markForCheck();},error:e=>this.mostrarError(e)});}
  editar(producto:ProductoAdministracion){this.actual=producto;this.nombre=producto.NOMBRE;this.identificadorUnidadMedida=producto.ID_UNIDAD_MEDIDA;this.tipo=producto.TIPO as 'MAT'|'INS';this.error='';this.cdr.markForCheck();}
  nuevo(){this.actual=null;this.nombre='';this.identificadorUnidadMedida=null;this.tipo='MAT';this.error='';this.cdr.markForCheck();}
  guardar(){
    if(!this.nombre.trim()||!this.identificadorUnidadMedida){this.error='Ingrese el nombre y seleccione la unidad de medida.';this.cdr.markForCheck();return;}
    const datos={nombre:this.nombre,tipo:this.tipo,identificadorUnidadMedida:Number(this.identificadorUnidadMedida),precio:0};
    this.procesando=true;
    const solicitud=this.actual?this.api.editarProducto(this.actual.ID_PRODUCTO,datos):this.api.crearProducto(datos);
    solicitud.subscribe({
      next:()=>{this.mensaje='Producto guardado correctamente.';this.procesando=false;this.nuevo();this.cargar();},
      error:e=>{this.procesando=false;this.mostrarError(e);},
    });
  }
  cambiarEstado(producto:ProductoAdministracion){this.api.cambiarEstadoProducto(producto.ID_PRODUCTO,producto.ESTADO==='A'?'I':'A').subscribe({next:()=>{this.mensaje='Estado actualizado correctamente.';this.cargar();},error:e=>this.mostrarError(e)});}
  private mostrarError(e:any){this.error=e?.error?.error||'No fue posible completar la operación.';this.cdr.markForCheck();}
}
