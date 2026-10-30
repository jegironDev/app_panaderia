import dotenv from 'dotenv';
import oracledb from 'oracledb';
dotenv.config({ path: new URL('../.env', import.meta.url) });
const conexion = await oracledb.getConnection({ user: process.env.BD_USUARIO_NUEVO, password: process.env.BD_CONTRASENA_NUEVO, connectString: process.env.BD_CADENA_CONEXION });
try {
  const destino = await conexion.execute(`SELECT SYS_CONTEXT('USERENV','CURRENT_SCHEMA') ESQUEMA,SYS_CONTEXT('USERENV','CON_NAME') PDB FROM DUAL`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
  if (destino.rows[0].ESQUEMA !== 'DB_PANADERIA' || destino.rows[0].PDB !== 'XEPDB1') throw new Error('Destino inesperado.');
  let permiso = await conexion.execute(`SELECT ID_PERMISO FROM PERMISO WHERE CODIGO='GESTIONAR_PRODUCTOS'`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
  let idPermiso = permiso.rows[0]?.ID_PERMISO;
  if (!idPermiso) { const creado = await conexion.execute(`INSERT INTO PERMISO(CODIGO,DESCRIPCION) VALUES('GESTIONAR_PRODUCTOS','Administrar catálogo de productos') RETURNING ID_PERMISO INTO :salida`, { salida: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }); idPermiso = creado.outBinds.salida[0]; }
  const rol = await conexion.execute(`SELECT ID_ROL FROM ROL WHERE NOMBRE='ADMINISTRADOR' AND ESTADO='A'`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
  if (!rol.rows.length) throw new Error('No existe ADMINISTRADOR activo.');
  const existe = await conexion.execute(`SELECT 1 FROM ROL_PERMISO WHERE ID_ROL=:rol AND ID_PERMISO=:permiso`, { rol: rol.rows[0].ID_ROL, permiso: idPermiso }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
  if (!existe.rows.length) await conexion.execute(`INSERT INTO ROL_PERMISO(ID_ROL,ID_PERMISO) VALUES(:rol,:permiso)`, { rol: rol.rows[0].ID_ROL, permiso: idPermiso });
  await conexion.commit(); console.log('Permiso de gestión de productos disponible.');
} catch (error) { await conexion.rollback(); throw error; } finally { await conexion.close(); }
