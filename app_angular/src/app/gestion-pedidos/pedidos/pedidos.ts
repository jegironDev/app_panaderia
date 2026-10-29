import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService, PedidoResumen } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, BarraNavegacion],
  templateUrl: './pedidos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pedidos implements OnInit {
  pedidos: PedidoResumen[] = [];
  cargando = true;
  error = '';

  constructor(private readonly api: ApiService, private readonly router: Router, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.api.pedidos().subscribe({
      next: pedidos => { this.pedidos = pedidos; this.cargando = false; this.cdr.markForCheck(); },
      error: error => this.mostrarError(error, 'No fue posible consultar pedidos'),
    });
  }

  puedeCrearPedido(): boolean {
    const identificadorSucursal = this.api.obtenerIdentificadorSucursalSesion();
    return this.api.tienePermiso('CREAR_PEDIDOS')
      && Number.isInteger(identificadorSucursal)
      && (identificadorSucursal as number) > 0;
  }

  private mostrarError(error: any, mensaje: string) {
    this.cargando = false;
    if (error.status === 401) {
      sessionStorage.removeItem('token');
      this.router.navigate(['/ingresar']);
      return;
    }
    this.error = error.error?.error || mensaje;
    this.cdr.markForCheck();
  }
}
