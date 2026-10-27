import { obtenerIdentidadActual } from '../servicios/acceso-servicio.js';
import { obtenerSesion } from '../servicios/sesiones-servicio.js';

// Valida el token Bearer y vuelve a consultar la identidad vigente en Oracle.
export async function requerirSesion(solicitud, respuesta, siguiente) {
  const autorizacion = solicitud.header('authorization');
  const token = autorizacion?.startsWith('Bearer ')
    ? autorizacion.substring('Bearer '.length)
    : null;
  const sesion = token && obtenerSesion(token);

  if (!sesion) {
    return respuesta.status(401).json({ error: 'Debe iniciar sesión para continuar' });
  }

  const identidad = await obtenerIdentidadActual(sesion.identificadorUsuario);

  if (!identidad) {
    return respuesta.status(401).json({ error: 'La sesión ya no es válida' });
  }

  solicitud.identidad = identidad;
  return siguiente();
}

// Rechaza la petición aunque el cliente intente enviar permisos manualmente.
export function requerirPermiso(codigoPermiso) {
  return (solicitud, respuesta, siguiente) => {
    if (!solicitud.identidad.permisos.includes(codigoPermiso)) {
      return respuesta.status(403).json({ error: 'No tiene permiso para realizar esta operación' });
    }

    return siguiente();
  };
}
