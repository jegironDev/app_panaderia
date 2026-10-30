import dotenv from 'dotenv';
import oracledb from 'oracledb';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const conexion = await oracledb.getConnection({
  user: process.env.BD_USUARIO_NUEVO,
  password: process.env.BD_CONTRASENA_NUEVO,
  connectString: process.env.BD_CADENA_CONEXION,
});

try {
  const identidad = await conexion.execute(
    `SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AS ESQUEMA,
            SYS_CONTEXT('USERENV', 'CON_NAME') AS PDB
       FROM DUAL`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  if (identidad.rows[0].ESQUEMA !== 'DB_PANADERIA' || identidad.rows[0].PDB !== 'XEPDB1') {
    throw new Error('La migración no está conectada al destino autorizado.');
  }
  const pedidos = await conexion.execute('SELECT COUNT(*) AS TOTAL FROM PEDIDO', [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
  if (Number(pedidos.rows[0].TOTAL) !== 0) {
    throw new Error('No se agregan importes históricos automáticamente cuando existen pedidos.');
  }
  const columnas = await conexion.execute(
    `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME = 'DETALLE_PEDIDO'
        AND COLUMN_NAME IN ('PRECIO_UNITARIO', 'SUBTOTAL')`,
    [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const existentes = new Set(columnas.rows.map(fila => fila.COLUMN_NAME));
  if (!existentes.has('PRECIO_UNITARIO')) {
    await conexion.execute('ALTER TABLE DETALLE_PEDIDO ADD (PRECIO_UNITARIO NUMBER(12,2) DEFAULT 0 NOT NULL)');
  }
  if (!existentes.has('SUBTOTAL')) {
    await conexion.execute('ALTER TABLE DETALLE_PEDIDO ADD (SUBTOTAL NUMBER(14,2) DEFAULT 0 NOT NULL)');
  }
  console.log('Compatibilidad de importes de pedidos verificada en DB_PANADERIA.');
} finally {
  await conexion.close();
}
