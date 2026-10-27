import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../api.service';

@Component({
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './inicio-sesion.html'
})
export class InicioSesion {
  usuario = '';
  contrasena = '';
  error = '';

  constructor(private api: ApiService, private router: Router) {}

  ingresar() {
    this.api.iniciarSesion({ usuario: this.usuario, contrasena: this.contrasena }).subscribe({
      next: (r) => {
        sessionStorage.setItem('token', r.token);
        this.router.navigateByUrl('/usuarios');
      },
      error: (e) => {
        this.error = e.error?.error || 'No fue posible ingresar';
      }
    });
  }
}
