import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';
import { FechaGuatemalaPipe } from '../../compartidos/tuberias/fecha-guatemala.pipe';

@Component({ standalone: true, imports: [CommonModule, FormsModule, RouterLink, BarraNavegacion, FechaGuatemalaPipe], templateUrl: './bitacoras.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class Bitacoras implements OnInit {
  tipo = ''; fuentes: Array<{ codigo: string; titulo: string; descripcion: string }> = []; usuarios: Array<{ ID_USUARIO: number; USUARIO: string }> = []; registros: any[] = []; fuente: any = null; filtro = ''; usuario: number | null = null; desde = ''; hasta = ''; pagina = 1; tamano = 20; total = 0; cargando = false; error = '';
  constructor(private readonly api: ApiService, private readonly ruta: ActivatedRoute, private readonly router: Router, private readonly cdr: ChangeDetectorRef) {}
  ngOnInit() { this.tipo = this.ruta.snapshot.paramMap.get('tipo') || ''; this.api.fuentesBitacora().subscribe({ next: fuentes => { this.fuentes = fuentes; if (this.tipo) this.cargar(); this.cdr.markForCheck(); }, error: error => { this.error = error.error?.error || 'No fue posible cargar las bitácoras.'; this.cdr.markForCheck(); } }); if (this.tipo) this.api.usuariosBitacora().subscribe({ next: usuarios => { this.usuarios = usuarios; this.cdr.markForCheck(); } }); }
  cargar() { if (!this.tipo) return; this.cargando = true; this.api.bitacoraPorTipo(this.tipo, { pagina: this.pagina, tamano: this.tamano, usuario: this.filtro === 'usuario' ? this.usuario || undefined : undefined, desde: this.filtro === 'fecha' ? this.desde : undefined, hasta: this.filtro === 'fecha' ? this.hasta : undefined }).subscribe({ next: respuesta => { this.fuente = respuesta.fuente; this.registros = respuesta.registros; this.total = respuesta.total; this.cargando = false; this.cdr.markForCheck(); }, error: error => { this.error = error.error?.error || 'No fue posible consultar la bitácora.'; this.cargando = false; this.cdr.markForCheck(); } }); }
  aplicar() { this.pagina = 1; this.cargar(); }
  limpiar() { this.usuario = null; this.desde = ''; this.hasta = ''; this.pagina = 1; this.cargar(); }
  cambiarFiltro() { this.usuario = null; this.desde = ''; this.hasta = ''; this.pagina = 1; this.cdr.markForCheck(); }
  irFuente(codigo: string) { this.router.navigate(['/bitacoras', codigo]); }
  es(tipo: string) { return this.tipo === tipo; }
}
