import express from 'express';
import helmet from 'helmet';
import { manejarError, responderRutaNoEncontrada } from './intermediarios/manejo-errores.js';
import { rutasApi } from './rutas/api-rutas.js';

// Configura los elementos comunes de la API antes de registrar sus rutas.
export function crearAplicacion() {
  const aplicacion = express();

  aplicacion.use(helmet());
  aplicacion.use(express.json());
  aplicacion.use('/api', rutasApi);
  aplicacion.use(responderRutaNoEncontrada);
  aplicacion.use(manejarError);

  return aplicacion;
}
