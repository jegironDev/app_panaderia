import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../api.service';
import { BarraNavegacion } from '../../compartidos/componentes/barra-navegacion/barra-navegacion';

@Component({ standalone: true, imports: [CommonModule, RouterLink, BarraNavegacion], templateUrl: './portal-produccion.html', changeDetection: ChangeDetectionStrategy.OnPush })
export class PortalProduccion {
  constructor(readonly api: ApiService) {}
  puedeConsultar() { return this.api.tieneAlgunPermiso(['AUTORIZAR_PRODUCCION', 'INICIAR_PRODUCCION', 'CONFIRMAR_PRODUCCION']); }
  puedePlanificar() { return this.api.tienePermiso('AUTORIZAR_PRODUCCION'); }
}
