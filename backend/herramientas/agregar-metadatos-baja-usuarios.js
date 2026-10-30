import dotenv from 'dotenv';
import oracledb from 'oracledb';

dotenv.config({ path: new URL('../.env', import.meta.url) });
const conexion = await oracledb.getConnection({ user: process.env.BD_USUARIO_NUEVO, password: process.env.BD_CONTRASENA_NUEVO, connectString: process.env.BD_CADENA_CONEXION });

try {
  const destino = await conexion.execute(`SELECT SYS_CONTEXT('USERENV','CURRENT_SCHEMA') ESQUEMA, SYS_CONTEXT('USERENV','CON_NAME') PDB FROM DUAL`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
  if (destino.rows[0].ESQUEMA !== 'DB_PANADERIA' || destino.rows[0].PDB !== 'XEPDB1') throw new Error('Destino inesperado.');
  const columnas = await conexion.execute(`SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME='USUARIO' AND COLUMN_NAME IN ('FECHA_BAJA','ID_USUARIO_BAJA')`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
  const existentes = new Set(columnas.rows.map(fila => fila.COLUMN_NAME));
  if (!existentes.has('FECHA_BAJA')) await conexion.execute('ALTER TABLE USUARIO ADD (FECHA_BAJA TIMESTAMP NULL)');
  if (!existentes.has('ID_USUARIO_BAJA')) await conexion.execute('ALTER TABLE USUARIO ADD (ID_USUARIO_BAJA NUMBER NULL)');
  const restriccion = await conexion.execute(`SELECT CONSTRAINT_NAME FROM USER_CONSTRAINTS WHERE TABLE_NAME='USUARIO' AND CONSTRAINT_NAME='FK_USUARIO_BAJA'`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
  if (!restriccion.rows.length) await conexion.execute('ALTER TABLE USUARIO ADD CONSTRAINT FK_USUARIO_BAJA FOREIGN KEY (ID_USUARIO_BAJA) REFERENCES USUARIO(ID_USUARIO)');
  await conexion.commit();
  console.log('Metadatos de baja lógica disponibles.');
} catch (error) { await conexion.rollback(); throw error; } finally { await conexion.close(); }
