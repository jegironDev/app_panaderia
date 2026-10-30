import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Puesto } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({standalone:true, imports:[CommonModule, FormsModule, BarraNavegacion], templateUrl:'./puestos.html', changeDetection:ChangeDetectionStrategy.OnPush})
export class Puestos implements OnInit {
  puestos:Puesto[]=[]; permisos:Array<{ID_PERMISO:number;CODIGO:string;DESCRIPCION:string}>=[]; actual:Puesto|null=null;
  nombre=''; descripcion=''; seleccion:number[]=[]; error=''; exito=''; cargando=false;
  constructor(private api:ApiService, private cdr:ChangeDetectorRef){}
  ngOnInit(){ this.cargar(); }
  cargar(){ this.api.puestos().subscribe({next:p=>{this.puestos=p;this.cdr.markForCheck();},error:e=>this.mostrarError(e)}); this.api.permisos().subscribe({next:p=>{this.permisos=p;this.cdr.markForCheck();},error:e=>this.mostrarError(e)}); }
  editar(p:Puesto){this.actual=p;this.nombre=p.NOMBRE;this.descripcion=p.DESCRIPCION||'';this.api.puestoPorId(p.ID_ROL).subscribe({next:d=>{this.seleccion=d.PERMISOS?.map(x=>x.ID_PERMISO)||[];this.cdr.markForCheck();},error:e=>this.mostrarError(e)});}
  nuevo(){this.actual=null;this.nombre='';this.descripcion='';this.seleccion=[];this.error='';this.exito='';}
  alternar(id:number, marcado:boolean){this.seleccion=marcado?[...new Set([...this.seleccion,id])]:this.seleccion.filter(x=>x!==id);}
  guardar(){if(!this.nombre.trim()){this.error='Ingrese el nombre del puesto.';return;} this.cargando=true; const datos={nombre:this.nombre,descripcion:this.descripcion||null,identificadoresPermisos:this.seleccion}; const peticion=this.actual?this.api.editarPuesto(this.actual.ID_ROL,datos):this.api.crearPuesto(datos);peticion.subscribe({next:()=>{this.exito='Puesto guardado correctamente.';this.cargando=false;this.nuevo();this.cargar();this.cdr.markForCheck();},error:e=>{this.cargando=false;this.mostrarError(e);}});}
  cambiarEstado(p:Puesto){this.api.estadoPuesto(p.ID_ROL,p.ESTADO==='A'?'I':'A').subscribe({next:()=>this.cargar(),error:e=>this.mostrarError(e)});}
  private mostrarError(e:any){this.error=e?.error?.error||'No fue posible completar la operación.';this.cdr.markForCheck();}
}
