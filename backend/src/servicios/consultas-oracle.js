import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';

// Ejecuta procedimientos de consulta que devuelven un SYS_REFCURSOR y libera sus recursos.
export async function consultarProcedimiento(nombreProcedimiento) {
  let conexion;
  let cursor;

  try {
    conexion = await obtenerConexion();
    const resultado = await conexion.execute(
      `BEGIN PKG_CONSULTAS.${nombreProcedimiento}(:salida); END;`,
      { salida: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR } },
    );

    cursor = resultado.outBinds.salida;
    return await cursor.getRows(1000);
  } finally {
    if (cursor) {
      await cursor.close();
    }

    if (conexion) {
      await conexion.close();
    }
  }
}
