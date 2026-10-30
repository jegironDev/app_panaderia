import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';

const formato = { outFormat: oracledb.OUT_FORMAT_OBJECT };

export async function listarPuestos(incluirInactivos = false) {
  const conexion = await obtenerConexion();
  try {
    const condicion = incluirInactivos ? '' : "WHERE r.ESTADO = 'A'";
    const resultado = await conexion.execute(
      `SELECT r.ID_ROL, r.NOMBRE, r.DESCRIPCION, r.ESTADO,
              COUNT(CASE WHEN u.ESTADO = 'A' AND u.BLOQUEADO = 'N' THEN 1 END) AS USUARIOS_ACTIVOS,
              COUNT(ur.ID_USUARIO) AS USUARIOS_ASIGNADOS
         FROM ROL r
         LEFT JOIN USUARIO_ROL ur ON ur.ID_ROL = r.ID_ROL
         LEFT JOIN USUARIO u ON u.ID_USUARIO = ur.ID_USUARIO
         ${condicion}
        GROUP BY r.ID_ROL, r.NOMBRE, r.DESCRIPCION, r.ESTADO
        ORDER BY r.NOMBRE`, [], formato,
    );
    return resultado.rows;
  } finally { await conexion.close(); }
}

export async function consultarPuesto(identificadorPuesto) {
  const conexion = await obtenerConexion();
  try {
    const puesto = await obtenerPuesto(conexion, identificadorPuesto, false);
    const permisos = await conexion.execute(
      `SELECT p.ID_PERMISO, p.CODIGO, p.DESCRIPCION
         FROM ROL_PERMISO rp JOIN PERMISO p ON p.ID_PERMISO = rp.ID_PERMISO
        WHERE rp.ID_ROL = :identificadorPuesto ORDER BY p.CODIGO`,
      { identificadorPuesto }, formato,
    );
    return { ...puesto, PERMISOS: permisos.rows };
  } finally { await conexion.close(); }
}

export async function crearPuesto(datos) {
  const conexion = await obtenerConexion();
  try {
    await verificarNombreDisponible(conexion, datos.nombre);
    await verificarPermisos(conexion, datos.identificadoresPermisos);
    const resultado = await conexion.execute(
      `INSERT INTO ROL (NOMBRE, DESCRIPCION, ESTADO)
       VALUES (:nombre, :descripcion, 'A') RETURNING ID_ROL INTO :identificadorPuesto`,
      { nombre: datos.nombre, descripcion: datos.descripcion, identificadorPuesto: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
    );
    const identificadorPuesto = resultado.outBinds.identificadorPuesto[0];
    await reemplazarPermisos(conexion, identificadorPuesto, datos.identificadoresPermisos);
    await conexion.commit();
    return consultarPuesto(identificadorPuesto);
  } catch (error) { await conexion.rollback(); throw error; } finally { await conexion.close(); }
}

export async function editarPuesto(identificadorPuesto, datos, identificadorSolicitante) {
  const conexion = await obtenerConexion();
  try {
    const actual = await obtenerPuesto(conexion, identificadorPuesto, false);
    await verificarNombreDisponible(conexion, datos.nombre, identificadorPuesto);
    await verificarPermisos(conexion, datos.identificadoresPermisos);
    await protegerUltimoAccesoAdministrativo(conexion, actual, datos.identificadoresPermisos, identificadorSolicitante);
    await conexion.execute(
      `UPDATE ROL SET NOMBRE = :nombre, DESCRIPCION = :descripcion WHERE ID_ROL = :identificadorPuesto`,
      { nombre: datos.nombre, descripcion: datos.descripcion, identificadorPuesto },
    );
    await reemplazarPermisos(conexion, identificadorPuesto, datos.identificadoresPermisos);
    await sincronizarTextoPuesto(conexion, identificadorPuesto, datos.nombre);
    await conexion.commit();
    return consultarPuesto(identificadorPuesto);
  } catch (error) { await conexion.rollback(); throw error; } finally { await conexion.close(); }
}

export async function cambiarEstadoPuesto(identificadorPuesto, estado) {
  const conexion = await obtenerConexion();
  try {
    const puesto = await obtenerPuesto(conexion, identificadorPuesto, false);
    if (estado === 'I') {
      const usuarios = await conexion.execute(
        `SELECT COUNT(*) AS CANTIDAD FROM USUARIO_ROL ur JOIN USUARIO u ON u.ID_USUARIO = ur.ID_USUARIO
          WHERE ur.ID_ROL = :identificadorPuesto AND u.ESTADO = 'A' AND u.BLOQUEADO = 'N'`,
        { identificadorPuesto }, formato,
      );
      if (Number(usuarios.rows[0].CANTIDAD) > 0) throw crearError('No puede desactivar un puesto con usuarios activos asignados.', 409);
      if (puesto.NOMBRE === 'ADMINISTRADOR') throw crearError('No puede desactivar el puesto administrativo protegido.', 409);
    }
    await conexion.execute(`UPDATE ROL SET ESTADO = :estado WHERE ID_ROL = :identificadorPuesto`, { estado, identificadorPuesto });
    await conexion.commit();
    return consultarPuesto(identificadorPuesto);
  } catch (error) { await conexion.rollback(); throw error; } finally { await conexion.close(); }
}

export async function obtenerPuestoActivo(conexion, identificadorPuesto) {
  return obtenerPuesto(conexion, identificadorPuesto, true);
}

async function obtenerPuesto(conexion, identificadorPuesto, soloActivo) {
  const resultado = await conexion.execute(
    `SELECT ID_ROL, NOMBRE, DESCRIPCION, ESTADO FROM ROL
      WHERE ID_ROL = :identificadorPuesto${soloActivo ? " AND ESTADO = 'A'" : ''}`,
    { identificadorPuesto }, formato,
  );
  if (!resultado.rows.length) throw crearError('Puesto no encontrado o inactivo.', 404);
  return resultado.rows[0];
}

async function verificarNombreDisponible(conexion, nombre, identificadorExcluir = null) {
  const resultado = await conexion.execute(
    `SELECT 1 FROM ROL WHERE UPPER(TRIM(NOMBRE)) = UPPER(TRIM(:nombre))
      ${identificadorExcluir ? 'AND ID_ROL <> :identificadorExcluir' : ''}`,
    identificadorExcluir ? { nombre, identificadorExcluir } : { nombre }, formato,
  );
  if (resultado.rows.length) throw crearError('Ya existe un puesto con ese nombre.', 409);
}

async function verificarPermisos(conexion, identificadores) {
  if (!identificadores.length) return;
  const resultado = await conexion.execute(
    `SELECT COUNT(*) AS CANTIDAD FROM PERMISO WHERE ID_PERMISO IN (${identificadores.map((_, indice) => `:permiso${indice}`).join(', ')})`,
    Object.fromEntries(identificadores.map((identificador, indice) => [`permiso${indice}`, identificador])), formato,
  );
  if (Number(resultado.rows[0].CANTIDAD) !== identificadores.length) throw crearError('Uno o más permisos no existen.', 404);
}

async function reemplazarPermisos(conexion, identificadorPuesto, identificadores) {
  await conexion.execute('DELETE FROM ROL_PERMISO WHERE ID_ROL = :identificadorPuesto', { identificadorPuesto });
  for (const identificadorPermiso of identificadores) {
    await conexion.execute('INSERT INTO ROL_PERMISO (ID_ROL, ID_PERMISO) VALUES (:identificadorPuesto, :identificadorPermiso)', { identificadorPuesto, identificadorPermiso });
  }
}

async function sincronizarTextoPuesto(conexion, identificadorPuesto, nombre) {
  await conexion.execute(
    `UPDATE USUARIO SET PUESTO = :nombre
      WHERE ID_USUARIO IN (SELECT ID_USUARIO FROM USUARIO_ROL WHERE ID_ROL = :identificadorPuesto)`,
    { nombre, identificadorPuesto },
  );
}

async function protegerUltimoAccesoAdministrativo(conexion, puesto, permisos, identificadorSolicitante) {
  if (puesto.NOMBRE !== 'ADMINISTRADOR') return;
  const permisoAdministrar = await conexion.execute(`SELECT ID_PERMISO FROM PERMISO WHERE CODIGO = 'GESTIONAR_PUESTOS'`, [], formato);
  const identificadorPermiso = permisoAdministrar.rows[0]?.ID_PERMISO;
  if (identificadorPermiso && !permisos.includes(identificadorPermiso)) {
    const administradores = await conexion.execute(
      `SELECT COUNT(*) AS CANTIDAD FROM USUARIO_ROL ur JOIN USUARIO u ON u.ID_USUARIO = ur.ID_USUARIO
        WHERE ur.ID_ROL = :identificadorPuesto AND u.ESTADO = 'A' AND u.BLOQUEADO = 'N'`,
      { identificadorPuesto: puesto.ID_ROL }, formato,
    );
    if (Number(administradores.rows[0].CANTIDAD) <= 1) throw crearError('No puede retirar el último acceso para administrar puestos.', 409);
  }
  if (!identificadorSolicitante) throw crearError('No se pudo validar al responsable de la modificación.', 403);
}

export function validarDatosPuesto(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw crearError('Los datos del puesto no son válidos.', 400);
  const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim().toUpperCase() : '';
  const descripcion = datos.descripcion == null || datos.descripcion === '' ? null : String(datos.descripcion).trim();
  if (!nombre || nombre.length > 50 || (descripcion && descripcion.length > 200)) throw crearError('El nombre o la descripción del puesto no son válidos.', 400);
  if (!Array.isArray(datos.identificadoresPermisos)) throw crearError('Debe enviar la selección de permisos.', 400);
  const identificadoresPermisos = datos.identificadoresPermisos.map(Number);
  if (identificadoresPermisos.some(identificador => !Number.isInteger(identificador) || identificador <= 0) || new Set(identificadoresPermisos).size !== identificadoresPermisos.length) throw crearError('La selección de permisos no es válida.', 400);
  return { nombre, descripcion, identificadoresPermisos };
}

function crearError(mensaje, codigoEstado) { const error = new Error(mensaje); error.codigoEstado = codigoEstado; error.mensajeCliente = mensaje; return error; }
