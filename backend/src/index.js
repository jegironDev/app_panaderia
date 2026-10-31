// Servidor REST inicial: catálogo y disponibilidad de inventario.
import 'dotenv/config';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearAplicacion } from './aplicacion.js';
import { crearGrupoConexiones } from './configuracion/base-datos.js';

const directorioActual = dirname(fileURLToPath(import.meta.url));
const directorioAngular = process.env.DIRECTORIO_ANGULAR || resolve(directorioActual, '../../app_angular/dist/app_angular/browser');
const servirAngular = process.env.MODO_DEMOSTRACION === 'true';
if (servirAngular && !existsSync(directorioAngular)) throw new Error('No existe la compilación Angular para la demostración. Ejecute npm run build en app_angular.');
const aplicacion = crearAplicacion({ directorioPublico: servirAngular ? directorioAngular : undefined });
const puerto = Number(process.env.PUERTO || 3000);
const host = process.env.HOST || '127.0.0.1';

// Inicia Express aunque Oracle no esté disponible para informar el estado del servidor.
aplicacion.listen(puerto, host, () => console.log(`API escuchando en http://${host}:${puerto}`));

crearGrupoConexiones()
  .then(() => console.log('Grupo de conexiones Oracle inicializado'))
  .catch(error => console.error('No se pudo iniciar la conexión Oracle:', error.message));


