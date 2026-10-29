import { describe, expect, it, vi } from 'vitest';
import { Pedidos } from './pedidos';

function crearComponente(permisos: string[], identificadorSucursal: unknown) {
  const api = {
    tienePermiso: vi.fn((permiso: string) => permisos.includes(permiso)),
    obtenerIdentificadorSucursalSesion: vi.fn(() => identificadorSucursal),
  };
  return new Pedidos(api as any, {} as any, { markForCheck: vi.fn() } as any);
}

describe('Pedidos', () => {
  it('no muestra Crear pedido a JGIRON sin sucursal', () => {
    expect(crearComponente(['CREAR_PEDIDOS'], null).puedeCrearPedido()).toBe(false);
  });

  it('muestra Crear pedido a un usuario de sucursal con permiso', () => {
    expect(crearComponente(['CREAR_PEDIDOS'], 2).puedeCrearPedido()).toBe(true);
  });

  it('no muestra Crear pedido sin permiso aunque exista sucursal', () => {
    expect(crearComponente([], 2).puedeCrearPedido()).toBe(false);
  });
});
