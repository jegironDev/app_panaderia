import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, ProduccionesPedido as ProduccionesPedidoRespuesta, obtenerMensajeErrorHttp } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({ standalone: true, imports: [CommonModule, RouterLink, BarraNavegacion], templateUrl: './producciones-pedido.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class ProduccionesPedido implements OnInit {
  pedido: ProduccionesPedidoRespuesta | null = null;
  cargando = true;
  error = '';
  constructor(private readonly api: ApiService, private readonly route: ActivatedRoute, private readonly router: Router, private readonly cdr: ChangeDetectorRef) {}
  ngOnInit() {
    const identificador = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(identificador) || identificador <= 0) { this.cargando = false; this.error = 'El identificador de pedido no es válido.'; this.cdr.markForCheck(); return; }
    this.api.produccionesPorPedido(identificador).subscribe({ next: pedido => { this.pedido = pedido; this.cargando = false; this.cdr.markForCheck(); }, error: error => this.mostrarError(error) });
  }
  esFinalizada(estado: string) { return estado === 'FINALIZADA'; }
  etiquetaCantidad(estado: string) { return this.esFinalizada(estado) ? 'Cantidad utilizada' : 'Cantidad prevista'; }
  private mostrarError(error: any) { this.cargando = false; if (error?.status === 401) { this.api.limpiarSesion(); this.router.navigate(['/ingresar']); return; } this.error = obtenerMensajeErrorHttp(error, 'No fue posible cargar las producciones del pedido.'); this.cdr.markForCheck(); }
}
