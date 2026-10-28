import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService, Usuario } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, BarraNavegacion],
  templateUrl: './usuarios.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Usuarios implements OnInit {
  usuarios: Usuario[] = [];
  error = '';

  constructor(private readonly api: ApiService, private readonly router: Router, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.api.usuarios().subscribe({
      next: (r) => { this.usuarios = r; this.cdr.markForCheck(); },
      error: (e) => {
        if (e.status === 401) {
          this.error = 'Sesión expirada. Ingrese nuevamente.';
          this.api.limpiarSesion();
          this.router.navigate(['/ingresar']);
        } else if (e.status === 403) {
          this.error = 'No tiene permisos para realizar esta operación';
        } else {
          this.error = e.error?.error || 'No fue posible consultar usuarios';
        }
        this.cdr.markForCheck();
      }
    });
  }
}
