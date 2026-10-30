import {
  autorizarProduccion,
  consultarOpcionesPlanificacion,
  consultarProduccionPorIdentificador,
  consultarProduccionesPorPedido,
  finalizarProduccion,
  iniciarProduccion,
  listarProducciones,
  planificarProduccion,
} from "../servicios/produccion-servicio.js";

export async function consultarOpcionesPlanificacionProduccion(
  solicitud,
  respuesta,
) {
  const identificadorPedido = validarIdentificador(solicitud.params.id);
  respuesta.json(await consultarOpcionesPlanificacion(identificadorPedido));
}

export async function consultarPlanificacionProduccion(solicitud, respuesta) {
  respuesta.json(await planificarProduccion(solicitud.body));
}

export async function autorizarPlanificacionProduccion(solicitud, respuesta) {
  respuesta
    .status(201)
    .json(await autorizarProduccion(solicitud.body, solicitud.identidad));
}

export async function consultarProduccion(solicitud, respuesta) {
  const identificadorProduccion = validarIdentificador(solicitud.params.id);
  const produccion = await consultarProduccionPorIdentificador(
    identificadorProduccion,
  );
  if (!produccion)
    return respuesta.status(404).json({ error: "Producción no encontrada." });
  return respuesta.json(produccion);
}

export async function iniciarProduccionRegistrada(solicitud, respuesta) {
  const identificadorProduccion = validarIdentificador(solicitud.params.id);
  respuesta.json(await iniciarProduccion(identificadorProduccion, solicitud.identidad));
}

export async function finalizarProduccionRegistrada(solicitud, respuesta) {
  const identificadorProduccion = validarIdentificador(solicitud.params.id);
  respuesta.json(await finalizarProduccion(identificadorProduccion, solicitud.identidad));
}

export async function listarProduccionesRegistradas(solicitud, respuesta) {
  respuesta.json(await listarProducciones(solicitud.query));
}

export async function consultarProduccionesPedido(solicitud, respuesta) {
  const identificadorPedido = validarIdentificador(solicitud.params.id);
  respuesta.json(await consultarProduccionesPorPedido(identificadorPedido));
}

function validarIdentificador(valor) {
  const identificador = Number(valor);
  if (!Number.isInteger(identificador) || identificador <= 0) {
    const error = new Error("El identificador de producción no es válido.");
    error.codigoEstado = 400;
    error.mensajeCliente = error.message;
    throw error;
  }
  return identificador;
}
