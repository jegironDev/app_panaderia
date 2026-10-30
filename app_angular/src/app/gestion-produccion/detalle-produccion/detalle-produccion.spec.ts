import { describe, expect, it, vi } from 'vitest';
import { DetalleProduccion } from './detalle-produccion';

function crearComponente(permisos: string[]) {
  const api = { tienePermiso: vi.fn((permiso: string) => permisos.includes(permiso)) };
  return new DetalleProduccion(api as any, { snapshot: { paramMap: { get: vi.fn() } } } as any, { navigate: vi.fn() } as any, { markForCheck: vi.fn() } as any);
}

describe('DetalleProduccion', () => {
  it('presenta la acción correcta según estado y permiso', () => {
    const componente = crearComponente(['INICIAR_PRODUCCION', 'CONFIRMAR_PRODUCCION']);
    componente.produccion = { ESTADO: 'AUTORIZADA', DETALLES: [] } as any;
    expect(componente.puedeIniciar()).toBe(true);
    expect(componente.puedeFinalizar()).toBe(false);
    componente.produccion = { ESTADO: 'EN_PRODUCCION', DETALLES: [] } as any;
    expect(componente.puedeFinalizar()).toBe(true);
  });

  it('identifica el historial sin ingredientes congelados', () => {
    const componente = crearComponente([]);
    componente.produccion = { ESTADO: 'FINALIZADA', DETALLES: [] } as any;
    expect(componente.esHistorica()).toBe(true);
  });
});
