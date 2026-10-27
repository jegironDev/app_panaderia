import oracledb from 'oracledb';

let grupoConexiones;

// Lee y valida la configuración privada sin incluir sus valores en errores o respuestas.
function obtenerConfiguracionBaseDatos() {
  const variablesRequeridas = ['BD_USUARIO', 'BD_CONTRASENA', 'BD_CADENA_CONEXION'];
  const variablesAusentes = variablesRequeridas.filter(nombre => !process.env[nombre]);

  if (variablesAusentes.length) {
    const error = new Error('Faltan variables de configuración para Oracle');
    error.codigoEstado = 500;
    throw error;
  }

  return {
    user: process.env.BD_USUARIO,
    password: process.env.BD_CONTRASENA,
    connectString: process.env.BD_CADENA_CONEXION,
    poolMin: 0,
    poolMax: 4,
    poolIncrement: 1,
  };
}

// Crea una sola agrupación reutilizable para las peticiones de la API.
export async function crearGrupoConexiones() {
  if (!grupoConexiones) {
    grupoConexiones = await oracledb.createPool(obtenerConfiguracionBaseDatos());
  }

  return grupoConexiones;
}

// Obtiene una conexión individual que el servicio debe liberar al finalizar.
export async function obtenerConexion() {
  if (!grupoConexiones) {
    const error = new Error('La conexión con Oracle no está disponible');
    error.codigoEstado = 503;
    throw error;
  }

  return grupoConexiones.getConnection();
}
