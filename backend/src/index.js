// Servidor REST inicial: catálogo y disponibilidad de inventario.
import 'dotenv/config';
import { crearAplicacion } from './aplicacion.js';
import { crearGrupoConexiones } from './configuracion/base-datos.js';

const aplicacion = crearAplicacion();
const puerto = Number(process.env.PUERTO || 3000);

// Inicia Express aunque Oracle no esté disponible para informar el estado del servidor.
aplicacion.listen(puerto, () => console.log(`API escuchando en puerto ${puerto}`));

crearGrupoConexiones()
  .then(() => console.log('Grupo de conexiones Oracle inicializado'))
  .catch(error => console.error('No se pudo iniciar la conexión Oracle:', error.message));


