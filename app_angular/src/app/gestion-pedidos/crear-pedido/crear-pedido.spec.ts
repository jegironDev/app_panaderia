import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { CrearPedido } from './crear-pedido';

function crearComponente() {
  const api = {
    crearPedido: vi.fn(() => of({})),
    jornadasPedido: vi.fn(() => of([])),
    productosTerminados: vi.fn(() => of([])),
  };
  const router = { navigate: vi.fn() };
  const componente = new CrearPedido(api as any, router as any, { markForCheck: vi.fn() } as any);
  return { componente, api, router };
}

describe('CrearPedido', () => {
  it('cancela sin enviar una solicitud de creación', () => {
    const { componente, api, router } = crearComponente();

    componente.cancelar();

    expect(router.navigate).toHaveBeenCalledWith(['/pedidos']);
    expect(api.crearPedido).not.toHaveBeenCalled();
  });

  it('conserva el registro del pedido cuando los datos son válidos', () => {
    const { componente, api } = crearComponente();
    componente.identificadorJornada = 1;
    componente.lineas = [{ identificadorProducto: 9, cantidad: 5 }];

    componente.guardar();

    expect(api.crearPedido).toHaveBeenCalledWith({
      identificadorJornada: 1,
      observaciones: null,
      detalles: [{ identificadorProducto: 9, cantidad: 5 }],
    });
  });
});
