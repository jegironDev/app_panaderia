import { describe, expect, it, vi } from 'vitest';
import { PlanificarProduccion } from './planificar-produccion';

function crearComponente() {
  const api = {};
  return new PlanificarProduccion(api as any, { navigate: vi.fn() } as any, { markForCheck: vi.fn() } as any);
}

describe('PlanificarProduccion', () => {
  it('bloquea la autorización si hay faltantes', () => {
    const componente = crearComponente();
    componente.plan = { identificadorPedido: 1, posicionCola: 1, producciones: [], ingredientesRequeridos: [], cobertura: [], disponibilidad: [{ identificadorProducto: 1, cantidadRequerida: 2, disponible: 0, faltante: 2 }] };
    expect(componente.puedeAutorizar()).toBe(false);
  });

  it('abre y cierra la confirmación sin enviar solicitudes', () => {
    const componente = crearComponente();
    componente.plan = { identificadorPedido: 1, posicionCola: 1, producciones: [], ingredientesRequeridos: [], cobertura: [], disponibilidad: [] };
    componente.abrirConfirmacion();
    expect(componente.confirmarAutorizacion).toBe(true);
    componente.cancelarConfirmacion();
    expect(componente.confirmarAutorizacion).toBe(false);
  });
});
