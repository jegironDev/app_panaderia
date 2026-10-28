import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BarraNavegacion } from '../compartidos/componentes/barra-navegacion/barra-navegacion';
import { ApiService } from '../api.service';

@Component({ standalone: true, imports: [CommonModule, RouterLink, BarraNavegacion], templateUrl: './inicio.html' })
export class Inicio {
  constructor(private readonly api: ApiService) {}
  mostrarUsuarios(): boolean { return this.api.tieneAlgunPermiso(['VER_USUARIOS']); }
  mostrarPedidos(): boolean { return this.api.tieneAlgunPermiso(['CREAR_PEDIDOS', 'SOLICITAR_CANCELACION_PEDIDOS', 'AUTORIZAR_PEDIDOS']); }
}
