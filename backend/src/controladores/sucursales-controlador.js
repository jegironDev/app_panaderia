import { obtenerConexion } from '../configuracion/base-datos.js';
import { consultarSucursalesActivas, crearSucursal, editarSucursal, inhabilitarSucursal, listarSucursalesAdministracion as consultarSucursalesAdministracion, validarNombreSucursal } from '../servicios/sucursales-servicio.js';

export async function listarSucursalesActivas(solicitud, respuesta) {
  const conexion = await obtenerConexion();
  try {
    respuesta.json(await consultarSucursalesActivas(conexion));
  } finally {
    await conexion.close();
  }
}

export async function listarSucursalesAdministracion(_solicitud, respuesta) {
  respuesta.json(await consultarSucursalesAdministracion());
}

export async function registrarSucursal(solicitud, respuesta) {
  respuesta.status(201).json(await crearSucursal(validarNombreSucursal(solicitud.body), solicitud.identidad.identificadorUsuario));
}

export async function actualizarSucursal(solicitud, respuesta) {
  respuesta.json(await editarSucursal(validarIdentificador(solicitud.params.id), validarNombreSucursal(solicitud.body), solicitud.identidad.identificadorUsuario));
}

export async function actualizarEstadoSucursal(solicitud, respuesta) {
  const estado = String(solicitud.body?.estado || '').toUpperCase();
  if (estado === 'A') { const error = new Error('La reactivación de sucursales no está permitida.'); error.codigoEstado = 409; error.mensajeCliente = error.message; throw error; }
  if (estado !== 'I') { const error = new Error('El estado solicitado no es válido.'); error.codigoEstado = 400; error.mensajeCliente = error.message; throw error; }
  respuesta.json(await inhabilitarSucursal(validarIdentificador(solicitud.params.id), solicitud.identidad.identificadorUsuario));
}

function validarIdentificador(valor) {
  const identificador = Number(valor);
  if (!Number.isInteger(identificador) || identificador <= 0) { const error = new Error('El identificador de sucursal no es válido.'); error.codigoEstado = 400; error.mensajeCliente = error.message; throw error; }
  return identificador;
}
