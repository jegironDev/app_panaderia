import {
  consultarRecetaPorIdentificador,
  consultarRecetas,
  crearReceta,
  actualizarEstadoReceta,
  modificarReceta,
} from '../servicios/recetas-servicio.js';

export async function listarRecetas(solicitud, respuesta) {
  respuesta.json(await consultarRecetas());
}

export async function consultarReceta(solicitud, respuesta) {
  const identificadorReceta = validarIdentificadorReceta(solicitud.params.id);
  const receta = await consultarRecetaPorIdentificador(identificadorReceta);
  if (!receta) return respuesta.status(404).json({ error: 'Receta no encontrada' });
  return respuesta.json(receta);
}

export async function registrarReceta(solicitud, respuesta) {
  respuesta.status(201).json(await crearReceta(solicitud.body));
}

export async function actualizarReceta(solicitud, respuesta) {
  const identificadorReceta = validarIdentificadorReceta(solicitud.params.id);
  respuesta.json(await modificarReceta(identificadorReceta, solicitud.body));
}

export async function inactivarReceta(solicitud, respuesta) {
  const identificadorReceta = validarIdentificadorReceta(solicitud.params.id);
  respuesta.json(await actualizarEstadoReceta(identificadorReceta, solicitud.body?.estado));
}

function validarIdentificadorReceta(valor) {
  const identificadorReceta = Number(valor);
  if (!Number.isInteger(identificadorReceta) || identificadorReceta <= 0) {
    const error = new Error('El identificador de receta no es válido');
    error.codigoEstado = 400;
    throw error;
  }
  return identificadorReceta;
}
