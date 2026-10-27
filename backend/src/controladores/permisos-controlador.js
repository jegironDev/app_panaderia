import {
  asignarPermisoRol,
  consultarPermisos,
  consultarPermisosEfectivosUsuario,
  consultarPermisosRol,
  retirarPermisoRol,
} from '../servicios/permisos-servicio.js';

export async function listarPermisos(solicitud, respuesta) {
  respuesta.json(await consultarPermisos());
}

export async function listarPermisosRol(solicitud, respuesta) {
  respuesta.json(await consultarPermisosRol(validarIdentificador(solicitud.params.id, 'rol')));
}

export async function listarPermisosEfectivosUsuario(solicitud, respuesta) {
  respuesta.json(await consultarPermisosEfectivosUsuario(validarIdentificador(solicitud.params.id, 'usuario')));
}

export async function agregarPermisoRol(solicitud, respuesta) {
  const identificadorRol = validarIdentificador(solicitud.params.id, 'rol');
  const identificadorPermiso = validarIdentificador(solicitud.body?.identificadorPermiso, 'permiso');
  const permisos = await asignarPermisoRol(identificadorRol, identificadorPermiso, solicitud.identidad.identificadorUsuario);
  respuesta.status(201).json(permisos);
}

export async function eliminarPermisoRol(solicitud, respuesta) {
  const identificadorRol = validarIdentificador(solicitud.params.id, 'rol');
  const identificadorPermiso = validarIdentificador(solicitud.params.idPermiso, 'permiso');
  const permisos = await retirarPermisoRol(identificadorRol, identificadorPermiso, solicitud.identidad.identificadorUsuario);
  respuesta.json(permisos);
}

function validarIdentificador(valor, entidad) {
  const identificador = Number(valor);
  if (!Number.isInteger(identificador) || identificador <= 0) {
    const error = new Error(`El identificador de ${entidad} no es válido`);
    error.codigoEstado = 400;
    throw error;
  }
  return identificador;
}
