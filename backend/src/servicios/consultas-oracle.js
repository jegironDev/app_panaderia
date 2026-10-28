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

// Consulta un tipo controlado de producto sin alterar el catálogo general existente.
export async function consultarProductosPorTipo(tipo) {
  const conexion = await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      `SELECT ID_PRODUCTO, NOMBRE, TIPO, PRECIO
         FROM PRODUCTO
        WHERE TIPO = :tipo AND ESTADO = 'A'
        ORDER BY NOMBRE`,
      { tipo },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return resultado.rows;
  } finally {
    await conexion.close();
  }
}
