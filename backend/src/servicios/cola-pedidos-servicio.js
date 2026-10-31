import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';

const formatoFilas = { outFormat: oracledb.OUT_FORMAT_OBJECT };

// La bandera es explícita: mientras no exista la migración, la cola permanece inhabilitada.
export function estaColaPedidosHabilitada() {
  return process.env.COLA_PEDIDOS_HABILITADA === 'true';
}

export function exigirColaPedidosHabilitada(habilitada = estaColaPedidosHabilitada()) {
  if (!habilitada) {
    throw crearError('La cola de pedidos todavía no está disponible. Requiere la migración de base de datos confirmada.', 503, true);
  }
}

// Esta fila debe ser el primer bloqueo de cualquier escritor de cola.
export async function bloquearControlCola(conexion, habilitada = estaColaPedidosHabilitada()) {
  exigirColaPedidosHabilitada(habilitada);
  const resultado = await conexion.execute(
    'SELECT ID_CONTROL FROM COLA_PEDIDOS_CONTROL WHERE ID_CONTROL = 1 FOR UPDATE',
    [], formatoFilas,
  );
  if (resultado.rows.length !== 1) {
    throw crearError('La configuración de control de cola no es válida.', 409, true);
  }
}

export async function obtenerNuevaPosicionCola(conexion, habilitada = estaColaPedidosHabilitada()) {
  exigirColaPedidosHabilitada(habilitada);
  const resultado = await conexion.execute(
    'SELECT SEQ_PEDIDO_COLA.NEXTVAL AS POSICION_COLA FROM DUAL',
    [], formatoFilas,
  );
  return resultado.rows[0].POSICION_COLA;
}

export async function consultarColaPedidos(habilitada = estaColaPedidosHabilitada()) {
  exigirColaPedidosHabilitada(habilitada);
  const conexion = await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      `SELECT p.ID_PEDIDO, p.POSICION_COLA, p.FECHA_PEDIDO, s.NOMBRE AS SUCURSAL,
              j.NOMBRE AS JORNADA, COUNT(dp.ID_DETALLE_PEDIDO) AS LINEAS
         FROM PEDIDO p
         JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO = p.ID_ESTADO_PEDIDO
         JOIN SUCURSAL s ON s.ID_SUCURSAL = p.ID_SUCURSAL
         JOIN JORNADA j ON j.ID_JORNADA = p.ID_JORNADA
         LEFT JOIN DETALLE_PEDIDO dp ON dp.ID_PEDIDO = p.ID_PEDIDO
        WHERE e.NOMBRE = 'PENDIENTE' AND p.POSICION_COLA IS NOT NULL
        GROUP BY p.ID_PEDIDO, p.POSICION_COLA, p.FECHA_PEDIDO, s.NOMBRE, j.NOMBRE
        ORDER BY p.POSICION_COLA`,
      [], formatoFilas,
    );
    return resultado.rows;
  } finally {
    await conexion.close();
  }
}

// Un pedido pendiente fuera de la cola no se planifica hasta que un responsable lo incorpore.
export async function consultarPedidosPendientesSinCola(conexionExterna = null, habilitada = estaColaPedidosHabilitada()) {
  exigirColaPedidosHabilitada(habilitada);
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      `SELECT p.ID_PEDIDO, p.POSICION_COLA, p.FECHA_PEDIDO, s.NOMBRE AS SUCURSAL,
              j.NOMBRE AS JORNADA, COUNT(dp.ID_DETALLE_PEDIDO) AS LINEAS,
              NVL(SUM(dp.CANTIDAD), 0) AS UNIDADES_PEDIDAS
         FROM PEDIDO p
         JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO = p.ID_ESTADO_PEDIDO
         JOIN SUCURSAL s ON s.ID_SUCURSAL = p.ID_SUCURSAL
         JOIN JORNADA j ON j.ID_JORNADA = p.ID_JORNADA
         LEFT JOIN DETALLE_PEDIDO dp ON dp.ID_PEDIDO = p.ID_PEDIDO
        WHERE e.NOMBRE = 'PENDIENTE' AND p.POSICION_COLA IS NULL
        GROUP BY p.ID_PEDIDO, p.POSICION_COLA, p.FECHA_PEDIDO, s.NOMBRE, j.NOMBRE
        ORDER BY p.FECHA_PEDIDO, p.ID_PEDIDO`,
      [], formatoFilas,
    );
    return resultado.rows;
  } finally { if (!conexionExterna) await conexion.close(); }
}

// Incorpora voluntariamente un pedido pendiente a la cola global respetando el bloqueo coordinador.
export async function incorporarPedidoEnCola(identificadorPedido, identidad, conexionExterna = null, habilitada = estaColaPedidosHabilitada()) {
  exigirColaPedidosHabilitada(habilitada);
  const conexion = conexionExterna || await obtenerConexion();
  try {
    await bloquearControlCola(conexion, habilitada);
    const pedido = await conexion.execute(
      `SELECT p.ID_PEDIDO, p.POSICION_COLA, e.NOMBRE AS ESTADO
         FROM PEDIDO p JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO = p.ID_ESTADO_PEDIDO
        WHERE p.ID_PEDIDO = :identificadorPedido FOR UPDATE`,
      { identificadorPedido }, formatoFilas,
    );
    if (!pedido.rows.length) throw crearError('Pedido no encontrado.', 404, true);
    if (pedido.rows[0].ESTADO !== 'PENDIENTE') throw crearError('Solo puede incorporar pedidos pendientes a la cola.', 409, true);
    if (pedido.rows[0].POSICION_COLA !== null) throw crearError('El pedido ya está incorporado a la cola.', 409, true);
    const posicionCola = await obtenerNuevaPosicionCola(conexion, habilitada);
    const actualizacion = await conexion.execute('UPDATE PEDIDO SET POSICION_COLA = :posicionCola WHERE ID_PEDIDO = :identificadorPedido AND POSICION_COLA IS NULL', { posicionCola, identificadorPedido });
    if (actualizacion.rowsAffected !== 1) throw crearError('El pedido cambió durante la incorporación a la cola.', 409, true);
    await conexion.execute(
      `INSERT INTO BITACORA_PEDIDOS (ID_PEDIDO, ID_USUARIO, ACCION, COMENTARIO)
       VALUES (:identificadorPedido, :identificadorUsuario, 'INCORPORADO_COLA', 'Pedido incorporado a la cola de producción')`,
      { identificadorPedido, identificadorUsuario: identidad.identificadorUsuario },
    );
    await conexion.commit();
    return { identificadorPedido, posicionCola };
  } catch (error) { await conexion.rollback(); throw error; } finally { if (!conexionExterna) await conexion.close(); }
}

export async function moverPedidoEnCola(identificadorPedido, direccion, conexionExterna = null, habilitada = estaColaPedidosHabilitada()) {
  exigirColaPedidosHabilitada(habilitada);
  if (!['SUBIR', 'BAJAR'].includes(direccion)) throw crearError('La dirección de cola no es válida.', 400, true);

  const conexion = conexionExterna || await obtenerConexion();
  try {
    await bloquearControlCola(conexion, habilitada);
    const actual = await obtenerPedidoPendienteBloqueado(conexion, identificadorPedido);
    const vecino = await obtenerVecino(conexion, actual.POSICION_COLA, direccion);
    if (!vecino) throw crearError('El pedido ya está en el extremo de la cola.', 409, true);

    const vecinoBloqueado = await obtenerPedidoPendienteBloqueado(conexion, vecino.ID_PEDIDO);
    if (vecinoBloqueado.POSICION_COLA !== vecino.POSICION_COLA) {
      throw crearError('La cola cambió durante la operación. Inténtelo nuevamente.', 409, true);
    }

    const posicionTemporal = await obtenerNuevaPosicionCola(conexion, habilitada);
    await conexion.execute('UPDATE PEDIDO SET POSICION_COLA = :posicion WHERE ID_PEDIDO = :identificadorPedido', {
      posicion: posicionTemporal, identificadorPedido: actual.ID_PEDIDO,
    });
    await conexion.execute('UPDATE PEDIDO SET POSICION_COLA = :posicion WHERE ID_PEDIDO = :identificadorPedido', {
      posicion: actual.POSICION_COLA, identificadorPedido: vecinoBloqueado.ID_PEDIDO,
    });
    await conexion.execute('UPDATE PEDIDO SET POSICION_COLA = :posicion WHERE ID_PEDIDO = :identificadorPedido', {
      posicion: vecinoBloqueado.POSICION_COLA, identificadorPedido: actual.ID_PEDIDO,
    });
    await conexion.commit();
    return { identificadorPedido: actual.ID_PEDIDO, posicionCola: vecinoBloqueado.POSICION_COLA };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

// Utilidades para la futura aprobación planificada y cancelación automática.
export async function retirarPedidoDeCola(conexion, identificadorPedido, habilitada = estaColaPedidosHabilitada()) {
  exigirColaPedidosHabilitada(habilitada);
  await bloquearControlCola(conexion, habilitada);
  const pedido = await obtenerPedidoPendienteBloqueado(conexion, identificadorPedido);
  await conexion.execute('UPDATE PEDIDO SET POSICION_COLA = NULL WHERE ID_PEDIDO = :identificadorPedido', {
    identificadorPedido: pedido.ID_PEDIDO,
  });
}

async function obtenerPedidoPendienteBloqueado(conexion, identificadorPedido) {
  const resultado = await conexion.execute(
    `SELECT p.ID_PEDIDO, p.POSICION_COLA
       FROM PEDIDO p JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO = p.ID_ESTADO_PEDIDO
      WHERE p.ID_PEDIDO = :identificadorPedido
        AND e.NOMBRE = 'PENDIENTE'
        AND p.POSICION_COLA IS NOT NULL
      FOR UPDATE`,
    { identificadorPedido }, formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('El pedido no está disponible en la cola.', 409, true);
  return resultado.rows[0];
}

async function obtenerVecino(conexion, posicionActual, direccion) {
  const comparador = direccion === 'SUBIR' ? '<' : '>';
  const orden = direccion === 'SUBIR' ? 'DESC' : 'ASC';
  const resultado = await conexion.execute(
    `SELECT ID_PEDIDO, POSICION_COLA FROM (
       SELECT p.ID_PEDIDO, p.POSICION_COLA
         FROM PEDIDO p JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO = p.ID_ESTADO_PEDIDO
        WHERE e.NOMBRE = 'PENDIENTE'
          AND p.POSICION_COLA ${comparador} :posicionActual
        ORDER BY p.POSICION_COLA ${orden}
     ) WHERE ROWNUM = 1`,
    { posicionActual }, formatoFilas,
  );
  return resultado.rows[0] || null;
}

function crearError(mensaje, codigoEstado, exponerAlCliente = false) {
  const error = new Error(mensaje);
  error.codigoEstado = codigoEstado;
  if (exponerAlCliente) error.mensajeCliente = mensaje;
  return error;
}
