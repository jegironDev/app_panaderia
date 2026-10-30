import { describe, expect, it, vi } from 'vitest';
import { ProduccionesPedido } from './producciones-pedido';

describe('ProduccionesPedido', () => {
  it('distingue cantidades previstas de utilizadas sin consultar recetas vigentes', () => {
    const componente = new ProduccionesPedido({} as any, { snapshot: { paramMap: { get: vi.fn() } } } as any, {} as any, { markForCheck: vi.fn() } as any);
    expect(componente.etiquetaCantidad('AUTORIZADA')).toBe('Cantidad prevista');
    expect(componente.etiquetaCantidad('FINALIZADA')).toBe('Cantidad utilizada');
  });
});
