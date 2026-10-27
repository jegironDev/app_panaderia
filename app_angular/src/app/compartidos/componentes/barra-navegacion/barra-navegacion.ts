import { Component } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { ApiService } from '../../../api.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  selector: 'app-barra-navegacion',
  templateUrl: './barra-navegacion.html'
})
export class BarraNavegacion {
  constructor(private api: ApiService, private router: Router) {}

  cerrarSesion() {
    this.api.cerrarSesion().subscribe({
      next: () => {
        sessionStorage.removeItem('token');
        this.router.navigate(['/ingresar']);
      },
      error: () => {
        sessionStorage.removeItem('token');
        this.router.navigate(['/ingresar']);
      }
    });
  }
}
