import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ApiService } from '../../../api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  selector: 'app-barra-navegacion',
  templateUrl: './barra-navegacion.html'
})
export class BarraNavegacion {
  constructor(private api: ApiService, private router: Router) {}

  cerrarSesion() {
    this.api.cerrarSesion().subscribe({
      next: () => {
        this.api.limpiarSesion();
        this.router.navigate(['/ingresar']);
      },
      error: () => {
        this.api.limpiarSesion();
        this.router.navigate(['/ingresar']);
      }
    });
  }

  mostrarUsuarios(): boolean { return this.api.tieneAlgunPermiso(['VER_USUARIOS']); }
  mostrarPedidos(): boolean { return this.api.tieneAlgunPermiso(['CREAR_PEDIDOS', 'SOLICITAR_CANCELACION_PEDIDOS', 'AUTORIZAR_PEDIDOS']); }
}
