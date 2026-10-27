import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';

const formatoFilas = { outFormat: oracledb.OUT_FORMAT_OBJECT };
const nombreRolAdministrativo = 'ADMINISTRADOR';
const permisosAdministrativos = new Set([
  'GESTIONAR_USUARIOS', 'GESTIONAR_ROLES', 'GESTIONAR_PERMISOS',
  'CREAR_USUARIOS', 'EDITAR_USUARIOS', 'DESACTIVAR_USUARIOS',
]);

// El catálogo vigente no maneja estado; todos los permisos registrados son asignables.
export async function consultarPermisos() {
  const conexion = await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      'SELECT ID_PERMISO, CODIGO, DESCRIPCION FROM PERMISO ORDER BY CODIGO',
      [],
      formatoFilas,
    );
    return resultado.rows;
  } finally {
    await conexion.close();
  }
}

export async function consultarPermisosRol(identificadorRol) {
  const conexion = await obtenerConexion();
  try {
    await verificarRolExiste(conexion, identificadorRol, false);
    const resultado = await conexion.execute(
      `SELECT p.ID_PERMISO, p.CODIGO, p.DESCRIPCION
         FROM ROL_PERMISO rp
         JOIN PERMISO p ON p.ID_PERMISO = rp.ID_PERMISO
        WHERE rp.ID_ROL = :identificadorRol
        ORDER BY p.CODIGO`,
      { identificadorRol },
      formatoFilas,
    );
    return resultado.rows;
  } finally {
    await conexion.close();
  }
}

// Calcula permisos distintos de todos los roles activos asignados a una cuenta.
export async function consultarPermisosEfectivosUsuario(identificadorUsuario) {
  const conexion = await obtenerConexion();
  try {
    await verificarUsuarioExiste(conexion, identificadorUsuario);
    const resultado = await conexion.execute(
      `SELECT DISTINCT p.ID_PERMISO, p.CODIGO, p.DESCRIPCION
         FROM USUARIO_ROL ur
         JOIN ROL r ON r.ID_ROL = ur.ID_ROL AND r.ESTADO = 'A'
         JOIN ROL_PERMISO rp ON rp.ID_ROL = r.ID_ROL
         JOIN PERMISO p ON p.ID_PERMISO = rp.ID_PERMISO
        WHERE ur.ID_USUARIO = :identificadorUsuario
        ORDER BY p.CODIGO`,
      { identificadorUsuario },
      formatoFilas,
    );
    return resultado.rows;
  } finally {
    await conexion.close();
  }
}

export async function asignarPermisoRol(identificadorRol, identificadorPermiso, identificadorSolicitante) {
  const conexion = await obtenerConexion();
  try {
    const rol = await verificarRolExiste(conexion, identificadorRol, true);
    const permiso = await obtenerPermiso(conexion, identificadorPermiso);
    await verificarAutorizacionAdministrativa(conexion, rol.NOMBRE, permiso.CODIGO, identificadorSolicitante);

    const existente = await conexion.execute(
      'SELECT 1 FROM ROL_PERMISO WHERE ID_ROL = :identificadorRol AND ID_PERMISO = :identificadorPermiso',
      { identificadorRol, identificadorPermiso },
      formatoFilas,
    );
    if (existente.rows.length) throw crearError('El permiso ya está asignado al rol', 409);

    await conexion.execute(
      'INSERT INTO ROL_PERMISO (ID_ROL, ID_PERMISO) VALUES (:identificadorRol, :identificadorPermiso)',
      { identificadorRol, identificadorPermiso },
    );
    await conexion.commit();
    return consultarPermisosRol(identificadorRol);
  } catch (error) {
    await conexion.rollback();
    if (error.errorNum === 1) error.codigoEstado = 409;
    throw error;
  } finally {
    await conexion.close();
  }
}

export async function retirarPermisoRol(identificadorRol, identificadorPermiso, identificadorSolicitante) {
  const conexion = await obtenerConexion();
  try {
    const rol = await verificarRolExiste(conexion, identificadorRol, false);
    const permiso = await obtenerPermiso(conexion, identificadorPermiso);
    await verificarAutorizacionAdministrativa(conexion, rol.NOMBRE, permiso.CODIGO, identificadorSolicitante);

    const asociacion = await conexion.execute(
      'SELECT 1 FROM ROL_PERMISO WHERE ID_ROL = :identificadorRol AND ID_PERMISO = :identificadorPermiso',
      { identificadorRol, identificadorPermiso },
      formatoFilas,
    );
    if (!asociacion.rows.length) throw crearError('El permiso no está asignado al rol', 404);

    if (permisosAdministrativos.has(permiso.CODIGO) && await contarRolesConPermiso(conexion, permiso.CODIGO) <= 1) {
      throw crearError('No puede retirar el último acceso administrativo necesario', 409);
    }

    await conexion.execute(
      'DELETE FROM ROL_PERMISO WHERE ID_ROL = :identificadorRol AND ID_PERMISO = :identificadorPermiso',
      { identificadorRol, identificadorPermiso },
    );
    await conexion.commit();
    return consultarPermisosRol(identificadorRol);
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    await conexion.close();
  }
}

async function verificarRolExiste(conexion, identificadorRol, soloActivo) {
  const condicionEstado = soloActivo ? " AND ESTADO = 'A'" : '';
  const resultado = await conexion.execute(
    `SELECT ID_ROL, NOMBRE, ESTADO FROM ROL WHERE ID_ROL = :identificadorRol${condicionEstado}`,
    { identificadorRol },
    formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('Rol no encontrado o inactivo', 404);
  return resultado.rows[0];
}

async function obtenerPermiso(conexion, identificadorPermiso) {
  const resultado = await conexion.execute(
    'SELECT ID_PERMISO, CODIGO FROM PERMISO WHERE ID_PERMISO = :identificadorPermiso',
    { identificadorPermiso },
    formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('Permiso no encontrado', 404);
  return resultado.rows[0];
}

async function verificarUsuarioExiste(conexion, identificadorUsuario) {
  const resultado = await conexion.execute(
    'SELECT 1 FROM USUARIO WHERE ID_USUARIO = :identificadorUsuario',
    { identificadorUsuario },
    formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('Usuario no encontrado', 404);
}

async function verificarAutorizacionAdministrativa(conexion, nombreRol, codigoPermiso, identificadorSolicitante) {
  if (nombreRol !== nombreRolAdministrativo && !permisosAdministrativos.has(codigoPermiso)) return;
  const resultado = await conexion.execute(
    `SELECT 1
       FROM USUARIO_ROL ur
       JOIN ROL r ON r.ID_ROL = ur.ID_ROL
      WHERE ur.ID_USUARIO = :identificadorSolicitante
        AND r.NOMBRE = :nombreRol
        AND r.ESTADO = 'A'`,
    { identificadorSolicitante, nombreRol: nombreRolAdministrativo },
    formatoFilas,
  );
  if (!resultado.rows.length) {
    throw crearError('Solo un administrador puede modificar permisos administrativos', 403);
  }
}

async function contarRolesConPermiso(conexion, codigoPermiso) {
  const resultado = await conexion.execute(
    `SELECT COUNT(DISTINCT rp.ID_ROL) AS CANTIDAD
       FROM ROL_PERMISO rp
       JOIN ROL r ON r.ID_ROL = rp.ID_ROL
       JOIN PERMISO p ON p.ID_PERMISO = rp.ID_PERMISO
      WHERE r.ESTADO = 'A' AND p.CODIGO = :codigoPermiso`,
    { codigoPermiso },
    formatoFilas,
  );
  return resultado.rows[0].CANTIDAD;
}

function crearError(mensaje, codigoEstado) {
  const error = new Error(mensaje);
  error.codigoEstado = codigoEstado;
  return error;
}
