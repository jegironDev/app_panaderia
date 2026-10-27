// Servidor REST inicial: catálogo y disponibilidad de inventario.
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import oracledb from 'oracledb';

const app = express();
app.use(helmet());
app.use(express.json());

// Pool reutilizable; cada petición adquiere y devuelve una conexión.
let pool;
async function crearPool() {
  pool = await oracledb.createPool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    poolMin: 0, poolMax: 4, poolIncrement: 1
  });
}

// Evita consultas a Oracle mientras la conexión no se haya establecido.
function obtenerPool() {
  if (!pool) {
    const error = new Error('La conexión con Oracle no está disponible');
    error.status = 503;
    throw error;
  }

  return pool;
}

// Abre el cursor devuelto por PL/SQL y garantiza liberar recursos.
async function consultarProcedimiento(nombre) {
  const connection = await obtenerPool().getConnection();
  let cursor;
  try {
    const result = await connection.execute(
      `BEGIN PKG_CONSULTAS.${nombre}(:salida); END;`,
      { salida: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR } }
    );
    cursor = result.outBinds.salida;
    return await cursor.getRows(1000);
  } finally {
    if (cursor) await cursor.close();
    await connection.close();
  }
}

// Envoltorio para enviar errores asincrónicos al middleware común.
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

app.get('/api/health', (req, res) => res.json({ status: 'ok', servicio: 'panaderia-api' }));
app.get('/api/productos', asyncHandler(async (req, res) => {
  res.json(await consultarProcedimiento('OBTENER_PRODUCTOS'));
}));
app.get('/api/inventario/stock', asyncHandler(async (req, res) => {
  res.json(await consultarProcedimiento('OBTENER_STOCK'));
}));

// No publicar trazas ni credenciales a clientes HTTP.
app.use((error, req, res, next) => {
  console.error('Error en API:', error.message);
  res.status(error.status || 500).json({ error: 'No fue posible completar la operación' });
});

// El estado del servidor se puede consultar aun cuando Oracle no esté disponible.
const puerto = Number(process.env.PORT || 3000);
app.listen(puerto, () => console.log(`API escuchando en puerto ${puerto}`));

crearPool()
  .then(() => console.log('Conexión Oracle inicializada'))
  .catch(error => console.error('No se pudo iniciar conexión Oracle:', error.message));


