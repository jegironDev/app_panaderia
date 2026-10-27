import {
  asignarRolUsuario,
  consultarRolesDisponibles,
  consultarRolesUsuario,
  retirarRolUsuario,
} from '../servicios/roles-servicio.js';

export async function listarRoles(solicitud, respuesta) {
  respuesta.json(await consultarRolesDisponibles());
}

export async function listarRolesUsuario(solicitud, respuesta) {
  const identificadorUsuario = validarIdentificador(solicitud.params.id, 'usuario');
  respuesta.json(await consultarRolesUsuario(identificadorUsuario));
}

export async function agregarRolUsuario(solicitud, respuesta) {
  const identificadorUsuario = validarIdentificador(solicitud.params.id, 'usuario');
  const identificadorRol = validarIdentificador(solicitud.body?.identificadorRol, 'rol');
  const roles = await asignarRolUsuario(identificadorUsuario, identificadorRol, solicitud.identidad.identificadorUsuario);
  respuesta.status(201).json(roles);
}

export async function eliminarRolUsuario(solicitud, respuesta) {
  const identificadorUsuario = validarIdentificador(solicitud.params.id, 'usuario');
  const identificadorRol = validarIdentificador(solicitud.params.idRol, 'rol');
  const roles = await retirarRolUsuario(identificadorUsuario, identificadorRol, solicitud.identidad.identificadorUsuario);
  respuesta.json(roles);
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
