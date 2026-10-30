import dotenv from 'dotenv';
import oracledb from 'oracledb';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const permisos = [
  ['GESTIONAR_RUTAS', 'Crear, editar, activar y desactivar rutas'],
  ['CONSULTAR_RUTAS', 'Consultar rutas y ejecuciones de despacho'],
  ['RESOLVER_REORDENAMIENTOS', 'Autorizar o rechazar solicitudes de reordenamiento'],
  ['CONSULTAR_MI_RUTA', 'Consultar únicamente las entregas asignadas al piloto'],
  ['SOLICITAR_REORDENAMIENTO', 'Solicitar cambios de posición en entregas propias'],
];
const asignaciones = {
  ADMINISTRADOR: permisos.map(([codigo]) => codigo),
  COORDINADOR_DESPACHO: ['GESTIONAR_RUTAS', 'CONSULTAR_RUTAS', 'RESOLVER_REORDENAMIENTOS'],
  PILOTO: ['CONSULTAR_MI_RUTA', 'SOLICITAR_REORDENAMIENTO'],
};

const conexion = await oracledb.getConnection({
  user: process.env.BD_USUARIO_NUEVO,
  password: process.env.BD_CONTRASENA_NUEVO,
  connectString: process.env.BD_CADENA_CONEXION,
});

try {
  const destino = await conexion.execute(`SELECT SYS_CONTEXT('USERENV','CURRENT_SCHEMA') ESQUEMA, SYS_CONTEXT('USERENV','CON_NAME') PDB FROM DUAL`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
  if (destino.rows[0].ESQUEMA !== 'DB_PANADERIA' || destino.rows[0].PDB !== 'XEPDB1') throw new Error('Destino inesperado.');
  const identificadores = new Map();
  for (const [codigo, descripcion] of permisos) {
    const existente = await conexion.execute('SELECT ID_PERMISO FROM PERMISO WHERE CODIGO = :codigo', { codigo }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    let identificador = existente.rows[0]?.ID_PERMISO;
    if (!identificador) {
      const creado = await conexion.execute(`INSERT INTO PERMISO (CODIGO, DESCRIPCION) VALUES (:codigo, :descripcion) RETURNING ID_PERMISO INTO :salida`, { codigo, descripcion, salida: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } });
      identificador = creado.outBinds.salida[0];
    }
    identificadores.set(codigo, identificador);
  }
  for (const [rol, codigos] of Object.entries(asignaciones)) {
    const resultadoRol = await conexion.execute(`SELECT ID_ROL FROM ROL WHERE NOMBRE = :rol AND ESTADO = 'A'`, { rol }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (!resultadoRol.rows[0]) throw new Error(`No existe el puesto ${rol}.`);
    for (const codigo of codigos) {
      const idPermiso = identificadores.get(codigo);
      const existe = await conexion.execute(`SELECT 1 FROM ROL_PERMISO WHERE ID_ROL = :rol AND ID_PERMISO = :permiso`, { rol: resultadoRol.rows[0].ID_ROL, permiso: idPermiso }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (!existe.rows.length) await conexion.execute(`INSERT INTO ROL_PERMISO (ID_ROL, ID_PERMISO) VALUES (:rol, :permiso)`, { rol: resultadoRol.rows[0].ID_ROL, permiso: idPermiso });
    }
  }
  await conexion.commit();
  console.log('Permisos de distribución configurados.');
} catch (error) {
  await conexion.rollback();
  throw error;
} finally {
  await conexion.close();
}
