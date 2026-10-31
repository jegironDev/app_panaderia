import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ExistenciaInventario, ProductoDetallado, Abastecimiento } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, BarraNavegacion],
  templateUrl: './gestion-inventario.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestionInventario implements OnInit {
  existencias: ExistenciaInventario[] = []; productos:ProductoDetallado[]=[]; historial:Abastecimiento[]=[];
  identificadorProducto:number|null=null; cantidad:number|null=null; procesandoIngreso=false; existenciaMinima:number|null=null; productoMinimo:ExistenciaInventario|null=null; mensaje='';
  texto = '';
  tipo = '';
  cargando = true;
  error = '';

  constructor(public readonly api: ApiService, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.cargar();
    this.api.productosDetallados().subscribe({next:productos=>{this.productos=productos.filter(producto=>producto.TIPO==='MAT'||producto.TIPO==='INS');this.cdr.markForCheck();},error:error=>this.mostrarError(error)});
  }
  cargar() {
    this.cargando=true;
    this.api.existenciasInventario().subscribe({
      next: filas => { this.existencias = filas; this.cargando = false; this.cdr.markForCheck(); },
      error: error => { this.error = error.error?.error || 'No fue posible consultar el inventario.'; this.cargando = false; this.cdr.markForCheck(); },
    });
    this.api.abastecimientos().subscribe({next:historial=>{this.historial=historial;this.cdr.markForCheck();},error:error=>this.mostrarError(error)});
  }

  get filtradas() {
    const texto = this.texto.trim().toLowerCase();
    return this.existencias.filter(fila => (!texto || String(fila.NOMBRE).toLowerCase().includes(texto)) && (!this.tipo || fila.TIPO === this.tipo));
  }

  disponibilidad(fila: ExistenciaInventario) { return Number(fila.DISPONIBLE ?? (Number(fila.CANTIDAD) - Number(fila.CANTIDAD_RESERVADA))); }
  estado(fila:ExistenciaInventario){const disponible=this.disponibilidad(fila),minimo=Number(fila.EXISTENCIA_MINIMA||0);return disponible<=0?'NO_DISPONIBLE':disponible<minimo?'BAJO':'DISPONIBLE';}
  registrarIngreso(){const cantidad=Number(this.cantidad);const producto=this.productos.find(producto=>producto.ID_PRODUCTO===Number(this.identificadorProducto));if(!producto||!Number.isFinite(cantidad)||cantidad<=0){this.error='Seleccione una materia prima o insumo e ingrese una cantidad positiva.';this.cdr.markForCheck();return;}this.procesandoIngreso=true;this.error='';this.api.registrarAbastecimiento({identificadorProducto:producto.ID_PRODUCTO,identificadorUnidadMedida:producto.ID_UNIDAD_MEDIDA,cantidad}).subscribe({next:()=>{this.mensaje='Ingreso registrado correctamente.';this.cantidad=null;this.procesandoIngreso=false;this.cargar();this.cdr.markForCheck();},error:error=>{this.procesandoIngreso=false;this.mostrarError(error)}});}
  abrirMinimo(fila:ExistenciaInventario){this.productoMinimo=fila;this.existenciaMinima=Number(fila.EXISTENCIA_MINIMA);}
  guardarMinimo(){if(!this.productoMinimo||this.existenciaMinima===null)return;this.api.actualizarMinimoInventario(this.productoMinimo.ID_PRODUCTO,Number(this.existenciaMinima)).subscribe({next:()=>{this.mensaje='Existencia mínima actualizada.';this.productoMinimo=null;this.cargar();},error:error=>this.mostrarError(error)});}
  fechaLocal(valor:string){const fecha=new Date(valor);return Number.isNaN(fecha.getTime())?'—':new Intl.DateTimeFormat('es-GT',{timeZone:'America/Guatemala',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(fecha).replace(',', '');}
  cantidadMovimiento(movimiento:Abastecimiento){const cantidad=Number(movimiento.EXISTENCIA_NUEVA)-Number(movimiento.EXISTENCIA_ANTERIOR);return Number.isInteger(Math.round(cantidad*100))?cantidad.toFixed(2).replace(/\.00$/,''):cantidad.toFixed(2);}
  descripcionMovimiento(movimiento:Abastecimiento){
    const tipo=String(movimiento.TIPO_MOVIMIENTO||'').toLowerCase()==='entrada'?'Entrada':'Salida';
    const codigo=String(movimiento.ORIGEN||'').trim().toUpperCase();
    const origen:Record<string,string>={COMPRA:'Compra',PRODUCCION:'Producción',PEDIDO:'Pedido',AJUSTE:'Ajuste',DESPACHO:'Despacho'};
    return `${tipo} - ${origen[codigo]||this.etiquetaOrigen(codigo)}`;
  }
  private etiquetaOrigen(codigo:string){return codigo?codigo.toLowerCase().replace(/(^|_)([a-záéíóúñ])/g,(_,separador,letra)=>`${separador?' ':''}${letra.toUpperCase()}`):'Sin origen';}
  private mostrarError(error:any){this.error=error?.error?.error||'No fue posible completar la operación.';this.cdr.markForCheck();}
}
