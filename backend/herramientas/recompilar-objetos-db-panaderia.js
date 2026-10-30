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
       FROM DUAL`,
    [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  if (identidad.rows[0].ESQUEMA !== 'DB_PANADERIA' || identidad.rows[0].PDB !== 'XEPDB1') {
    throw new Error('La recompilación no está conectada al destino autorizado.');
  }
  await conexion.execute('ALTER PACKAGE PKG_INVENTARIO COMPILE BODY');
  await conexion.execute('ALTER VIEW VW_PEDIDOS_RESUMEN COMPILE');
  const invalidos = await conexion.execute(
    `SELECT OBJECT_TYPE, OBJECT_NAME
       FROM USER_OBJECTS
      WHERE STATUS = 'INVALID'
      ORDER BY OBJECT_TYPE, OBJECT_NAME`,
    [], { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  console.log(`Objetos inválidos restantes: ${invalidos.rows.length}`);
  for (const objeto of invalidos.rows) console.log(`${objeto.OBJECT_TYPE} ${objeto.OBJECT_NAME}`);
} finally {
  await conexion.close();
}
