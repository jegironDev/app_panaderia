import { cambiarEstadoPuesto, consultarPuesto, crearPuesto, editarPuesto, listarPuestos, validarDatosPuesto } from '../servicios/puestos-servicio.js';

export async function listarPuestosAdministracion(solicitud, respuesta) {
  respuesta.json(await listarPuestos(solicitud.query.incluirInactivos === 'true'));
}

// Catálogo reducido para formularios de usuarios; no expone permisos ni conteos.
export async function listarPuestosAsignables(_solicitud, respuesta) {
  const puestos = await listarPuestos(false);
  respuesta.json(puestos.map(({ ID_ROL, NOMBRE, DESCRIPCION }) => ({ ID_ROL, NOMBRE, DESCRIPCION })));
}

export async function consultarPuestoAdministracion(solicitud, respuesta) {
  respuesta.json(await consultarPuesto(validarIdentificador(solicitud.params.id)));
}

export async function registrarPuesto(solicitud, respuesta) {
  respuesta.status(201).json(await crearPuesto(validarDatosPuesto(solicitud.body)));
}

export async function actualizarPuesto(solicitud, respuesta) {
  respuesta.json(await editarPuesto(validarIdentificador(solicitud.params.id), validarDatosPuesto(solicitud.body), solicitud.identidad.identificadorUsuario));
}

export async function actualizarEstadoPuesto(solicitud, respuesta) {
  const estado = String(solicitud.body?.estado || '').toUpperCase();
  if (!['A', 'I'].includes(estado)) {
    const error = new Error('El estado del puesto no es válido.'); error.codigoEstado = 400; error.mensajeCliente = error.message; throw error;
  }
  respuesta.json(await cambiarEstadoPuesto(validarIdentificador(solicitud.params.id), estado));
}

function validarIdentificador(valor) {
  const identificador = Number(valor);
  if (!Number.isInteger(identificador) || identificador <= 0) {
    const error = new Error('El identificador del puesto no es válido.'); error.codigoEstado = 400; error.mensajeCliente = error.message; throw error;
  }
  return identificador;
}
