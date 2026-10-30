import dotenv from 'dotenv';
import oracledb from 'oracledb';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const conexion = await oracledb.getConnection({
  user: process.env.BD_USUARIO_NUEVO,
  password: process.env.BD_CONTRASENA_NUEVO,
  connectString: process.env.BD_CADENA_CONEXION,
});
const formato = { outFormat: oracledb.OUT_FORMAT_OBJECT };

try {
  const identidad = await conexion.execute(
    `SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') ESQUEMA,
            SYS_CONTEXT('USERENV', 'CON_NAME') PDB FROM DUAL`, [], formato,
  );
  if (identidad.rows[0].ESQUEMA !== 'DB_PANADERIA' || identidad.rows[0].PDB !== 'XEPDB1') throw new Error('Destino inesperado.');
  const tablas = ['ROL', 'PERMISO', 'ROL_PERMISO', 'USUARIO', 'USUARIO_ROL', 'INVENTARIO', 'DETALLE_INVENTARIO', 'DESPACHO', 'DETALLE_DESPACHO', 'ENTREGA', 'RUTA', 'PEDIDO', 'SOLICITUD_CANCELACION', 'BITACORA_PEDIDOS'];
  const columnas = await conexion.execute(
    `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, NULLABLE
       FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME IN (${tablas.map((_, indice) => `:tabla${indice}`).join(', ')})
      ORDER BY TABLE_NAME, COLUMN_ID`,
    Object.fromEntries(tablas.map((tabla, indice) => [`tabla${indice}`, tabla])), formato,
  );
  const porTabla = Object.groupBy(columnas.rows, fila => fila.TABLE_NAME);
  for (const tabla of tablas) console.log(`${tabla}: ${(porTabla[tabla] || []).map(fila => `${fila.COLUMN_NAME}:${fila.DATA_TYPE}${fila.NULLABLE === 'N' ? '!' : ''}`).join(', ')}`);
  const permisos = await conexion.execute('SELECT ID_PERMISO, CODIGO, DESCRIPCION FROM PERMISO ORDER BY ID_PERMISO', [], formato);
  console.log(`PERMISOS: ${JSON.stringify(permisos.rows)}`);
  const roles = await conexion.execute('SELECT ID_ROL, NOMBRE, DESCRIPCION, ESTADO FROM ROL ORDER BY ID_ROL', [], formato);
  console.log(`PUESTOS: ${JSON.stringify(roles.rows)}`);
  const tablasRelacionadas = await conexion.execute(
    `SELECT TABLE_NAME FROM USER_TABLES
      WHERE TABLE_NAME LIKE '%SOLICITUD%' OR TABLE_NAME LIKE '%DESPACH%' OR TABLE_NAME LIKE '%ENTREG%'
      ORDER BY TABLE_NAME`, [], formato,
  );
  console.log(`TABLAS_OPERATIVAS: ${tablasRelacionadas.rows.map(fila => fila.TABLE_NAME).join(', ')}`);
} finally { await conexion.close(); }
