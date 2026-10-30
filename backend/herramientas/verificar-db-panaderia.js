import dotenv from 'dotenv';
import oracledb from 'oracledb';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const conexion = await oracledb.getConnection({
  user: process.env.BD_USUARIO_NUEVO,
  password: process.env.BD_CONTRASENA_NUEVO,
  connectString: process.env.BD_CADENA_CONEXION,
});
const formatoFilas = { outFormat: oracledb.OUT_FORMAT_OBJECT };

try {
  const identidad = await conexion.execute(
    `SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AS ESQUEMA,
            SYS_CONTEXT('USERENV', 'CON_NAME') AS PDB
       FROM DUAL`, [], formatoFilas,
  );
  if (identidad.rows[0].ESQUEMA !== 'DB_PANADERIA' || identidad.rows[0].PDB !== 'XEPDB1') {
    throw new Error('La comprobación no está conectada a DB_PANADERIA en XEPDB1.');
  }
  const resumen = await conexion.execute(
    `SELECT (SELECT COUNT(*) FROM USER_TABLES) AS TABLAS,
            (SELECT COUNT(*) FROM USER_CONSTRAINTS WHERE CONSTRAINT_TYPE = 'R') AS CLAVES_FORANEAS,
            (SELECT COUNT(*) FROM USER_OBJECTS WHERE STATUS = 'INVALID') AS OBJETOS_INVALIDOS,
            (SELECT COUNT(*) FROM USUARIO) AS USUARIOS,
            (SELECT COUNT(*) FROM USUARIO_ROL) AS USUARIO_ROLES,
            (SELECT COUNT(*) FROM PRODUCTO) AS PRODUCTOS,
            (SELECT COUNT(*) FROM INVENTARIO) AS INVENTARIOS,
            (SELECT COUNT(*) FROM RECETA) AS RECETAS,
            (SELECT COUNT(*) FROM DETALLE_RECETA) AS DETALLES_RECETA,
            (SELECT COUNT(*) FROM ESTADO_PEDIDO) AS ESTADOS_PEDIDO,
            (SELECT COUNT(*) FROM ROL) AS ROLES,
            (SELECT COUNT(*) FROM PERMISO) AS PERMISOS,
            (SELECT COUNT(*) FROM ROL_PERMISO) AS ROL_PERMISOS
            ,(SELECT COUNT(*) FROM PEDIDO) AS PEDIDOS
            ,(SELECT COUNT(*) FROM PRODUCCION) AS PRODUCCIONES
            ,(SELECT COUNT(*) FROM RESERVA_INVENTARIO) AS RESERVAS
            ,(SELECT COUNT(*) FROM DETALLE_INVENTARIO) AS MOVIMIENTOS_INVENTARIO
       FROM DUAL`, [], formatoFilas,
  );
  console.log(`resumen: ${JSON.stringify(resumen.rows[0])}`);
  const estados = await conexion.execute(
    `SELECT NOMBRE FROM ESTADO_PEDIDO WHERE ESTADO = 'A' ORDER BY ID_ESTADO_PEDIDO`, [], formatoFilas,
  );
  console.log(`estados-activos: ${estados.rows.map(fila => fila.NOMBRE).join(', ')}`);
  const errores = await conexion.execute(
    `SELECT NAME, TYPE, LINE, POSITION, TEXT
       FROM USER_ERRORS
      ORDER BY NAME, SEQUENCE`, [], formatoFilas,
  );
  console.log(`errores-compilacion: ${errores.rows.length}`);
  for (const error of errores.rows) console.log(`${error.TYPE} ${error.NAME} ${error.LINE}:${error.POSITION} ${error.TEXT}`);
  const invalidos = await conexion.execute(
    `SELECT OBJECT_TYPE, OBJECT_NAME
       FROM USER_OBJECTS
      WHERE STATUS = 'INVALID'
      ORDER BY OBJECT_TYPE, OBJECT_NAME`, [], formatoFilas,
  );
  for (const objeto of invalidos.rows) console.log(`objeto-invalido: ${objeto.OBJECT_TYPE} ${objeto.OBJECT_NAME}`);
  const dependencias = await conexion.execute(
    `SELECT NAME, TYPE, REFERENCED_NAME, REFERENCED_TYPE
       FROM USER_DEPENDENCIES
      WHERE NAME IN ('PKG_INVENTARIO', 'VW_PEDIDOS_RESUMEN')
      ORDER BY NAME, TYPE, REFERENCED_TYPE, REFERENCED_NAME`, [], formatoFilas,
  );
  console.log(`dependencias-objetos-invalidos: ${JSON.stringify(dependencias.rows)}`);
  const columnas = await conexion.execute(
    `SELECT TABLE_NAME, COLUMN_NAME
       FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME IN ('PEDIDO', 'DETALLE_PEDIDO', 'PRODUCCION', 'DETALLE_PRODUCCION', 'RESERVA_INVENTARIO', 'INVENTARIO', 'DETALLE_INVENTARIO')
      ORDER BY TABLE_NAME, COLUMN_ID`, [], formatoFilas,
  );
  const agrupadas = Object.groupBy(columnas.rows, fila => fila.TABLE_NAME);
  for (const [tabla, filas] of Object.entries(agrupadas)) console.log(`columnas-${tabla}: ${filas.map(fila => fila.COLUMN_NAME).join(', ')}`);
  const permisosUsuarios = await conexion.execute(
    `SELECT u.USUARIO, LISTAGG(p.CODIGO, ', ') WITHIN GROUP (ORDER BY p.CODIGO) AS PERMISOS
       FROM USUARIO u
       JOIN USUARIO_ROL ur ON ur.ID_USUARIO = u.ID_USUARIO
       JOIN ROL_PERMISO rp ON rp.ID_ROL = ur.ID_ROL
       JOIN PERMISO p ON p.ID_PERMISO = rp.ID_PERMISO
      GROUP BY u.USUARIO
      ORDER BY u.USUARIO`, [], formatoFilas,
  );
  for (const fila of permisosUsuarios.rows) console.log(`permisos-${fila.USUARIO}: ${fila.PERMISOS}`);
} finally {
  await conexion.close();
}
