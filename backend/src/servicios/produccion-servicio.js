import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';
import { bloquearControlCola, estaColaPedidosHabilitada } from './cola-pedidos-servicio.js';

const formatoFilas = { outFormat: oracledb.OUT_FORMAT_OBJECT };

export async function planificarProduccion(datos, conexionExterna = null) {
  const solicitud = validarSolicitudPlanificacion(datos);
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const pedido = await obtenerPedidoElegible(conexion, solicitud.identificadorPedido, false);
    const producciones = await construirPlan(conexion, pedido.detalles, solicitud.recetas, false, false);
    const disponibilidad = await consultarDisponibilidadPlan(conexion, producciones);
    return resumirPlan(pedido, producciones, disponibilidad);
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

export async function consultarOpcionesPlanificacion(identificadorPedido, conexionExterna = null) {
  const identificador = Number(identificadorPedido);
  if (!Number.isInteger(identificador) || identificador <= 0) throw crearError('El identificador de pedido no es válido.', 400, true);
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const pedido = await obtenerPedidoElegible(conexion, identificador, false);
    const detalles = [];
    for (const detalle of pedido.detalles) {
      const recetas = await conexion.execute(
        `SELECT ID_RECETA, NOMBRE, UNIDADES_PRODUCIDAS
           FROM RECETA
          WHERE ID_PRODUCTO = :identificadorProducto AND ESTADO = 'A'
          ORDER BY NOMBRE, ID_RECETA`,
        { identificadorProducto: detalle.ID_PRODUCTO }, formatoFilas,
      );
      detalles.push({
        identificadorDetallePedido: detalle.ID_DETALLE_PEDIDO,
        identificadorProducto: detalle.ID_PRODUCTO,
        producto: detalle.NOMBRE_PRODUCTO,
        cantidadSolicitada: Number(detalle.CANTIDAD),
        recetas: recetas.rows,
      });
    }
    return { identificadorPedido: pedido.identificadorPedido, posicionCola: pedido.posicionCola, detalles };
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

export async function autorizarProduccion(datos, identidad, conexionExterna = null, administrarTransaccion = true) {
  const solicitud = validarSolicitudPlanificacion(datos);
  const conexion = conexionExterna || await obtenerConexion();
  try {
    await bloquearControlCola(conexion);
    const pedido = await obtenerPedidoElegible(conexion, solicitud.identificadorPedido, true);
    const producciones = await construirPlan(conexion, pedido.detalles, solicitud.recetas, true, true);
    const reservas = await bloquearYValidarInventario(conexion, producciones);
    const identificadorEstado = await obtenerEstadoPedido(conexion, 'APROBADO_PARA_PRODUCCION');
    const creadas = [];

    for (let indice = 0; indice < producciones.length; indice += 1) {
      const plan = producciones[indice];
      const resultado = await conexion.execute(
        `INSERT INTO PRODUCCION
          (ID_RECETA, ID_USUARIO, CANTIDAD_PRODUCIDA, ID_PEDIDO,
           ESTADO, ORIGEN, ID_DETALLE_PEDIDO, CANTIDAD_PLANIFICADA,
           CANTIDAD_DESTINADA_PEDIDO, CANTIDAD_EXCEDENTE,
           RENDIMIENTO_RECETA_APLICADO, FECHA_CONGELACION, ID_USUARIO_AUTORIZA)
         VALUES
          (:identificadorReceta, :identificadorUsuario, 0, :identificadorPedido,
           'AUTORIZADA', 'PEDIDO', :identificadorDetallePedido, :cantidadPlanificada,
           :cantidadDestinadaPedido, :cantidadExcedente,
           :rendimientoRecetaAplicado, SYSTIMESTAMP, :identificadorUsuarioAutoriza)
         RETURNING ID_PRODUCCION INTO :identificadorProduccion`,
        {
          identificadorReceta: plan.identificadorReceta,
          identificadorUsuario: identidad.identificadorUsuario,
          identificadorPedido: pedido.identificadorPedido,
          identificadorDetallePedido: plan.identificadorDetallePedido,
          cantidadPlanificada: plan.cantidadPlanificada,
          cantidadDestinadaPedido: plan.cantidadDestinadaPedido,
          cantidadExcedente: plan.cantidadExcedente,
          rendimientoRecetaAplicado: plan.rendimiento,
          identificadorUsuarioAutoriza: identidad.identificadorUsuario,
          identificadorProduccion: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );
      const identificadorProduccion = resultado.outBinds.identificadorProduccion[0];
      creadas.push(identificadorProduccion);

      for (const ingrediente of plan.ingredientes) {
        await conexion.execute(
          `INSERT INTO DETALLE_PRODUCCION
            (ID_PRODUCCION, ID_PRODUCTO, ID_UNIDAD_MEDIDA, CANTIDAD_REQUERIDA)
           VALUES (:identificadorProduccion, :identificadorProducto, :identificadorUnidadMedida,
                   :cantidadRequerida)`,
          { identificadorProduccion, ...ingrediente },
        );
        const inventario = reservas.get(ingrediente.identificadorProducto);
        await conexion.execute(
          `INSERT INTO RESERVA_INVENTARIO
            (ID_INVENTARIO, ID_PRODUCCION, ID_USUARIO, TIPO, CANTIDAD, ESTADO)
           VALUES (:identificadorInventario, :identificadorProduccion, :identificadorUsuario,
                   'INGREDIENTE', :cantidad, 'ACTIVA')`,
          {
            identificadorInventario: inventario.ID_INVENTARIO,
            identificadorProduccion,
            identificadorUsuario: identidad.identificadorUsuario,
            cantidad: ingrediente.cantidadRequerida,
          },
        );
      }
    }

    for (const reserva of reservas.values()) {
      await conexion.execute(
        `UPDATE INVENTARIO
            SET CANTIDAD_RESERVADA = CANTIDAD_RESERVADA + :cantidad
          WHERE ID_INVENTARIO = :identificadorInventario`,
        { cantidad: reserva.cantidadRequerida, identificadorInventario: reserva.ID_INVENTARIO },
      );
    }

    const actualizado = await conexion.execute(
      `UPDATE PEDIDO
          SET ID_ESTADO_PEDIDO = :identificadorEstado, POSICION_COLA = NULL
        WHERE ID_PEDIDO = :identificadorPedido
          AND POSICION_COLA = :posicionCola`,
      { identificadorEstado, identificadorPedido: pedido.identificadorPedido, posicionCola: pedido.posicionCola },
    );
    if (actualizado.rowsAffected !== 1) throw crearError('La cola cambió durante la autorización.', 409, true);
    await conexion.execute(
      `INSERT INTO BITACORA_PEDIDOS (ID_PEDIDO, ID_USUARIO, ACCION, COMENTARIO)
       VALUES (:identificadorPedido, :identificadorUsuario, 'AUTORIZAR_PRODUCCION', :comentario)`,
      { identificadorPedido: pedido.identificadorPedido, identificadorUsuario: identidad.identificadorUsuario, comentario: 'Producción autorizada y reservas registradas' },
    );
    if (administrarTransaccion) await conexion.commit();
    return { identificadorPedido: pedido.identificadorPedido, estadoPedido: 'APROBADO_PARA_PRODUCCION', producciones: creadas };
  } catch (error) {
    if (administrarTransaccion) await conexion.rollback();
    throw error;
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

export async function consultarProduccionPorIdentificador(identificadorProduccion, conexionExterna = null) {
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const cabecera = await conexion.execute(
      `SELECT pr.ID_PRODUCCION, pr.ID_RECETA, pr.ID_PEDIDO, pr.ESTADO, pr.ORIGEN,
              CANTIDAD_PLANIFICADA, CANTIDAD_PRODUCIDA, RENDIMIENTO_RECETA_APLICADO,
              FECHA_CONGELACION, ID_USUARIO_AUTORIZA, pr.FECHA, pr.FECHA_CONFIRMACION,
              r.NOMBRE AS RECETA, p.ID_PRODUCTO, p.NOMBRE AS PRODUCTO
         FROM PRODUCCION pr
         JOIN RECETA r ON r.ID_RECETA = pr.ID_RECETA
         JOIN PRODUCTO p ON p.ID_PRODUCTO = r.ID_PRODUCTO
        WHERE pr.ID_PRODUCCION = :identificadorProduccion`,
      { identificadorProduccion }, formatoFilas,
    );
    if (!cabecera.rows.length) return null;
    const detalles = await conexion.execute(
      `SELECT dp.ID_DETALLE_PRODUCCION, dp.ID_PRODUCTO, p.NOMBRE AS NOMBRE_PRODUCTO,
              dp.ID_UNIDAD_MEDIDA, um.ABREVIATURA, dp.CANTIDAD_REQUERIDA
         FROM DETALLE_PRODUCCION dp
         JOIN PRODUCTO p ON p.ID_PRODUCTO = dp.ID_PRODUCTO
         JOIN UNIDAD_MEDIDA um ON um.ID_UNIDAD_MEDIDA = dp.ID_UNIDAD_MEDIDA
        WHERE dp.ID_PRODUCCION = :identificadorProduccion
        ORDER BY dp.ID_DETALLE_PRODUCCION`,
      { identificadorProduccion }, formatoFilas,
    );
    return { ...cabecera.rows[0], DETALLES: detalles.rows };
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

export async function listarProducciones(filtros = {}, conexionExterna = null) {
  const solicitud = validarFiltrosProduccion(filtros);
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const condiciones = [];
    const parametros = {};
    if (solicitud.estado) {
      condiciones.push('pr.ESTADO = :estado');
      parametros.estado = solicitud.estado;
    }
    if (solicitud.identificadorPedido) {
      condiciones.push('pr.ID_PEDIDO = :identificadorPedido');
      parametros.identificadorPedido = solicitud.identificadorPedido;
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const resultado = await conexion.execute(
      `SELECT pr.ID_PRODUCCION, pr.ID_PEDIDO, pr.ESTADO,
              pr.CANTIDAD_PLANIFICADA, pr.CANTIDAD_PRODUCIDA, pr.FECHA,
              pr.FECHA_CONFIRMACION, r.ID_RECETA, r.NOMBRE AS RECETA,
              p.ID_PRODUCTO, p.NOMBRE AS PRODUCTO, s.NOMBRE AS SUCURSAL,
              ep.NOMBRE AS ESTADO_PEDIDO
         FROM PRODUCCION pr
         JOIN RECETA r ON r.ID_RECETA = pr.ID_RECETA
         JOIN PRODUCTO p ON p.ID_PRODUCTO = r.ID_PRODUCTO
         LEFT JOIN PEDIDO pe ON pe.ID_PEDIDO = pr.ID_PEDIDO
         LEFT JOIN SUCURSAL s ON s.ID_SUCURSAL = pe.ID_SUCURSAL
         LEFT JOIN ESTADO_PEDIDO ep ON ep.ID_ESTADO_PEDIDO = pe.ID_ESTADO_PEDIDO
         ${where}
        ORDER BY pr.FECHA DESC, pr.ID_PRODUCCION DESC`,
      parametros, formatoFilas,
    );
    return resultado.rows;
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

export async function consultarProduccionesPorPedido(identificadorPedido, conexionExterna = null) {
  const identificador = validarIdentificadorPedidoProduccion(identificadorPedido);
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const pedido = await conexion.execute(
      `SELECT pe.ID_PEDIDO, s.NOMBRE AS SUCURSAL, ep.NOMBRE AS ESTADO_PEDIDO
         FROM PEDIDO pe
         JOIN SUCURSAL s ON s.ID_SUCURSAL = pe.ID_SUCURSAL
         JOIN ESTADO_PEDIDO ep ON ep.ID_ESTADO_PEDIDO = pe.ID_ESTADO_PEDIDO
        WHERE pe.ID_PEDIDO = :identificadorPedido`,
      { identificadorPedido: identificador }, formatoFilas,
    );
    if (!pedido.rows.length) throw crearError('Pedido no encontrado.', 404, true);
    const producciones = await conexion.execute(
      `SELECT pr.ID_PRODUCCION, pr.ID_RECETA, pr.ESTADO,
              pr.CANTIDAD_PLANIFICADA, pr.CANTIDAD_PRODUCIDA,
              pr.CANTIDAD_DESTINADA_PEDIDO, pr.CANTIDAD_EXCEDENTE,
              r.NOMBRE AS RECETA, pf.NOMBRE AS PRODUCTO
         FROM PRODUCCION pr
         JOIN RECETA r ON r.ID_RECETA = pr.ID_RECETA
         JOIN PRODUCTO pf ON pf.ID_PRODUCTO = r.ID_PRODUCTO
        WHERE pr.ID_PEDIDO = :identificadorPedido
        ORDER BY pr.ID_PRODUCCION`,
      { identificadorPedido: identificador }, formatoFilas,
    );
    const ingredientes = await conexion.execute(
      `SELECT dp.ID_PRODUCCION, pi.NOMBRE AS INGREDIENTE,
              dp.CANTIDAD_REQUERIDA, um.ABREVIATURA
         FROM DETALLE_PRODUCCION dp
         JOIN PRODUCTO pi ON pi.ID_PRODUCTO = dp.ID_PRODUCTO
         JOIN UNIDAD_MEDIDA um ON um.ID_UNIDAD_MEDIDA = dp.ID_UNIDAD_MEDIDA
        WHERE dp.ID_PRODUCCION IN (
          SELECT ID_PRODUCCION FROM PRODUCCION WHERE ID_PEDIDO = :identificadorPedido
        )
        ORDER BY dp.ID_PRODUCCION, dp.ID_DETALLE_PRODUCCION`,
      { identificadorPedido: identificador }, formatoFilas,
    );
    const porProduccion = new Map();
    for (const ingrediente of ingredientes.rows) {
      const actuales = porProduccion.get(ingrediente.ID_PRODUCCION) || [];
      actuales.push(ingrediente);
      porProduccion.set(ingrediente.ID_PRODUCCION, actuales);
    }
    return {
      ...pedido.rows[0],
      PRODUCCIONES: producciones.rows.map(produccion => ({ ...produccion, INGREDIENTES: porProduccion.get(produccion.ID_PRODUCCION) || [] })),
    };
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

export async function iniciarProduccion(identificadorProduccion, identidad, conexionExterna = null, administrarTransaccion = true) {
  const identificador = validarIdentificadorProduccion(identificadorProduccion);
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const produccion = await obtenerProduccionBloqueada(conexion, identificador, 'AUTORIZADA');
    await obtenerDetallesCongeladosYReservas(conexion, produccion.ID_PRODUCCION, true);
    const iniciada = await conexion.execute(
      `UPDATE PRODUCCION SET ESTADO = 'EN_PRODUCCION'
        WHERE ID_PRODUCCION = :identificadorProduccion AND ESTADO = 'AUTORIZADA'`,
      { identificadorProduccion: produccion.ID_PRODUCCION },
    );
    if (iniciada.rowsAffected !== 1) throw crearError('La producción cambió durante el inicio.', 409, true);
    if (administrarTransaccion) await conexion.commit();
    return { identificadorProduccion: produccion.ID_PRODUCCION, estado: 'EN_PRODUCCION' };
  } catch (error) {
    if (administrarTransaccion) await conexion.rollback();
    throw error;
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

export async function finalizarProduccion(identificadorProduccion, identidad, conexionExterna = null, administrarTransaccion = true) {
  const identificador = validarIdentificadorProduccion(identificadorProduccion);
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const produccion = await obtenerProduccionBloqueada(conexion, identificador, 'EN_PRODUCCION');
    const detalles = await obtenerDetallesCongeladosYReservas(conexion, produccion.ID_PRODUCCION, true);
    const inventarios = await bloquearInventariosProduccion(conexion, detalles, produccion.ID_PRODUCTO_FINAL);

    for (const detalle of detalles) {
      const inventario = inventarios.get(detalle.ID_PRODUCTO);
      const nuevoFisico = redondearCantidad(Number(inventario.CANTIDAD) - Number(detalle.CANTIDAD_REQUERIDA));
      const nuevoReservado = redondearCantidad(Number(inventario.CANTIDAD_RESERVADA) - Number(detalle.CANTIDAD_REQUERIDA));
      if (nuevoFisico < 0 || nuevoReservado < 0) throw crearError('La reserva o el inventario no son consistentes para finalizar la producción.', 409, true);
      const actualizado = await conexion.execute(
        `UPDATE INVENTARIO
            SET CANTIDAD = :nuevoFisico, CANTIDAD_RESERVADA = :nuevoReservado
          WHERE ID_INVENTARIO = :identificadorInventario
            AND CANTIDAD >= :cantidad
            AND CANTIDAD_RESERVADA >= :cantidad`,
        { nuevoFisico, nuevoReservado, identificadorInventario: inventario.ID_INVENTARIO, cantidad: detalle.CANTIDAD_REQUERIDA },
      );
      if (actualizado.rowsAffected !== 1) throw crearError('El inventario cambió durante la finalización.', 409, true);
      await registrarMovimientoInventario(conexion, inventario, identidad.identificadorUsuario, 'SALIDA', produccion.ID_PRODUCCION, nuevoFisico);
      await cerrarReservaIngrediente(conexion, detalle.ID_RESERVA, identidad.identificadorUsuario);
    }

    const inventarioFinal = inventarios.get(produccion.ID_PRODUCTO_FINAL);
    const nuevaCantidadFinal = redondearCantidad(Number(inventarioFinal.CANTIDAD) + Number(produccion.CANTIDAD_PLANIFICADA));
    const inventarioFinalActualizado = await conexion.execute(
      `UPDATE INVENTARIO SET CANTIDAD = :nuevaCantidad
        WHERE ID_INVENTARIO = :identificadorInventario`,
      { nuevaCantidad: nuevaCantidadFinal, identificadorInventario: inventarioFinal.ID_INVENTARIO },
    );
    if (inventarioFinalActualizado.rowsAffected !== 1) throw crearError('El inventario del producto final cambió durante la finalización.', 409, true);
    await registrarMovimientoInventario(conexion, inventarioFinal, identidad.identificadorUsuario, 'ENTRADA', produccion.ID_PRODUCCION, nuevaCantidadFinal);

    const finalizada = await conexion.execute(
      `UPDATE PRODUCCION
          SET ESTADO = 'FINALIZADA', CANTIDAD_PRODUCIDA = CANTIDAD_PLANIFICADA,
              FECHA_CONFIRMACION = SYSTIMESTAMP, ID_USUARIO_CONFIRMA = :identificadorUsuario
        WHERE ID_PRODUCCION = :identificadorProduccion AND ESTADO = 'EN_PRODUCCION'`,
      { identificadorUsuario: identidad.identificadorUsuario, identificadorProduccion: produccion.ID_PRODUCCION },
    );
    if (finalizada.rowsAffected !== 1) throw crearError('La producción cambió durante la finalización.', 409, true);
    await actualizarPedidoSiTodasFinalizadas(conexion, produccion.ID_PEDIDO);
    if (administrarTransaccion) await conexion.commit();
    return { identificadorProduccion: produccion.ID_PRODUCCION, estado: 'FINALIZADA', cantidadProducida: produccion.CANTIDAD_PLANIFICADA };
  } catch (error) {
    if (administrarTransaccion) await conexion.rollback();
    throw error;
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

export function validarSolicitudPlanificacion(datos) {
  const identificadorPedido = Number(datos?.identificadorPedido);
  if (!Number.isInteger(identificadorPedido) || identificadorPedido <= 0) throw crearError('El identificador de pedido no es válido.', 400, true);
  if (!Array.isArray(datos?.recetas) || !datos.recetas.length) throw crearError('Debe seleccionar una receta para cada producto solicitado.', 400, true);
  const recetas = datos.recetas.map((seleccion) => {
    const identificadorDetallePedido = Number(seleccion?.identificadorDetallePedido);
    const identificadorReceta = Number(seleccion?.identificadorReceta);
    if (!Number.isInteger(identificadorDetallePedido) || identificadorDetallePedido <= 0
      || !Number.isInteger(identificadorReceta) || identificadorReceta <= 0) {
      throw crearError('Las recetas seleccionadas no son válidas.', 400, true);
    }
    return { identificadorDetallePedido, identificadorReceta };
  });
  return { identificadorPedido, recetas };
}

async function obtenerPedidoElegible(conexion, identificadorPedido, bloquear) {
  const bloqueo = bloquear ? ' FOR UPDATE' : '';
  const cabecera = await conexion.execute(
    `SELECT p.ID_PEDIDO, p.POSICION_COLA, e.NOMBRE AS ESTADO
       FROM PEDIDO p JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO = p.ID_ESTADO_PEDIDO
      WHERE p.ID_PEDIDO = :identificadorPedido${bloqueo}`,
    { identificadorPedido }, formatoFilas,
  );
  if (!cabecera.rows.length) throw crearError('Pedido no encontrado.', 404, true);
  const pedido = cabecera.rows[0];
  if (pedido.ESTADO !== 'PENDIENTE' || !Number.isInteger(Number(pedido.POSICION_COLA)) || Number(pedido.POSICION_COLA) <= 0) {
    throw crearError('El pedido no está disponible para planificación en la cola.', 409, true);
  }
  const detalles = await conexion.execute(
    `SELECT dp.ID_DETALLE_PEDIDO, dp.ID_PRODUCTO, dp.CANTIDAD, p.NOMBRE AS NOMBRE_PRODUCTO
       FROM DETALLE_PEDIDO dp JOIN PRODUCTO p ON p.ID_PRODUCTO = dp.ID_PRODUCTO
      WHERE dp.ID_PEDIDO = :identificadorPedido
      ORDER BY dp.ID_DETALLE_PEDIDO`,
    { identificadorPedido }, formatoFilas,
  );
  if (!detalles.rows.length) throw crearError('El pedido no tiene productos para planificar.', 409, true);
  return { identificadorPedido: pedido.ID_PEDIDO, posicionCola: pedido.POSICION_COLA, detalles: detalles.rows };
}

async function construirPlan(conexion, detallesPedido, selecciones, bloquearRecetas, exigirCobertura) {
  const porDetalle = new Map(detallesPedido.map(detalle => [detalle.ID_DETALLE_PEDIDO, detalle]));
  const cobertura = new Map(detallesPedido.map(detalle => [detalle.ID_DETALLE_PEDIDO, 0]));
  const producciones = [];
  for (const seleccion of selecciones) {
    const detalle = porDetalle.get(seleccion.identificadorDetallePedido);
    if (!detalle) throw crearError('La línea seleccionada no pertenece al pedido.', 400, true);
    const identificadorReceta = seleccion.identificadorReceta;
    const receta = await obtenerRecetaCompatible(conexion, identificadorReceta, detalle.ID_PRODUCTO, bloquearRecetas);
    const cantidadPlanificada = Number(receta.UNIDADES_PRODUCIDAS);
    const ingredientes = await obtenerIngredientesReceta(conexion, identificadorReceta);
    producciones.push({
      identificadorDetallePedido: detalle.ID_DETALLE_PEDIDO,
      identificadorReceta,
      producto: detalle.NOMBRE_PRODUCTO,
      cantidadSolicitada: Number(detalle.CANTIDAD),
      rendimiento: Number(receta.UNIDADES_PRODUCIDAS),
      cantidadPlanificada,
      cantidadExcedente: 0,
      cantidadDestinadaPedido: 0,
      ingredientes: ingredientes.map(ingrediente => ({
        identificadorProducto: ingrediente.ID_PRODUCTO,
        identificadorUnidadMedida: ingrediente.ID_UNIDAD_MEDIDA,
        cantidadRequerida: Number(ingrediente.CANTIDAD),
      })),
    });
    cobertura.set(detalle.ID_DETALLE_PEDIDO, cobertura.get(detalle.ID_DETALLE_PEDIDO) + cantidadPlanificada);
  }
  const pendientePorDetalle = new Map(detallesPedido.map(detalle => [detalle.ID_DETALLE_PEDIDO, Number(detalle.CANTIDAD)]));
  for (const produccion of producciones) {
    const pendiente = pendientePorDetalle.get(produccion.identificadorDetallePedido);
    produccion.cantidadDestinadaPedido = Math.min(produccion.cantidadPlanificada, pendiente);
    produccion.cantidadExcedente = produccion.cantidadPlanificada - produccion.cantidadDestinadaPedido;
    pendientePorDetalle.set(produccion.identificadorDetallePedido, pendiente - produccion.cantidadDestinadaPedido);
  }
  producciones.cobertura = detallesPedido.map(detalle => ({
    identificadorDetallePedido: detalle.ID_DETALLE_PEDIDO,
    producto: detalle.NOMBRE_PRODUCTO,
    cantidadSolicitada: Number(detalle.CANTIDAD),
    cantidadPlanificada: cobertura.get(detalle.ID_DETALLE_PEDIDO),
    faltante: Math.max(0, Number(detalle.CANTIDAD) - cobertura.get(detalle.ID_DETALLE_PEDIDO)),
  }));
  if (exigirCobertura && producciones.cobertura.some(detalle => detalle.faltante > 0)) {
    throw crearError('La planificación no cubre completamente las cantidades solicitadas.', 409, true);
  }
  return producciones;
}

async function obtenerRecetaCompatible(conexion, identificadorReceta, identificadorProducto, bloquear) {
  const bloqueo = bloquear ? ' FOR UPDATE' : '';
  const resultado = await conexion.execute(
    `SELECT ID_RECETA, UNIDADES_PRODUCIDAS
       FROM RECETA
      WHERE ID_RECETA = :identificadorReceta
        AND ID_PRODUCTO = :identificadorProducto
        AND ESTADO = 'A'${bloqueo}`,
    { identificadorReceta, identificadorProducto }, formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('La receta seleccionada no está activa o no corresponde al producto.', 409, true);
  return resultado.rows[0];
}

async function obtenerIngredientesReceta(conexion, identificadorReceta) {
  const resultado = await conexion.execute(
    `SELECT dr.ID_PRODUCTO, dr.ID_UNIDAD_MEDIDA, dr.CANTIDAD
       FROM DETALLE_RECETA dr
       JOIN PRODUCTO p ON p.ID_PRODUCTO = dr.ID_PRODUCTO AND p.ESTADO = 'A'
       JOIN UNIDAD_MEDIDA um ON um.ID_UNIDAD_MEDIDA = dr.ID_UNIDAD_MEDIDA AND um.ESTADO = 'A'
      WHERE dr.ID_RECETA = :identificadorReceta
      ORDER BY dr.ID_DETALLE_RECETA`,
    { identificadorReceta }, formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('La receta no contiene ingredientes activos.', 409, true);
  return resultado.rows;
}

async function bloquearYValidarInventario(conexion, producciones) {
  const requeridos = new Map();
  for (const produccion of producciones) for (const ingrediente of produccion.ingredientes) {
    const actual = requeridos.get(ingrediente.identificadorProducto) || 0;
    requeridos.set(ingrediente.identificadorProducto, redondearCantidad(actual + ingrediente.cantidadRequerida));
  }
  const reservas = new Map();
  for (const [identificadorProducto, cantidadRequerida] of [...requeridos.entries()].sort(([a], [b]) => a - b)) {
    const resultado = await conexion.execute(
      `SELECT ID_INVENTARIO, CANTIDAD, CANTIDAD_RESERVADA
         FROM INVENTARIO
        WHERE ID_PRODUCTO = :identificadorProducto AND ESTADO = 'A'
        FOR UPDATE`,
      { identificadorProducto }, formatoFilas,
    );
    const inventario = resultado.rows[0];
    const disponible = inventario ? Number(inventario.CANTIDAD) - Number(inventario.CANTIDAD_RESERVADA) : -1;
    if (!inventario || disponible < cantidadRequerida) throw crearError('No hay inventario disponible suficiente para autorizar la producción.', 409, true);
    reservas.set(identificadorProducto, { ...inventario, cantidadRequerida });
  }
  return reservas;
}

async function consultarDisponibilidadPlan(conexion, producciones) {
  const requeridos = new Map();
  for (const produccion of producciones) for (const ingrediente of produccion.ingredientes) {
    requeridos.set(ingrediente.identificadorProducto, redondearCantidad((requeridos.get(ingrediente.identificadorProducto) || 0) + ingrediente.cantidadRequerida));
  }
  const disponibilidad = [];
  for (const [identificadorProducto, cantidadRequerida] of requeridos) {
    const resultado = await conexion.execute(
      `SELECT ID_INVENTARIO, CANTIDAD, CANTIDAD_RESERVADA
         FROM INVENTARIO
        WHERE ID_PRODUCTO = :identificadorProducto AND ESTADO = 'A'`,
      { identificadorProducto }, formatoFilas,
    );
    const inventario = resultado.rows[0];
    const disponible = inventario ? redondearCantidad(Number(inventario.CANTIDAD) - Number(inventario.CANTIDAD_RESERVADA)) : 0;
    disponibilidad.push({ identificadorProducto, cantidadRequerida, disponible, faltante: Math.max(0, redondearCantidad(cantidadRequerida - disponible)) });
  }
  return disponibilidad;
}

async function obtenerEstadoPedido(conexion, nombre) {
  const resultado = await conexion.execute(
    `SELECT ID_ESTADO_PEDIDO FROM ESTADO_PEDIDO WHERE NOMBRE = :nombre AND ESTADO = 'A'`,
    { nombre }, formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('No está configurado el estado de pedido para producción.', 409, true);
  return resultado.rows[0].ID_ESTADO_PEDIDO;
}

async function obtenerProduccionBloqueada(conexion, identificadorProduccion, estadoEsperado) {
  const resultado = await conexion.execute(
    `SELECT pr.ID_PRODUCCION, pr.ID_PEDIDO, pr.ESTADO, pr.CANTIDAD_PLANIFICADA,
            pr.RENDIMIENTO_RECETA_APLICADO, r.ID_PRODUCTO AS ID_PRODUCTO_FINAL
       FROM PRODUCCION pr
       JOIN RECETA r ON r.ID_RECETA = pr.ID_RECETA
      WHERE pr.ID_PRODUCCION = :identificadorProduccion
      FOR UPDATE`,
    { identificadorProduccion }, formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('Producción no encontrada.', 404, true);
  const produccion = resultado.rows[0];
  if (produccion.ESTADO !== estadoEsperado) throw crearError('La producción no se encuentra en el estado requerido para esta operación.', 409, true);
  if (!Number(produccion.CANTIDAD_PLANIFICADA) || !Number(produccion.RENDIMIENTO_RECETA_APLICADO)) {
    throw crearError('La producción no tiene una fórmula congelada válida.', 409, true);
  }
  return produccion;
}

async function obtenerDetallesCongeladosYReservas(conexion, identificadorProduccion, bloquear) {
  const detalles = await conexion.execute(
    `SELECT dp.ID_DETALLE_PRODUCCION, dp.ID_PRODUCTO, dp.ID_UNIDAD_MEDIDA,
             dp.CANTIDAD_REQUERIDA
       FROM DETALLE_PRODUCCION dp
      WHERE dp.ID_PRODUCCION = :identificadorProduccion
       ORDER BY dp.ID_PRODUCTO`,
    { identificadorProduccion }, formatoFilas,
  );
  if (!detalles.rows.length) throw crearError('La producción no tiene detalles congelados.', 409, true);
  const bloqueo = bloquear ? ' FOR UPDATE' : '';
  const reservas = await conexion.execute(
    `SELECT ID_RESERVA, ID_INVENTARIO, CANTIDAD
       FROM RESERVA_INVENTARIO
      WHERE ID_PRODUCCION = :identificadorProduccion
        AND TIPO = 'INGREDIENTE' AND ESTADO = 'ACTIVA'${bloqueo}`,
    { identificadorProduccion }, formatoFilas,
  );
  const porInventario = new Map(reservas.rows.map(reserva => [Number(reserva.ID_INVENTARIO), reserva]));
  const detallesConReserva = [];
  for (const detalle of detalles.rows) {
    const inventario = await consultarInventarioProducto(conexion, detalle.ID_PRODUCTO);
    const reserva = inventario ? porInventario.get(Number(inventario.ID_INVENTARIO)) : null;
    if (!reserva || !coincidenCantidades(reserva.CANTIDAD, detalle.CANTIDAD_REQUERIDA)) {
      throw crearError('Las reservas de ingredientes no coinciden con la fórmula congelada.', 409, true);
    }
    detallesConReserva.push({ ...detalle, ID_RESERVA: reserva.ID_RESERVA, ID_INVENTARIO: reserva.ID_INVENTARIO, CANTIDAD_RESERVADA: reserva.CANTIDAD });
  }
  return detallesConReserva;
}

async function bloquearInventariosProduccion(conexion, detalles, identificadorProductoFinal) {
  const inventarios = new Map();
  const porProducto = new Map(detalles.map(detalle => [Number(detalle.ID_PRODUCTO), detalle]));
  const productos = [...new Set([...porProducto.keys(), Number(identificadorProductoFinal)])].sort((primero, segundo) => primero - segundo);
  for (const identificadorProducto of productos) {
    const inventario = await bloquearInventarioProducto(conexion, identificadorProducto);
    const detalle = porProducto.get(identificadorProducto);
    if (detalle && Number(inventario.ID_INVENTARIO) !== Number(detalle.ID_INVENTARIO)) {
      throw crearError('La reserva no coincide con el inventario del ingrediente.', 409, true);
    }
    inventarios.set(identificadorProducto, inventario);
  }
  return inventarios;
}

async function bloquearInventarioProducto(conexion, identificadorProducto) {
  const resultado = await conexion.execute(
    `SELECT ID_INVENTARIO, CANTIDAD, CANTIDAD_RESERVADA
       FROM INVENTARIO
      WHERE ID_PRODUCTO = :identificadorProducto AND ESTADO = 'A'
      FOR UPDATE`,
    { identificadorProducto }, formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('No existe inventario activo para el producto.', 409, true);
  return resultado.rows[0];
}

async function consultarInventarioProducto(conexion, identificadorProducto) {
  const resultado = await conexion.execute(
    `SELECT ID_INVENTARIO
       FROM INVENTARIO
      WHERE ID_PRODUCTO = :identificadorProducto AND ESTADO = 'A'`,
    { identificadorProducto }, formatoFilas,
  );
  return resultado.rows[0] || null;
}

async function cerrarReservaIngrediente(conexion, identificadorReserva, identificadorUsuario) {
  const resultado = await conexion.execute(
    `UPDATE RESERVA_INVENTARIO
        SET ESTADO = 'CONSUMIDA', FECHA_CIERRE = SYSTIMESTAMP,
            ID_USUARIO_CIERRA = :identificadorUsuario
      WHERE ID_RESERVA = :identificadorReserva AND ESTADO = 'ACTIVA'`,
    { identificadorUsuario, identificadorReserva },
  );
  if (resultado.rowsAffected !== 1) throw crearError('La reserva cambió durante la finalización.', 409, true);
}

async function registrarMovimientoInventario(conexion, inventario, identificadorUsuario, tipoMovimiento, identificadorProduccion, existenciaNueva) {
  await conexion.execute(
    `INSERT INTO DETALLE_INVENTARIO
      (ID_INVENTARIO, ID_USUARIO, ORIGEN, ID_REFERENCIA, TIPO_MOVIMIENTO, EXISTENCIA_ANTERIOR, EXISTENCIA_NUEVA)
     VALUES (:identificadorInventario, :identificadorUsuario, 'PRODUCCION', :identificadorProduccion,
             :tipoMovimiento, :existenciaAnterior, :existenciaNueva)`,
    {
      identificadorInventario: inventario.ID_INVENTARIO,
      identificadorUsuario,
      identificadorProduccion,
      tipoMovimiento,
      existenciaAnterior: inventario.CANTIDAD,
      existenciaNueva,
    },
  );
}

async function actualizarPedidoSiTodasFinalizadas(conexion, identificadorPedido) {
  if (!identificadorPedido) return;
  const pendientes = await conexion.execute(
    `SELECT COUNT(*) AS PENDIENTES
       FROM PRODUCCION
      WHERE ID_PEDIDO = :identificadorPedido AND ESTADO <> 'FINALIZADA'`,
    { identificadorPedido }, formatoFilas,
  );
  if (Number(pendientes.rows[0].PENDIENTES) > 0) return;
  const identificadorEstado = await obtenerEstadoPedido(conexion, 'PRODUCIDO');
  await conexion.execute(
    `UPDATE PEDIDO SET ID_ESTADO_PEDIDO = :identificadorEstado
      WHERE ID_PEDIDO = :identificadorPedido`,
    { identificadorEstado, identificadorPedido },
  );
}

function validarIdentificadorProduccion(valor) {
  const identificador = Number(valor);
  if (!Number.isInteger(identificador) || identificador <= 0) throw crearError('El identificador de producción no es válido.', 400, true);
  return identificador;
}

function validarIdentificadorPedidoProduccion(valor) {
  const identificador = Number(valor);
  if (!Number.isInteger(identificador) || identificador <= 0) throw crearError('El identificador de pedido no es válido.', 400, true);
  return identificador;
}

function validarFiltrosProduccion(filtros) {
  const respuesta = {};
  if (filtros?.estado !== undefined && String(filtros.estado).trim()) {
    const estado = String(filtros.estado).trim().toUpperCase();
    const estados = ['PLANIFICADA', 'AUTORIZADA', 'EN_PRODUCCION', 'FINALIZADA', 'CANCELADA'];
    if (!estados.includes(estado)) throw crearError('El estado de producción no es válido.', 400, true);
    respuesta.estado = estado;
  }
  if (filtros?.identificadorPedido !== undefined && String(filtros.identificadorPedido).trim()) {
    const identificadorPedido = Number(filtros.identificadorPedido);
    if (!Number.isInteger(identificadorPedido) || identificadorPedido <= 0) {
      throw crearError('El identificador de pedido no es válido.', 400, true);
    }
    respuesta.identificadorPedido = identificadorPedido;
  }
  return respuesta;
}

function resumirPlan(pedido, producciones, disponibilidad = []) {
  const ingredientes = new Map();
  for (const produccion of producciones) for (const ingrediente of produccion.ingredientes) {
    ingredientes.set(ingrediente.identificadorProducto, redondearCantidad((ingredientes.get(ingrediente.identificadorProducto) || 0) + ingrediente.cantidadRequerida));
  }
  return { identificadorPedido: pedido.identificadorPedido, posicionCola: pedido.posicionCola, producciones, cobertura: producciones.cobertura || [], ingredientesRequeridos: [...ingredientes.entries()].map(([identificadorProducto, cantidadRequerida]) => ({ identificadorProducto, cantidadRequerida })), disponibilidad };
}

function redondearCantidad(valor) { return Number(Number(valor).toFixed(3)); }

function coincidenCantidades(primera, segunda) {
  return Math.abs(Number(primera) - Number(segunda)) < 0.000001;
}

function crearError(mensaje, codigoEstado, exponerAlCliente = false) {
  const error = new Error(mensaje);
  error.codigoEstado = codigoEstado;
  if (exponerAlCliente) error.mensajeCliente = mensaje;
  return error;
}
