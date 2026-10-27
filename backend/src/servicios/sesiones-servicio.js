import { randomBytes } from 'crypto';

const sesionesActivas = new Map();

// Calcula la vigencia de las sesiones sin exponer valores de configuración al cliente.
function obtenerDuracionSesionMilisegundos() {
  const minutos = Number(process.env.DURACION_SESION_MINUTOS || 120);
  return Math.max(1, minutos) * 60 * 1000;
}

// Genera un token opaco y conserva únicamente los datos necesarios para autorizar peticiones.
export function crearSesion(datosUsuario) {
  const token = randomBytes(32).toString('hex');
  const venceEn = new Date(Date.now() + obtenerDuracionSesionMilisegundos());

  sesionesActivas.set(token, { ...datosUsuario, venceEn });
  return { token, venceEn };
}

// Recupera una sesión vigente y elimina inmediatamente las sesiones vencidas.
export function obtenerSesion(token) {
  const sesion = sesionesActivas.get(token);

  if (!sesion) {
    return null;
  }

  if (sesion.venceEn <= new Date()) {
    sesionesActivas.delete(token);
    return null;
  }

  return sesion;
}

// Elimina el token al cerrar sesión.
export function eliminarSesion(token) {
  return sesionesActivas.delete(token);
}
