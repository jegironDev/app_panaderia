// Servidor REST inicial: catálogo y disponibilidad de inventario.
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import oracledb from 'oracledb';

const aplicacion = express();
aplicacion.use(helmet());
aplicacion.use(express.json());

// Pool reutilizable; cada petición adquiere y devuelve una conexión.
let grupoConexiones;
async function crearGrupoConexiones() {
  grupoConexiones = await oracledb.createPool({
    user: process.env.BD_USUARIO,
    password: process.env.BD_CONTRASENA,
    connectString: process.env.BD_CADENA_CONEXION,
    poolMin: 0, poolMax: 4, poolIncrement: 1
  });
}

// Evita consultas a Oracle mientras la conexión no se haya establecido.
function obtenerGrupoConexiones() {
  if (!grupoConexiones) {
    const error = new Error('La conexión con Oracle no está disponible');
    error.codigoEstado = 503;
    throw error;
  }

  return grupoConexiones;
}

// Abre el cursor devuelto por PL/SQL y garantiza liberar recursos.
async function consultarProcedimiento(nombre) {
  const conexion = await obtenerGrupoConexiones().getConnection();
  let cursor;
  try {
    const resultado = await conexion.execute(
      `BEGIN PKG_CONSULTAS.${nombre}(:salida); END;`,
      { salida: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR } }
    );
    cursor = resultado.outBinds.salida;
    return await cursor.getRows(1000);
  } finally {
    if (cursor) await cursor.close();
    await conexion.close();
  }
}

// Envoltorio para enviar errores asincrónicos al middleware común.
const manejadorAsincrono = funcion => (solicitud, respuesta, siguiente) =>
  Promise.resolve(funcion(solicitud, respuesta)).catch(siguiente);

aplicacion.get('/api/estado-conexion', (solicitud, respuesta) =>
  respuesta.json({ estado: 'activo', servicio: 'panaderia-api' })
);
aplicacion.get('/api/productos', manejadorAsincrono(async (solicitud, respuesta) => {
  respuesta.json(await consultarProcedimiento('OBTENER_PRODUCTOS'));
}));
aplicacion.get('/api/inventario/stock', manejadorAsincrono(async (solicitud, respuesta) => {
  respuesta.json(await consultarProcedimiento('OBTENER_STOCK'));
}));

// No publicar trazas ni credenciales a clientes HTTP.
aplicacion.use((error, solicitud, respuesta, siguiente) => {
  console.error('Error en API:', error.message);
  respuesta.status(error.codigoEstado || 500).json({ error: 'No fue posible completar la operación' });
});

// El estado del servidor se puede consultar aun cuando Oracle no esté disponible.
const puerto = Number(process.env.PUERTO || 3000);
aplicacion.listen(puerto, () => console.log(`API escuchando en puerto ${puerto}`));

crearGrupoConexiones()
  .then(() => console.log('Conexión Oracle inicializada'))
  .catch(error => console.error('No se pudo iniciar conexión Oracle:', error.message));


