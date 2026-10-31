import {
  consultarEstadosPedidoActivos,
  consultarJornadasActivas,
  consultarPedidoPorIdentificador,
  consultarPedidos,
  crearPedido,
  autorizarPedido,
  solicitarCancelacionPedido,
} from '../servicios/pedidos-servicio.js';
import { consultarColaPedidos, consultarPedidosPendientesSinCola, incorporarPedidoEnCola, moverPedidoEnCola } from '../servicios/cola-pedidos-servicio.js';

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

export async function listarColaPedidos(solicitud, respuesta) {
  respuesta.json(await consultarColaPedidos());
}

export async function listarPedidosPendientesSinCola(solicitud, respuesta) {
  respuesta.json(await consultarPedidosPendientesSinCola());
}

export async function incorporarPedidoRegistradoEnCola(solicitud, respuesta) {
  const identificadorPedido = validarIdentificadorPedido(solicitud.params.id);
  respuesta.status(201).json(await incorporarPedidoEnCola(identificadorPedido, solicitud.identidad));
}

export async function subirPedidoEnCola(solicitud, respuesta) {
  const identificadorPedido = validarIdentificadorPedido(solicitud.params.id);
  respuesta.json(await moverPedidoEnCola(identificadorPedido, 'SUBIR'));
}

export async function bajarPedidoEnCola(solicitud, respuesta) {
  const identificadorPedido = validarIdentificadorPedido(solicitud.params.id);
  respuesta.json(await moverPedidoEnCola(identificadorPedido, 'BAJAR'));
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
