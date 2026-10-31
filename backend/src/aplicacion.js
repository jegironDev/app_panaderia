import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { manejarError, responderRutaNoEncontrada } from './intermediarios/manejo-errores.js';
import { rutasApi } from './rutas/api-rutas.js';

// Configura los elementos comunes de la API antes de registrar sus rutas.
function limitarIntentosInicioSesion({ maximo = 10, ventanaMs = 15 * 60 * 1000 } = {}) {
  const intentos = new Map();
  return (solicitud, respuesta, siguiente) => {
    const ahora = Date.now(); const llave = solicitud.ip || solicitud.socket.remoteAddress || 'desconocido';
    const actual = intentos.get(llave);
    const vigente = actual && ahora - actual.inicio < ventanaMs ? actual : { inicio: ahora, cantidad: 0 };
    vigente.cantidad += 1; intentos.set(llave, vigente);
    if (vigente.cantidad > maximo) return respuesta.status(429).json({ error: 'Demasiados intentos de inicio de sesión. Inténtelo más tarde.' });
    return siguiente();
  };
}

export function crearAplicacion({ directorioPublico } = {}) {
  const aplicacion = express();

  aplicacion.use(helmet());
  aplicacion.use(express.json());
  aplicacion.post('/api/acceso/iniciar-sesion', limitarIntentosInicioSesion());
  aplicacion.use('/api', rutasApi);
  if (directorioPublico && existsSync(directorioPublico)) {
    const entrada = existsSync(join(directorioPublico, 'index.html')) ? 'index.html' : 'index.csr.html';
    aplicacion.use(express.static(directorioPublico, { index: entrada, fallthrough: true }));
    aplicacion.get(/^(?!\/api(?:\/|$)).*/, (_solicitud, respuesta) => respuesta.sendFile(entrada, { root: directorioPublico }));
  }
  aplicacion.use(responderRutaNoEncontrada);
  aplicacion.use(manejarError);

  return aplicacion;
}
