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

// Variante tipada para nuevos formularios; no altera el cursor posicional legado.
export async function consultarProductosDetallados(tipo = null, conexionExterna = null) {
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const condicionTipo = tipo ? ' AND p.TIPO = :tipo' : '';
    const resultado = await conexion.execute(
      `SELECT p.ID_PRODUCTO, p.NOMBRE, p.TIPO, p.PRECIO,
              p.ID_UNIDAD_MEDIDA, um.NOMBRE AS NOMBRE_UNIDAD_MEDIDA,
              um.ABREVIATURA
         FROM PRODUCTO p
         JOIN UNIDAD_MEDIDA um ON um.ID_UNIDAD_MEDIDA = p.ID_UNIDAD_MEDIDA
        WHERE p.ESTADO = 'A'${condicionTipo}
        ORDER BY p.NOMBRE, p.TIPO, um.NOMBRE, p.ID_PRODUCTO`,
      tipo ? { tipo } : {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return resultado.rows;
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

// Devuelve las unidades activas requeridas por los formularios de recetas.
export async function consultarUnidadesMedidaActivas(conexionExterna = null) {
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      `SELECT ID_UNIDAD_MEDIDA, NOMBRE, ABREVIATURA
         FROM UNIDAD_MEDIDA
        WHERE ESTADO = :estado
        ORDER BY NOMBRE`,
      { estado: 'A' },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return resultado.rows;
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

// La vista contiene el saldo físico, reservado y disponible ya calculado por Oracle.
export async function consultarStockDisponible() {
  const conexion = await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      `SELECT ID_PRODUCTO, NOMBRE, TIPO, UNIDAD AS ABREVIATURA,
              CANTIDAD, CANTIDAD_RESERVADA, DISPONIBLE, EXISTENCIA_MINIMA, ALERTA
         FROM VW_STOCK_DISPONIBLE
        ORDER BY NOMBRE, ID_PRODUCTO`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return resultado.rows;
  } finally { await conexion.close(); }
}
