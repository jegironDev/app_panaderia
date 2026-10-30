import dotenv from 'dotenv';
import oracledb from 'oracledb';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const cadenaConexion = process.env.BD_CADENA_CONEXION;
const formatoFilas = { outFormat: oracledb.OUT_FORMAT_OBJECT };
const destinos = [
  { etiqueta: 'original', usuario: process.env.BD_USUARIO, contrasena: process.env.BD_CONTRASENA },
  { etiqueta: 'nuevo', usuario: process.env.BD_USUARIO_NUEVO, contrasena: process.env.BD_CONTRASENA_NUEVO },
];

for (const destino of destinos) {
  if (!destino.usuario || !destino.contrasena || !cadenaConexion) {
    throw new Error(`Falta la configuración privada requerida para el esquema ${destino.etiqueta}.`);
  }

  const conexion = await oracledb.getConnection({
    user: destino.usuario,
    password: destino.contrasena,
    connectString: cadenaConexion,
  });

  try {
    const resultado = await conexion.execute(
      `SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AS ESQUEMA,
              SYS_CONTEXT('USERENV', 'CON_NAME') AS PDB
         FROM DUAL`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    console.log(`${destino.etiqueta}: ${resultado.rows[0].ESQUEMA} en ${resultado.rows[0].PDB}`);
    if (destino.etiqueta === 'nuevo') {
      const resumen = await conexion.execute(
        `SELECT (SELECT COUNT(*) FROM USUARIO) AS USUARIOS,
                (SELECT COUNT(*) FROM USUARIO_ROL) AS USUARIO_ROL,
                (SELECT COUNT(*) FROM ROL WHERE ID_ROL BETWEEN 21 AND 27) AS ROLES_REQUERIDOS,
                (SELECT COUNT(*) FROM SUCURSAL WHERE ID_SUCURSAL IN (3, 4)) AS SUCURSALES_REQUERIDAS,
                (SELECT COUNT(*) FROM PRODUCTO) AS PRODUCTOS,
                (SELECT COUNT(*) FROM INVENTARIO) AS INVENTARIOS,
                (SELECT COUNT(*) FROM RECETA) AS RECETAS,
                (SELECT COUNT(*) FROM DETALLE_RECETA) AS DETALLES_RECETA
           FROM DUAL`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      console.log(`nuevo-resumen: ${JSON.stringify(resumen.rows[0])}`);
      const unidades = await conexion.execute(
        `SELECT ID_UNIDAD_MEDIDA, NOMBRE
           FROM UNIDAD_MEDIDA
          ORDER BY ID_UNIDAD_MEDIDA`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      console.log(`nuevo-unidades: ${unidades.rows.map(unidad => `${unidad.ID_UNIDAD_MEDIDA}:${unidad.NOMBRE}`).join(', ')}`);
    }
    const sucursales = await conexion.execute(
      `SELECT ID_SUCURSAL, NOMBRE, ESTADO
         FROM SUCURSAL
        ORDER BY ID_SUCURSAL`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    console.log(`${destino.etiqueta}-sucursales: ${sucursales.rows.map(sucursal => `${sucursal.ID_SUCURSAL}:${sucursal.NOMBRE}:${sucursal.ESTADO}`).join(', ')}`);
    const catalogos = await conexion.execute(
      `SELECT (SELECT COUNT(*) FROM JORNADA) AS JORNADAS,
              (SELECT COUNT(*) FROM RUTA) AS RUTAS,
              (SELECT COUNT(*) FROM PROVEEDOR) AS PROVEEDORES,
              (SELECT COUNT(*) FROM UNIDAD_MEDIDA) AS UNIDADES
         FROM DUAL`, [], formatoFilas,
    );
    console.log(`${destino.etiqueta}-catalogos: ${JSON.stringify(catalogos.rows[0])}`);
    const jornadas = await conexion.execute(
      `SELECT ID_JORNADA, NOMBRE, ESTADO FROM JORNADA ORDER BY ID_JORNADA`, [], formatoFilas,
    );
    console.log(`${destino.etiqueta}-jornadas: ${jornadas.rows.map(jornada => `${jornada.ID_JORNADA}:${jornada.NOMBRE}:${jornada.ESTADO}`).join(', ')}`);
    if (destino.etiqueta === 'original') {
      for (const tabla of ['JORNADA', 'RUTA', 'PROVEEDOR']) {
        const filas = await conexion.execute(`SELECT * FROM ${tabla} ORDER BY 1`, [], formatoFilas);
        console.log(`original-${tabla.toLowerCase()}: ${JSON.stringify(filas.rows)}`);
      }
    }
    if (destino.etiqueta === 'original') {
      const columnasPedido = await conexion.execute(
        `SELECT COLUMN_NAME, DATA_TYPE, DATA_PRECISION, DATA_SCALE, NULLABLE, DATA_DEFAULT
           FROM USER_TAB_COLUMNS
          WHERE TABLE_NAME = 'DETALLE_PEDIDO'
          ORDER BY COLUMN_ID`, [], formatoFilas,
      );
      console.log(`original-detalle-pedido: ${JSON.stringify(columnasPedido.rows)}`);
    }
    if (destino.etiqueta === 'nuevo') {
      const columnas = await conexion.execute(
        `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE, IDENTITY_COLUMN
           FROM USER_TAB_COLUMNS
          WHERE TABLE_NAME IN ('USUARIO', 'USUARIO_ROL', 'SUCURSAL')
          ORDER BY TABLE_NAME, COLUMN_ID`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      console.log(`nuevo-columnas: ${JSON.stringify(columnas.rows)}`);
      const identidades = await conexion.execute(
        `SELECT TABLE_NAME, COLUMN_NAME, GENERATION_TYPE
           FROM USER_TAB_IDENTITY_COLS
          WHERE TABLE_NAME IN ('USUARIO', 'SUCURSAL')
          ORDER BY TABLE_NAME`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      console.log(`nuevo-identidades: ${JSON.stringify(identidades.rows)}`);
    }
  } finally {
    await conexion.close();
  }
}
