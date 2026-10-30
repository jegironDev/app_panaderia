import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';
import { obtenerFiltroSucursal } from './aislamiento-sucursales-servicio.js';
import { obtenerSucursalAutenticada } from './aislamiento-sucursales-servicio.js';
import { bloquearControlCola, estaColaPedidosHabilitada, obtenerNuevaPosicionCola } from './cola-pedidos-servicio.js';

const formatoFilas = { outFormat: oracledb.OUT_FORMAT_OBJECT };

// AUTORIZAR_PEDIDOS es la regla aprobada de alcance global para pedidos.
export function tieneAccesoGlobalPedidos(identidad) {
  return identidad.permisos.includes('AUTORIZAR_PEDIDOS');
}

export async function consultarPedidos(identidad) {
  const conexion = await obtenerConexion();
  try {
    const filtro = obtenerFiltroSucursal(identidad, 'p.ID_SUCURSAL', tieneAccesoGlobalPedidos(identidad));
    const condicionSucursal = filtro.condicion ? `AND ${filtro.condicion}` : '';
    const resultado = await conexion.execute(
      `SELECT p.ID_PEDIDO, p.ID_SUCURSAL, s.NOMBRE AS SUCURSAL,
              p.ID_JORNADA, j.NOMBRE AS JORNADA,
              p.ID_ESTADO_PEDIDO, e.NOMBRE AS ESTADO,
              p.FECHA_PEDIDO, p.FECHA_DESPACHO, p.OBSERVACIONES, p.TOTAL,
              COUNT(dp.ID_DETALLE_PEDIDO) AS LINEAS,
              NVL(SUM(dp.CANTIDAD), 0) AS UNIDADES_PEDIDAS
         FROM PEDIDO p
         JOIN SUCURSAL s ON s.ID_SUCURSAL = p.ID_SUCURSAL
         JOIN JORNADA j ON j.ID_JORNADA = p.ID_JORNADA
         JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO = p.ID_ESTADO_PEDIDO
         LEFT JOIN DETALLE_PEDIDO dp ON dp.ID_PEDIDO = p.ID_PEDIDO
        WHERE 1 = 1 ${condicionSucursal}
        GROUP BY p.ID_PEDIDO, p.ID_SUCURSAL, s.NOMBRE, p.ID_JORNADA, j.NOMBRE,
                 p.ID_ESTADO_PEDIDO, e.NOMBRE, p.FECHA_PEDIDO, p.FECHA_DESPACHO, p.OBSERVACIONES, p.TOTAL
        ORDER BY p.FECHA_PEDIDO DESC, p.ID_PEDIDO DESC`,
      filtro.parametros,
      formatoFilas,
    );
    return resultado.rows;
  } finally {
    await conexion.close();
  }
}

export async function consultarPedidoPorIdentificador(identificadorPedido, identidad) {
  const conexion = await obtenerConexion();
  try {
    const filtro = obtenerFiltroSucursal(identidad, 'p.ID_SUCURSAL', tieneAccesoGlobalPedidos(identidad));
    const condicionSucursal = filtro.condicion ? `AND ${filtro.condicion}` : '';
    const cabecera = await conexion.execute(
      `SELECT p.ID_PEDIDO, p.ID_SUCURSAL, s.NOMBRE AS SUCURSAL,
              p.ID_USUARIO, p.ID_RUTA, p.ID_JORNADA, j.NOMBRE AS JORNADA,
              p.ID_ESTADO_PEDIDO, e.NOMBRE AS ESTADO,
              p.FECHA_PEDIDO, p.FECHA_DESPACHO, p.OBSERVACIONES, p.TOTAL
         FROM PEDIDO p
         JOIN SUCURSAL s ON s.ID_SUCURSAL = p.ID_SUCURSAL
         JOIN JORNADA j ON j.ID_JORNADA = p.ID_JORNADA
         JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO = p.ID_ESTADO_PEDIDO
        WHERE p.ID_PEDIDO = :identificadorPedido ${condicionSucursal}`,
      { identificadorPedido, ...filtro.parametros },
      formatoFilas,
    );
    if (!cabecera.rows.length) return null;

    const detalles = await conexion.execute(
      `SELECT dp.ID_DETALLE_PEDIDO, dp.ID_PRODUCTO, pr.NOMBRE AS NOMBRE_PRODUCTO,
              pr.TIPO AS TIPO_PRODUCTO, dp.PRECIO_UNITARIO, dp.SUBTOTAL, dp.CANTIDAD
         FROM DETALLE_PEDIDO dp
         JOIN PEDIDO p ON p.ID_PEDIDO = dp.ID_PEDIDO
         JOIN PRODUCTO pr ON pr.ID_PRODUCTO = dp.ID_PRODUCTO
        WHERE dp.ID_PEDIDO = :identificadorPedido ${condicionSucursal}
        ORDER BY dp.ID_DETALLE_PEDIDO`,
      { identificadorPedido, ...filtro.parametros },
      formatoFilas,
    );
    return { ...cabecera.rows[0], DETALLES: detalles.rows };
  } finally {
    await conexion.close();
  }
}

export async function consultarEstadosPedidoActivos() {
  return consultarCatalogoActivo('ESTADO_PEDIDO', 'ID_ESTADO_PEDIDO');
}

export async function consultarJornadasActivas() {
  return consultarCatalogoActivo('JORNADA', 'ID_JORNADA');
}

async function consultarCatalogoActivo(tabla, columnaIdentificador) {
  const conexion = await obtenerConexion();
  try {
    const columnas = tabla === 'ESTADO_PEDIDO'
      ? `${columnaIdentificador}, NOMBRE, DESCRIPCION`
      : `${columnaIdentificador}, NOMBRE`;
    const resultado = await conexion.execute(
      `SELECT ${columnas} FROM ${tabla} WHERE ESTADO = 'A' ORDER BY NOMBRE`,
      [],
      formatoFilas,
    );
    return resultado.rows;
  } finally {
    await conexion.close();
  }
}

// Valida el contrato sin aceptar IDs de sucursal o usuario provenientes del cliente.
export function validarDatosNuevoPedido(datos) {
  if (Object.hasOwn(datos || {}, 'identificadorSucursal') || Object.hasOwn(datos || {}, 'identificadorUsuario')
    || Object.hasOwn(datos || {}, 'total')) {
    throw crearError('La sucursal y el usuario se obtienen de la sesión autenticada', 400);
  }
  const identificadorJornada = Number(datos?.identificadorJornada);
  if (!Number.isInteger(identificadorJornada) || identificadorJornada <= 0) {
    throw crearError('La jornada no es válida', 400);
  }
  if (!Array.isArray(datos?.detalles) || !datos.detalles.length) {
    throw crearError('Debe incluir al menos un detalle de pedido', 400);
  }
  const observaciones = datos.observaciones == null ? null : String(datos.observaciones).trim();
  if (observaciones?.length > 300) throw crearError('Las observaciones exceden la longitud permitida', 400);

  const productos = new Set();
  const detalles = datos.detalles.map((detalle) => {
    const identificadorProducto = Number(detalle?.identificadorProducto);
    const cantidad = Number(detalle?.cantidad);
    if (!Number.isInteger(identificadorProducto) || identificadorProducto <= 0
      || !Number.isInteger(cantidad) || cantidad <= 0) {
      throw crearError('Cada detalle requiere producto y cantidad entera positiva', 400);
    }
    if (productos.has(identificadorProducto)) throw crearError('No se permiten productos repetidos', 400);
    if (Object.hasOwn(detalle || {}, 'precioUnitario') || Object.hasOwn(detalle || {}, 'subtotal')) {
      throw crearError('Los importes son calculados por el servidor', 400);
    }
    productos.add(identificadorProducto);
    return { identificadorProducto, cantidad };
  });
  return { identificadorJornada, observaciones: observaciones || null, detalles };
}

export function validarMotivoCancelacion(motivo) {
  const motivoNormalizado = typeof motivo === 'string' ? motivo.trim() : '';
  if (!motivoNormalizado || motivoNormalizado.length > 300) {
    throw crearError('El motivo de cancelación es obligatorio y debe tener hasta 300 caracteres', 400);
  }
  return motivoNormalizado;
}

export async function crearPedido(datosRecibidos, identidad, conexionExterna = null, administrarTransaccion = true) {
  const datos = validarDatosNuevoPedido(datosRecibidos);
  const identificadorSucursal = obtenerSucursalAutenticada(identidad);
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const colaHabilitada = estaColaPedidosHabilitada();
    const posicionCola = colaHabilitada
      ? await asignarPosicionInicialCola(conexion)
      : null;
    await obtenerJornadaActiva(conexion, datos.identificadorJornada);
    const identificadorEstadoPendiente = await obtenerEstadoOficialActivo(conexion, 'PENDIENTE');
    const detallesConPrecio = [];
    for (const detalle of datos.detalles) {
      const producto = await obtenerProductoTerminadoActivo(conexion, detalle.identificadorProducto);
      const precioUnitario = redondearImporte(producto.PRECIO);
      detallesConPrecio.push({ ...detalle, precioUnitario, subtotal: redondearImporte(detalle.cantidad * precioUnitario) });
    }
    const total = redondearImporte(detallesConPrecio.reduce((acumulado, detalle) => acumulado + detalle.subtotal, 0));

    const parametrosCabecera = {
      identificadorSucursal,
      identificadorUsuario: identidad.identificadorUsuario,
      identificadorJornada: datos.identificadorJornada,
      identificadorEstadoPedido: identificadorEstadoPendiente,
      observaciones: datos.observaciones,
      total,
      identificadorPedido: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };
    // La columna nueva solo se referencia tras habilitar explícitamente la migración 17.
    const sentenciaCabecera = colaHabilitada
      ? `INSERT INTO PEDIDO
           (ID_SUCURSAL, ID_USUARIO, ID_JORNADA, ID_ESTADO_PEDIDO, OBSERVACIONES, TOTAL, POSICION_COLA)
         VALUES (:identificadorSucursal, :identificadorUsuario, :identificadorJornada,
                 :identificadorEstadoPedido, :observaciones, :total, :posicionCola)
         RETURNING ID_PEDIDO INTO :identificadorPedido`
      : `INSERT INTO PEDIDO
           (ID_SUCURSAL, ID_USUARIO, ID_JORNADA, ID_ESTADO_PEDIDO, OBSERVACIONES, TOTAL)
         VALUES (:identificadorSucursal, :identificadorUsuario, :identificadorJornada,
                 :identificadorEstadoPedido, :observaciones, :total)
         RETURNING ID_PEDIDO INTO :identificadorPedido`;
    if (colaHabilitada) parametrosCabecera.posicionCola = posicionCola;
    const cabecera = await conexion.execute(sentenciaCabecera, parametrosCabecera);
    const identificadorPedido = cabecera.outBinds.identificadorPedido[0];
    for (const detalle of detallesConPrecio) {
      await conexion.execute(
        `INSERT INTO DETALLE_PEDIDO (ID_PEDIDO, ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL)
         VALUES (:identificadorPedido, :identificadorProducto, :cantidad, :precioUnitario, :subtotal)`,
        { identificadorPedido, ...detalle },
      );
    }
    await conexion.execute(
      `INSERT INTO BITACORA_PEDIDOS (ID_PEDIDO, ID_USUARIO, ACCION, COMENTARIO)
       VALUES (:identificadorPedido, :identificadorUsuario, 'CREADO', :comentario)`,
      { identificadorPedido, identificadorUsuario: identidad.identificadorUsuario, comentario: 'Pedido creado' },
    );
    if (administrarTransaccion) await conexion.commit();
    if (conexionExterna) {
      return { ID_PEDIDO: identificadorPedido, TOTAL: total, DETALLES: detallesConPrecio };
    }
    return consultarPedidoPorIdentificador(identificadorPedido, identidad);
  } catch (error) {
    if (administrarTransaccion) await conexion.rollback();
    throw error;
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

async function asignarPosicionInicialCola(conexion) {
  await bloquearControlCola(conexion);
  return obtenerNuevaPosicionCola(conexion);
}

// Durante la transición de estados, ambas denominaciones representan pedidos ya aprobados.
export function esEstadoAprobadoParaProduccion(estado) {
  return estado === 'AUTORIZADO' || estado === 'APROBADO_PARA_PRODUCCION';
}

// La autorización simple queda suspendida hasta registrar el plan, reservas y producción en una transacción.
export async function autorizarPedido(identificadorPedido, identidad, conexionExterna = null) {
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const pedido = await conexion.execute(
      `SELECT p.ID_PEDIDO, p.ID_ESTADO_PEDIDO, e.NOMBRE AS ESTADO
         FROM PEDIDO p JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO = p.ID_ESTADO_PEDIDO
        WHERE p.ID_PEDIDO = :identificadorPedido
        FOR UPDATE`,
      { identificadorPedido }, formatoFilas,
    );
    if (!pedido.rows.length) throw crearError('Pedido no encontrado', 404, true);
    if (esEstadoAprobadoParaProduccion(pedido.rows[0].ESTADO)) {
      throw crearError('El pedido ya fue aprobado para producción.', 409, true);
    }
    throw crearError('La planificación de producción es necesaria antes de aprobar el pedido.', 409, true);
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

export async function solicitarCancelacionPedido(identificadorPedido, motivoRecibido, identidad) {
  const motivo = validarMotivoCancelacion(motivoRecibido);
  const conexion = await obtenerConexion();
  try {
    const filtro = obtenerFiltroSucursal(identidad, 'p.ID_SUCURSAL', false);
    const pedido = await conexion.execute(
      `SELECT p.ID_PEDIDO FROM PEDIDO p
        WHERE p.ID_PEDIDO = :identificadorPedido AND ${filtro.condicion}
        FOR UPDATE`,
      { identificadorPedido, ...filtro.parametros }, formatoFilas,
    );
    if (!pedido.rows.length) throw crearError('Pedido no encontrado', 404);
    const pendiente = await conexion.execute(
      `SELECT ID_SOLICITUD FROM SOLICITUD_CANCELACION
        WHERE ID_PEDIDO = :identificadorPedido AND ESTADO = 'PENDIENTE'
        FETCH FIRST 1 ROW ONLY`,
      { identificadorPedido }, formatoFilas,
    );
    if (pendiente.rows.length) throw crearError('Ya existe una solicitud de cancelación pendiente', 409);
    const solicitud = await conexion.execute(
      `INSERT INTO SOLICITUD_CANCELACION (ID_PEDIDO, ID_USUARIO_SOLICITA, MOTIVO, ESTADO)
       VALUES (:identificadorPedido, :identificadorUsuario, :motivo, 'PENDIENTE')
       RETURNING ID_SOLICITUD INTO :identificadorSolicitud`,
      { identificadorPedido, identificadorUsuario: identidad.identificadorUsuario, motivo,
        identificadorSolicitud: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } },
    );
    await conexion.execute(
      `INSERT INTO BITACORA_PEDIDOS (ID_PEDIDO, ID_USUARIO, ACCION, COMENTARIO)
       VALUES (:identificadorPedido, :identificadorUsuario, 'SOLICITUD_CANCELACION', :motivo)`,
      { identificadorPedido, identificadorUsuario: identidad.identificadorUsuario, motivo },
    );
    await conexion.commit();
    return { identificadorSolicitud: solicitud.outBinds.identificadorSolicitud[0], estado: 'PENDIENTE', motivo };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    await conexion.close();
  }
}

async function obtenerJornadaActiva(conexion, identificadorJornada) {
  const resultado = await conexion.execute(
    `SELECT ID_JORNADA FROM JORNADA WHERE ID_JORNADA = :identificadorJornada AND ESTADO = 'A'`,
    { identificadorJornada }, formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('Jornada no encontrada o inactiva', 404);
}

async function obtenerProductoTerminadoActivo(conexion, identificadorProducto) {
  const resultado = await conexion.execute(
    `SELECT ID_PRODUCTO, PRECIO FROM PRODUCTO
      WHERE ID_PRODUCTO = :identificadorProducto AND TIPO = 'PFI' AND ESTADO = 'A'`,
    { identificadorProducto }, formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('Producto final no encontrado o inactivo', 404);
  if (!Number.isFinite(Number(resultado.rows[0].PRECIO)) || Number(resultado.rows[0].PRECIO) <= 0) {
    throw crearError('El producto final no tiene un precio de venta configurado.', 409, true);
  }
  return resultado.rows[0];
}

function redondearImporte(importe) { return Number(Number(importe).toFixed(2)); }

async function obtenerEstadoOficialActivo(conexion, nombre) {
  const resultado = await conexion.execute(
    `SELECT ID_ESTADO_PEDIDO FROM ESTADO_PEDIDO WHERE NOMBRE = :nombre AND ESTADO = 'A'`,
    { nombre }, formatoFilas,
  );
  if (!resultado.rows.length) throw crearError(`No está configurado el estado oficial ${nombre}`, 409);
  return resultado.rows[0].ID_ESTADO_PEDIDO;
}

function crearError(mensaje, codigoEstado, exponerAlCliente = false) {
  const error = new Error(mensaje);
  error.codigoEstado = codigoEstado;
  if (exponerAlCliente) error.mensajeCliente = mensaje;
  return error;
}
