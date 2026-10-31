import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';

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

export async function listarSucursalesAdministracion() {
  const conexion = await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      `SELECT ID_SUCURSAL, NOMBRE, ESTADO
         FROM SUCURSAL
        ORDER BY CASE ESTADO WHEN 'A' THEN 0 ELSE 1 END, NOMBRE`, [], formatoFilas,
    );
    return resultado.rows;
  } finally { await conexion.close(); }
}

export async function crearSucursal(nombre, identificadorResponsable, conexionExterna = null) {
  const conexion = conexionExterna || await obtenerConexion();
  try {
    // SUCURSAL no tiene una restricción única de nombre; este bloqueo mantiene atómica la validación frente a creaciones concurrentes.
    await conexion.execute('LOCK TABLE SUCURSAL IN SHARE ROW EXCLUSIVE MODE');
    const duplicada = await conexion.execute(
      `SELECT 1 FROM SUCURSAL WHERE UPPER(TRIM(NOMBRE)) = UPPER(TRIM(:nombre))`,
      { nombre }, formatoFilas,
    );
    if (duplicada.rows.length) throw crearError('Ya existe una sucursal con ese nombre.', 409);
    const creada = await conexion.execute(
      `INSERT INTO SUCURSAL (NOMBRE, ESTADO) VALUES (:nombre, 'A') RETURNING ID_SUCURSAL INTO :identificadorSucursal`,
      { nombre, identificadorSucursal: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
    );
    const identificadorSucursal = creada.outBinds.identificadorSucursal[0];
    await registrarBitacoraSucursal(conexion, identificadorSucursal, identificadorResponsable, 'CREACION', `Sucursal creada con nombre ${nombre}.`);
    if (!conexionExterna) await conexion.commit();
    return { ID_SUCURSAL: identificadorSucursal, NOMBRE: nombre, ESTADO: 'A' };
  } catch (error) {
    if (!conexionExterna) await conexion.rollback();
    throw error;
  } finally { if (!conexionExterna) await conexion.close(); }
}

export async function editarSucursal(identificadorSucursal, nombre, identificadorResponsable, conexionExterna = null) {
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const sucursal = await obtenerSucursalParaCambio(conexion, identificadorSucursal);
    if (sucursal.ESTADO !== 'A') throw crearError('No puede editar una sucursal inactiva.', 409);
    const duplicada = await conexion.execute(
      `SELECT 1 FROM SUCURSAL
        WHERE UPPER(TRIM(NOMBRE)) = UPPER(TRIM(:nombre)) AND ID_SUCURSAL <> :identificadorSucursal`,
      { nombre, identificadorSucursal }, formatoFilas,
    );
    if (duplicada.rows.length) throw crearError('Ya existe una sucursal con ese nombre.', 409);
    await conexion.execute(`UPDATE SUCURSAL SET NOMBRE = :nombre WHERE ID_SUCURSAL = :identificadorSucursal`, { nombre, identificadorSucursal });
    await registrarBitacoraSucursal(conexion, identificadorSucursal, identificadorResponsable, 'EDICION', `Nombre actualizado a ${nombre}.`);
    if (!conexionExterna) await conexion.commit();
    return { ID_SUCURSAL: identificadorSucursal, NOMBRE: nombre, ESTADO: 'A' };
  } catch (error) {
    if (!conexionExterna) await conexion.rollback();
    throw error;
  } finally { if (!conexionExterna) await conexion.close(); }
}

export async function inhabilitarSucursal(identificadorSucursal, identificadorResponsable, conexionExterna = null) {
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const sucursal = await obtenerSucursalParaCambio(conexion, identificadorSucursal);
    if (sucursal.ESTADO !== 'A') throw crearError('La sucursal ya está inactiva y no puede reactivarse desde esta operación.', 409);
    await verificarDependenciasActivas(conexion, identificadorSucursal);
    await conexion.execute(`UPDATE SUCURSAL SET ESTADO = 'I' WHERE ID_SUCURSAL = :identificadorSucursal`, { identificadorSucursal });
    await registrarBitacoraSucursal(conexion, identificadorSucursal, identificadorResponsable, 'INHABILITACION', 'Sucursal inhabilitada de forma irreversible.');
    if (!conexionExterna) await conexion.commit();
    return { ID_SUCURSAL: identificadorSucursal, NOMBRE: sucursal.NOMBRE, ESTADO: 'I' };
  } catch (error) {
    if (!conexionExterna) await conexion.rollback();
    throw error;
  } finally { if (!conexionExterna) await conexion.close(); }
}

async function obtenerSucursalParaCambio(conexion, identificadorSucursal) {
  const resultado = await conexion.execute(
    `SELECT ID_SUCURSAL, NOMBRE, ESTADO FROM SUCURSAL WHERE ID_SUCURSAL = :identificadorSucursal FOR UPDATE`,
    { identificadorSucursal }, formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('Sucursal no encontrada.', 404);
  return resultado.rows[0];
}

async function verificarDependenciasActivas(conexion, identificadorSucursal) {
  const comprobaciones = [
    [`SELECT COUNT(*) CANTIDAD FROM PEDIDO p JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO = p.ID_ESTADO_PEDIDO
       WHERE p.ID_SUCURSAL = :identificadorSucursal AND e.NOMBRE NOT IN ('ENTREGADO', 'CANCELADO', 'CANCELADA')`, 'pedidos operativos'],
    [`SELECT COUNT(*) CANTIDAD FROM ENTREGA_RUTA er JOIN PEDIDO p ON p.ID_PEDIDO = er.ID_PEDIDO
       WHERE p.ID_SUCURSAL = :identificadorSucursal AND er.ESTADO = 'PENDIENTE'`, 'entregas pendientes'],
    [`SELECT COUNT(*) CANTIDAD FROM DETALLE_RUTA dr JOIN RUTA r ON r.ID_RUTA = dr.ID_RUTA
       WHERE dr.ID_SUCURSAL = :identificadorSucursal AND dr.ESTADO = 'A' AND r.ESTADO = 'A'`, 'rutas activas'],
    [`SELECT COUNT(*) CANTIDAD FROM USUARIO WHERE ID_SUCURSAL = :identificadorSucursal AND ESTADO = 'A'`, 'usuarios activos asignados'],
  ];
  for (const [consulta, descripcion] of comprobaciones) {
    const resultado = await conexion.execute(consulta, { identificadorSucursal }, formatoFilas);
    if (Number(resultado.rows[0].CANTIDAD) > 0) throw crearError(`No puede inhabilitar la sucursal porque tiene ${descripcion}.`, 409);
  }
}

async function registrarBitacoraSucursal(conexion, identificadorSucursal, identificadorResponsable, accion, comentario) {
  await conexion.execute(
    `INSERT INTO BITACORA_SUCURSALES (ID_SUCURSAL, ID_USUARIO, ACCION, FECHA_HORA, COMENTARIO)
     VALUES (:identificadorSucursal, :identificadorResponsable, :accion, SYSDATE, :comentario)`,
    { identificadorSucursal, identificadorResponsable, accion, comentario },
  );
}

export function validarNombreSucursal(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos) || Object.keys(datos).some(clave => clave !== 'nombre')) throw crearError('Solo puede modificar el nombre de la sucursal.', 400);
  const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
  if (!nombre || nombre.length > 100) throw crearError('El nombre de la sucursal es obligatorio y debe tener hasta 100 caracteres.', 400);
  return nombre;
}

function crearError(mensaje, codigoEstado) {
  const error = new Error(mensaje); error.codigoEstado = codigoEstado; error.mensajeCliente = mensaje; return error;
}
