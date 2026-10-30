import dotenv from 'dotenv';
import oracledb from 'oracledb';

dotenv.config({ path: new URL('../.env', import.meta.url) });
const conexion = await oracledb.getConnection({ user: process.env.BD_USUARIO_NUEVO, password: process.env.BD_CONTRASENA_NUEVO, connectString: process.env.BD_CADENA_CONEXION });
const formato = { outFormat: oracledb.OUT_FORMAT_OBJECT };
try {
  const destino = await conexion.execute(`SELECT SYS_CONTEXT('USERENV','CURRENT_SCHEMA') ESQUEMA, SYS_CONTEXT('USERENV','CON_NAME') PDB FROM DUAL`, [], formato);
  if (destino.rows[0].ESQUEMA !== 'DB_PANADERIA' || destino.rows[0].PDB !== 'XEPDB1') throw new Error('Destino inesperado.');
  const columnas = await conexion.execute(`SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE, DATA_DEFAULT FROM USER_TAB_COLUMNS WHERE TABLE_NAME='PRODUCTO' ORDER BY COLUMN_ID`, [], formato);
  const restricciones = await conexion.execute(`SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE, SEARCH_CONDITION FROM USER_CONSTRAINTS WHERE TABLE_NAME='PRODUCTO' ORDER BY CONSTRAINT_NAME`, [], formato);
  const productos = await conexion.execute(`SELECT ID_PRODUCTO,NOMBRE,TIPO,ID_UNIDAD_MEDIDA,PRECIO,ESTADO FROM PRODUCTO ORDER BY ID_PRODUCTO`, [], formato);
  const dependencias = await conexion.execute(`SELECT r.TABLE_NAME, COUNT(*) REFERENCIAS FROM USER_CONS_COLUMNS c JOIN USER_CONSTRAINTS r ON r.CONSTRAINT_NAME=c.CONSTRAINT_NAME WHERE r.CONSTRAINT_TYPE='R' AND r.R_CONSTRAINT_NAME IN (SELECT p.CONSTRAINT_NAME FROM USER_CONSTRAINTS p WHERE p.TABLE_NAME='PRODUCTO' AND p.CONSTRAINT_TYPE IN ('P','U')) GROUP BY r.TABLE_NAME ORDER BY r.TABLE_NAME`, [], formato);
  console.log(JSON.stringify({ columnas: columnas.rows, restricciones: restricciones.rows, productos: productos.rows, dependencias: dependencias.rows }));
} finally { await conexion.close(); }
