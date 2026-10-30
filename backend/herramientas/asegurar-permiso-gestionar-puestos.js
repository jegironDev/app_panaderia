import dotenv from 'dotenv';
import oracledb from 'oracledb';

dotenv.config({ path: new URL('../.env', import.meta.url) });
const conexion = await oracledb.getConnection({ user: process.env.BD_USUARIO_NUEVO, password: process.env.BD_CONTRASENA_NUEVO, connectString: process.env.BD_CADENA_CONEXION });
const formato = { outFormat: oracledb.OUT_FORMAT_OBJECT };

try {
  const destino = await conexion.execute(`SELECT SYS_CONTEXT('USERENV','CURRENT_SCHEMA') ESQUEMA, SYS_CONTEXT('USERENV','CON_NAME') PDB FROM DUAL`, [], formato);
  if (destino.rows[0].ESQUEMA !== 'DB_PANADERIA' || destino.rows[0].PDB !== 'XEPDB1') throw new Error('Destino inesperado.');
  let permiso = await conexion.execute(`SELECT ID_PERMISO FROM PERMISO WHERE CODIGO = 'GESTIONAR_PUESTOS'`, [], formato);
  let identificadorPermiso = permiso.rows[0]?.ID_PERMISO;
  if (!identificadorPermiso) {
    const creado = await conexion.execute(
      `INSERT INTO PERMISO (CODIGO, DESCRIPCION) VALUES ('GESTIONAR_PUESTOS', 'Administrar puestos y permisos') RETURNING ID_PERMISO INTO :identificador`,
      { identificador: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
    );
    identificadorPermiso = creado.outBinds.identificador[0];
  }
  const administrador = await conexion.execute(`SELECT ID_ROL FROM ROL WHERE NOMBRE = 'ADMINISTRADOR' AND ESTADO = 'A'`, [], formato);
  if (!administrador.rows.length) throw new Error('No existe el puesto administrativo activo.');
  const asignacion = await conexion.execute(`SELECT 1 FROM ROL_PERMISO WHERE ID_ROL = :rol AND ID_PERMISO = :permiso`, { rol: administrador.rows[0].ID_ROL, permiso: identificadorPermiso }, formato);
  if (!asignacion.rows.length) await conexion.execute(`INSERT INTO ROL_PERMISO (ID_ROL, ID_PERMISO) VALUES (:rol, :permiso)`, { rol: administrador.rows[0].ID_ROL, permiso: identificadorPermiso });
  await conexion.commit();
  console.log('Permiso de gestión de puestos disponible para el puesto administrativo.');
} catch (error) { await conexion.rollback(); throw error; } finally { await conexion.close(); }
