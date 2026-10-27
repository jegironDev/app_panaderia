import oracledb from 'oracledb';

const formatoFilas = { outFormat: oracledb.OUT_FORMAT_OBJECT };

export async function consultarSucursalesActivas(conexion) {
  const resultado = await conexion.execute(
    `SELECT ID_SUCURSAL, NOMBRE FROM SUCURSAL WHERE ESTADO = 'A' ORDER BY NOMBRE`,
    [],
    formatoFilas,
  );
  return resultado.rows;
}

export async function verificarSucursalActiva(conexion, identificadorSucursal) {
  const resultado = await conexion.execute(
    `SELECT ID_SUCURSAL FROM SUCURSAL
      WHERE ID_SUCURSAL = :identificadorSucursal AND ESTADO = 'A'`,
    { identificadorSucursal },
    formatoFilas,
  );
  if (!resultado.rows.length) {
    const error = new Error('Sucursal no encontrada o inactiva');
    error.codigoEstado = 404;
    throw error;
  }
}
