import { describe, expect, it, vi } from 'vitest';
import { PortalProduccion } from './portal-produccion';

describe('PortalProduccion', () => {
  it('distingue consulta de planificación según permisos', () => {
    const api = { tieneAlgunPermiso: vi.fn(() => true), tienePermiso: vi.fn(() => false) };
    const componente = new PortalProduccion(api as any);
    expect(componente.puedeConsultar()).toBe(true);
    expect(componente.puedePlanificar()).toBe(false);
  });
});
