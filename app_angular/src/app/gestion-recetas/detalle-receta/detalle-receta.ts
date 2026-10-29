import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { ApiService, RecetaDetalle, obtenerMensajeErrorHttp } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, BarraNavegacion],
  templateUrl: './detalle-receta.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DetalleReceta implements OnInit {
  idReceta: number = 0;
  receta: RecetaDetalle | null = null;
  cargando = true;
  error = '';

  constructor(private readonly api: ApiService, private readonly router: Router, private readonly route: ActivatedRoute, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.idReceta = Number(id);
      this.cargarReceta();
    } else {
      this.error = 'Identificador de receta no válido';
      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  cargarReceta() {
    this.api.recetaPorId(this.idReceta).subscribe({
      next: (receta) => {
        this.receta = receta;
        this.cargando = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.cargando = false;
        if (error.status === 401) {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('permisos');
          sessionStorage.removeItem('identidad');
          this.router.navigate(['/ingresar']);
        } else {
          this.error = obtenerMensajeErrorHttp(error, 'No fue posible cargar la receta.');
        }
        this.cdr.markForCheck();
      }
    });
  }

  obtenerEstado(estado: string): string {
    return estado === 'A' ? 'Activa' : 'Inactiva';
  }
}
