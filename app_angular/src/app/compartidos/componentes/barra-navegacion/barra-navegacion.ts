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
  esPiloto(): boolean { return this.api.esPilotoSesion(); }
  rutaMarca(): string { return this.esPiloto() ? '/mi-ruta' : '/inicio'; }

  mostrarUsuarios(): boolean { return this.api.tieneAlgunPermiso(['VER_USUARIOS']); }
  mostrarPuestos(): boolean { return this.api.tienePermiso('GESTIONAR_PUESTOS'); }
  mostrarSucursales(): boolean { return this.api.tienePermiso('GESTIONAR_SUCURSALES'); }
  mostrarProductos(): boolean { return this.api.tienePermiso('GESTIONAR_PRODUCTOS'); }
  mostrarRecetas(): boolean { return this.api.tieneAlgunPermiso(['GESTIONAR_RECETAS', 'AUTORIZAR_PEDIDOS']); }
  mostrarPedidos(): boolean { return this.api.tieneAlgunPermiso(['CREAR_PEDIDOS', 'SOLICITAR_CANCELACION_PEDIDOS', 'AUTORIZAR_PEDIDOS', 'AUTORIZAR_PRODUCCION']); }
  mostrarProduccion(): boolean { return this.api.tieneAlgunPermiso(['AUTORIZAR_PRODUCCION', 'INICIAR_PRODUCCION', 'CONFIRMAR_PRODUCCION']); }
  mostrarInventario(): boolean { return this.api.tieneAlgunPermiso(['VER_INVENTARIO', 'REGISTRAR_ENTRADA_INVENTARIO']); }
  mostrarAbastecimientos(): boolean { return this.api.tieneAlgunPermiso(['VER_INVENTARIO', 'REGISTRAR_ENTRADA_INVENTARIO']); }
  mostrarGestionInventario(): boolean { return this.api.tienePermiso('VER_INVENTARIO'); }
  mostrarDespachos(): boolean { return this.api.tienePermiso('PREPARAR_DESPACHOS'); }
  mostrarRutas(): boolean { return this.api.tienePermiso('GESTIONAR_RUTAS'); }
  mostrarReordenamientos(): boolean { return this.api.tienePermiso('RESOLVER_REORDENAMIENTOS'); }
  tieneEntregas(): boolean { return this.esPiloto() && this.api.tienePermiso('CONSULTAR_MI_RUTA'); }
  mostrarCancelaciones(): boolean { return this.api.tieneAlgunPermiso(['SOLICITAR_CANCELACION_PEDIDOS', 'RESOLVER_CANCELACIONES_PEDIDOS']); }
  mostrarBitacoras(): boolean { return this.api.tienePermiso('VER_REPORTES'); }
}
