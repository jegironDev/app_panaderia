import {
  consultarEstadosPedidoActivos,
  consultarJornadasActivas,
  consultarPedidoPorIdentificador,
  consultarPedidos,
  crearPedido,
  autorizarPedido,
  solicitarCancelacionPedido,
} from '../servicios/pedidos-servicio.js';

export async function listarPedidos(solicitud, respuesta) {
  respuesta.json(await consultarPedidos(solicitud.identidad));
}

export async function consultarPedido(solicitud, respuesta) {
  const identificadorPedido = validarIdentificadorPedido(solicitud.params.id);
  const pedido = await consultarPedidoPorIdentificador(identificadorPedido, solicitud.identidad);
  if (!pedido) return respuesta.status(404).json({ error: 'Pedido no encontrado' });
  return respuesta.json(pedido);
}

export async function listarEstadosPedido(solicitud, respuesta) {
  respuesta.json(await consultarEstadosPedidoActivos());
}

export async function listarJornadas(solicitud, respuesta) {
  respuesta.json(await consultarJornadasActivas());
}

export async function registrarPedido(solicitud, respuesta) {
  const pedido = await crearPedido(solicitud.body, solicitud.identidad);
  return respuesta.status(201).json(pedido);
}

export async function autorizarPedidoRegistrado(solicitud, respuesta) {
  const identificadorPedido = validarIdentificadorPedido(solicitud.params.id);
  return respuesta.json(await autorizarPedido(identificadorPedido, solicitud.identidad));
}

export async function registrarSolicitudCancelacion(solicitud, respuesta) {
  const identificadorPedido = validarIdentificadorPedido(solicitud.params.id);
  const solicitudCancelacion = await solicitarCancelacionPedido(
    identificadorPedido,
    solicitud.body?.motivo,
    solicitud.identidad,
  );
  return respuesta.status(201).json(solicitudCancelacion);
}

function validarIdentificadorPedido(valor) {
  const identificadorPedido = Number(valor);
  if (!Number.isInteger(identificadorPedido) || identificadorPedido <= 0) {
    const error = new Error('El identificador de pedido no es válido');
    error.codigoEstado = 400;
    throw error;
  }
  return identificadorPedido;
}
