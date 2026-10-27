import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Usuario } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, BarraNavegacion],
  templateUrl: './usuarios.html'
})
export class Usuarios implements OnInit {
  usuarios: Usuario[] = [];
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.usuarios().subscribe({
      next: (r) => this.usuarios = r,
      error: (e) => {
        if (e.status === 401) {
          this.error = 'Sesión expirada. Ingrese nuevamente.';
          sessionStorage.removeItem('token');
          window.location.href = '/ingresar';
        } else if (e.status === 403) {
          this.error = 'No tiene permisos para realizar esta operación';
        } else {
          this.error = e.error?.error || 'No fue posible consultar usuarios';
        }
      }
    });
  }
}
