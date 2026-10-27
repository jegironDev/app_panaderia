import { iniciarSesion, inicializarAcceso } from '../servicios/acceso-servicio.js';
import { eliminarSesion } from '../servicios/sesiones-servicio.js';

// Valida la entrada del inicio de sesión y devuelve una sesión sin contraseña.
export async function iniciarSesionUsuario(solicitud, respuesta) {
  const { usuario, contrasena } = solicitud.body;

  if (!usuario || !contrasena) {
    return respuesta.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
  }

  return respuesta.json(await iniciarSesion(usuario, contrasena));
}

// Elimina el token enviado por encabezado para cerrar la sesión actual.
export function cerrarSesionUsuario(solicitud, respuesta) {
  const token = obtenerTokenAutorizacion(solicitud);

  if (token) {
    eliminarSesion(token);
  }

  return respuesta.status(204).send();
}

// Recibe datos iniciales solamente para una base sin usuarios ni roles.
export async function inicializarAccesoUsuario(solicitud, respuesta) {
  const claveInicial = solicitud.header('x-clave-inicial');
  const { roles, usuarios } = solicitud.body;

  if (!Array.isArray(roles) || !Array.isArray(usuarios) || !roles.length || !usuarios.length) {
    return respuesta.status(400).json({ error: 'Debe enviar roles y usuarios iniciales' });
  }

  await inicializarAcceso(claveInicial, { roles, usuarios });
  return respuesta.status(201).json({ mensaje: 'Configuración inicial creada' });
}

// Extrae el token Bearer sin registrar su valor.
function obtenerTokenAutorizacion(solicitud) {
  const autorizacion = solicitud.header('authorization');

  if (!autorizacion?.startsWith('Bearer ')) {
    return null;
  }

  return autorizacion.substring('Bearer '.length);
}
