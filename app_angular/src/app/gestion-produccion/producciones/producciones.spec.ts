import { describe, expect, it, vi } from 'vitest';
import { Producciones } from './producciones';

function crearComponente(permisos: string[] = []) {
  const api = { tienePermiso: vi.fn((permiso: string) => permisos.includes(permiso)), producciones: vi.fn() };
  return new Producciones(api as any, { navigate: vi.fn() } as any, { markForCheck: vi.fn() } as any);
}

describe('Producciones', () => {
  it('muestra planificación solo con AUTORIZAR_PRODUCCION', () => {
    expect(crearComponente(['AUTORIZAR_PRODUCCION']).puedePlanificar()).toBe(true);
    expect(crearComponente(['INICIAR_PRODUCCION']).puedePlanificar()).toBe(false);
  });

  it('presenta estados de producción legibles', () => {
    expect(crearComponente().etiquetaEstado('EN_PRODUCCION')).toBe('EN PRODUCCION');
  });
});
