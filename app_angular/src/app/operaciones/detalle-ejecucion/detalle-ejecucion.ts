import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';
import { FechaGuatemalaPipe } from '../../compartidos/tuberias/fecha-guatemala.pipe';

@Component({ standalone: true, imports: [CommonModule, RouterLink, BarraNavegacion, FechaGuatemalaPipe], templateUrl: './detalle-ejecucion.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class DetalleEjecucion implements OnInit {
  ejecucion: any; error = ''; cargando = true;
  constructor(private ruta: ActivatedRoute, private api: ApiService, private cdr: ChangeDetectorRef) {}
  ngOnInit() { const id = Number(this.ruta.snapshot.paramMap.get('id')); if (!id) { this.error = 'Identificador no válido.'; this.cargando = false; return; } this.api.ejecucionRutaPorId(id).subscribe({ next: x => { this.ejecucion = x; this.cargando = false; this.cdr.markForCheck(); }, error: e => { this.error = e.error?.error || 'No fue posible cargar la ejecución.'; this.cargando = false; this.cdr.markForCheck(); } }); }
  get pendientes() { return this.ejecucion?.ENTREGAS?.filter((x: any) => x.ESTADO === 'PENDIENTE').length || 0; }
  get realizadas() { return this.ejecucion?.ENTREGAS?.filter((x: any) => x.ESTADO === 'ENTREGADA').length || 0; }
  get progreso() { const total = this.ejecucion?.ENTREGAS?.length || 0; return total ? Math.round(this.realizadas * 100 / total) : 0; }
}
