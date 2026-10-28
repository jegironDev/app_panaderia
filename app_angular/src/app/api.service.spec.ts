import { describe, expect, it } from 'vitest';
import { convertirProductoRespuesta, obtenerMensajeErrorHttp } from './api.service';
import { puedeAutorizarPedido, puedeSolicitarCancelacionPedido } from './gestion-pedidos/detalle-pedido/detalle-pedido';

describe('adaptadores de pedidos', () => {
  it('convierte el catálogo Oracle conservando el identificador numérico', () => {
    expect(convertirProductoRespuesta([7, 'Azúcar', 'MAT', 9])).toEqual({
      ID_PRODUCTO: 7, NOMBRE: 'Azúcar', TIPO: 'MAT', PRECIO: 9,
    });
  });

  it('presenta un mensaje seguro para conflicto HTTP 409', () => {
    expect(obtenerMensajeErrorHttp({ status: 409 }, 'Alternativa')).toContain('conflicto');
  });

  it('solo muestra autorización para pedidos pendientes cuando el permiso está presente', () => {
    expect(puedeAutorizarPedido('PENDIENTE', true)).toBe(true);
    expect(puedeAutorizarPedido('PENDIENTE', false)).toBe(false);
    expect(puedeAutorizarPedido('AUTORIZADO', true)).toBe(false);
  });

  it('solo presenta la solicitud de cancelación al usuario de la sucursal dueña', () => {
    expect(puedeSolicitarCancelacionPedido(2, 2, true)).toBe(true);
    expect(puedeSolicitarCancelacionPedido(null, 2, true)).toBe(false);
    expect(puedeSolicitarCancelacionPedido(1, 2, true)).toBe(false);
    expect(puedeSolicitarCancelacionPedido(2, 2, false)).toBe(false);
  });
});
