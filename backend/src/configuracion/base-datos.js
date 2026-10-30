import oracledb from 'oracledb';

let grupoConexiones;

// Lee y valida la configuración privada sin incluir sus valores en errores o respuestas.
function obtenerConfiguracionBaseDatos() {
  const variablesRequeridas = ['BD_USUARIO_NUEVO', 'BD_CONTRASENA_NUEVO', 'BD_CADENA_CONEXION'];
  const variablesAusentes = variablesRequeridas.filter(nombre => !process.env[nombre]);

  if (variablesAusentes.length) {
    const error = new Error('Faltan variables de configuración para Oracle');
    error.codigoEstado = 500;
    throw error;
  }

  return {
    user: process.env.BD_USUARIO_NUEVO,
    password: process.env.BD_CONTRASENA_NUEVO,
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
    const conexion = await grupoConexiones.getConnection();
    try {
      const resultado = await conexion.execute(
        `SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AS ESQUEMA,
                SYS_CONTEXT('USERENV', 'CON_NAME') AS PDB
           FROM DUAL`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const { ESQUEMA: esquema, PDB: pdb } = resultado.rows[0];
      if (esquema !== 'DB_PANADERIA' || pdb !== 'XEPDB1') {
        throw new Error('El pool operativo no apunta a DB_PANADERIA en XEPDB1');
      }
    } catch (error) {
      await grupoConexiones.close(0);
      grupoConexiones = undefined;
      throw error;
    } finally {
      await conexion.close();
    }
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
