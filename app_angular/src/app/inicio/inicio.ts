import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BarraNavegacion } from '../compartidos/componentes/barra-navegacion/barra-navegacion';
import { ApiService, ResumenDashboard } from '../api.service';

@Component({ standalone: true, imports: [CommonModule, FormsModule, BarraNavegacion], templateUrl: './inicio.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class Inicio implements OnInit {
  resumen: ResumenDashboard | null = null;
  limiteSemanal=3; limiteMensual=3; readonly limites=[1,2,3,4,5,6,7,8,9,10];
  constructor(private readonly api: ApiService, private readonly cdr?: ChangeDetectorRef) {}
  ngOnInit() { this.cargarResumen(); }
  cargarResumen() { if (this.api.tienePermiso('VER_REPORTES')) this.api.dashboard(this.limiteSemanal,this.limiteMensual).subscribe({ next: resumen => { this.resumen = resumen; this.cdr?.markForCheck(); } }); }
  obtenerSaludo(): string {
    const nombre = this.api.obtenerNombreSesion();
    return nombre ? `Bienvenido/a ${nombre}` : 'Bienvenido/a';
  }
  mostrarUsuarios(): boolean { return this.api.tieneAlgunPermiso(['VER_USUARIOS']); }
  mostrarPedidos(): boolean { return this.api.tieneAlgunPermiso(['CREAR_PEDIDOS', 'SOLICITAR_CANCELACION_PEDIDOS', 'AUTORIZAR_PEDIDOS']); }
  mostrarRecetas(): boolean { return this.api.tieneAlgunPermiso(['GESTIONAR_RECETAS', 'AUTORIZAR_PEDIDOS']); }
  mostrarProduccion(): boolean { return this.api.tieneAlgunPermiso(['AUTORIZAR_PRODUCCION', 'INICIAR_PRODUCCION', 'CONFIRMAR_PRODUCCION']); }
}
