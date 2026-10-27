import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';

const formatoFilas = { outFormat: oracledb.OUT_FORMAT_OBJECT };
const nombreRolAdministrativo = 'ADMINISTRADOR';

// Devuelve únicamente los roles activos que pueden asignarse desde administración.
export async function consultarRolesDisponibles() {
  const conexion = await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      `SELECT ID_ROL, NOMBRE, DESCRIPCION, ESTADO
         FROM ROL
        WHERE ESTADO = 'A'
        ORDER BY NOMBRE`,
      [],
      formatoFilas,
    );
    return resultado.rows;
  } finally {
    await conexion.close();
  }
}

// Consulta los roles actuales de una cuenta sin exponer datos de autenticación.
export async function consultarRolesUsuario(identificadorUsuario) {
  const conexion = await obtenerConexion();
  try {
    await verificarUsuarioExiste(conexion, identificadorUsuario);
    const resultado = await conexion.execute(
      `SELECT r.ID_ROL, r.NOMBRE, r.DESCRIPCION, r.ESTADO
         FROM USUARIO_ROL ur
         JOIN ROL r ON r.ID_ROL = ur.ID_ROL
        WHERE ur.ID_USUARIO = :identificadorUsuario
        ORDER BY r.NOMBRE`,
      { identificadorUsuario },
      formatoFilas,
    );
    return resultado.rows;
  } finally {
    await conexion.close();
  }
}

// Asigna un rol existente y activo dentro de una transacción.
export async function asignarRolUsuario(identificadorUsuario, identificadorRol, identificadorSolicitante) {
  const conexion = await obtenerConexion();
  try {
    await verificarUsuarioExiste(conexion, identificadorUsuario);
    const rol = await obtenerRol(conexion, identificadorRol, true);
    await verificarAutorizacionRolAdministrativo(conexion, rol.NOMBRE, identificadorSolicitante);

    const existente = await conexion.execute(
      'SELECT 1 FROM USUARIO_ROL WHERE ID_USUARIO = :identificadorUsuario AND ID_ROL = :identificadorRol',
      { identificadorUsuario, identificadorRol },
      formatoFilas,
    );
    if (existente.rows.length) {
      throw crearError('El rol ya está asignado al usuario', 409);
    }

    await conexion.execute(
      'INSERT INTO USUARIO_ROL (ID_USUARIO, ID_ROL) VALUES (:identificadorUsuario, :identificadorRol)',
      { identificadorUsuario, identificadorRol },
    );
    await conexion.commit();
    return consultarRolesUsuario(identificadorUsuario);
  } catch (error) {
    await conexion.rollback();
    if (error.errorNum === 1) error.codigoEstado = 409;
    throw error;
  } finally {
    await conexion.close();
  }
}

// Retira una asociación sin eliminar el usuario ni el catálogo de roles.
export async function retirarRolUsuario(identificadorUsuario, identificadorRol, identificadorSolicitante) {
  const conexion = await obtenerConexion();
  try {
    await verificarUsuarioExiste(conexion, identificadorUsuario);
    const rol = await obtenerRol(conexion, identificadorRol, false);
    await verificarAutorizacionRolAdministrativo(conexion, rol.NOMBRE, identificadorSolicitante);

    const asociacion = await conexion.execute(
      'SELECT 1 FROM USUARIO_ROL WHERE ID_USUARIO = :identificadorUsuario AND ID_ROL = :identificadorRol',
      { identificadorUsuario, identificadorRol },
      formatoFilas,
    );
    if (!asociacion.rows.length) {
      throw crearError('El rol no está asignado al usuario', 404);
    }

    if (rol.NOMBRE === nombreRolAdministrativo && await contarAdministradoresActivos(conexion) <= 1) {
      throw crearError('No puede retirar el último acceso administrativo disponible', 409);
    }

    await conexion.execute(
      'DELETE FROM USUARIO_ROL WHERE ID_USUARIO = :identificadorUsuario AND ID_ROL = :identificadorRol',
      { identificadorUsuario, identificadorRol },
    );
    await conexion.commit();
    return consultarRolesUsuario(identificadorUsuario);
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    await conexion.close();
  }
}

async function verificarUsuarioExiste(conexion, identificadorUsuario) {
  const resultado = await conexion.execute(
    'SELECT 1 FROM USUARIO WHERE ID_USUARIO = :identificadorUsuario',
    { identificadorUsuario },
    formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('Usuario no encontrado', 404);
}

async function obtenerRol(conexion, identificadorRol, soloActivo) {
  const condicionEstado = soloActivo ? " AND ESTADO = 'A'" : '';
  const resultado = await conexion.execute(
    `SELECT ID_ROL, NOMBRE, ESTADO FROM ROL WHERE ID_ROL = :identificadorRol${condicionEstado}`,
    { identificadorRol },
    formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('Rol no encontrado o inactivo', 404);
  return resultado.rows[0];
}

async function verificarAutorizacionRolAdministrativo(conexion, nombreRol, identificadorSolicitante) {
  if (nombreRol !== nombreRolAdministrativo) return;
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
    throw crearError('Solo un administrador puede administrar el rol ADMINISTRADOR', 403);
  }
}

async function contarAdministradoresActivos(conexion) {
  const resultado = await conexion.execute(
    `SELECT COUNT(DISTINCT ur.ID_USUARIO) AS CANTIDAD
       FROM USUARIO_ROL ur
       JOIN USUARIO u ON u.ID_USUARIO = ur.ID_USUARIO
       JOIN ROL r ON r.ID_ROL = ur.ID_ROL
      WHERE r.NOMBRE = :nombreRol
        AND r.ESTADO = 'A'
        AND u.ESTADO = 'A'
        AND u.BLOQUEADO = 'N'`,
    { nombreRol: nombreRolAdministrativo },
    formatoFilas,
  );
  return resultado.rows[0].CANTIDAD;
}

function crearError(mensaje, codigoEstado) {
  const error = new Error(mensaje);
  error.codigoEstado = codigoEstado;
  return error;
}
