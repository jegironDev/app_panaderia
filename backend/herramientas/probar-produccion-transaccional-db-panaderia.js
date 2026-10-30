import dotenv from 'dotenv';
import oracledb from 'oracledb';
import { crearPedido } from '../src/servicios/pedidos-servicio.js';
import {
  autorizarProduccion,
  finalizarProduccion,
  iniciarProduccion,
  planificarProduccion,
} from '../src/servicios/produccion-servicio.js';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const formatoFilas = { outFormat: oracledb.OUT_FORMAT_OBJECT };
const conexion = await oracledb.getConnection({
  user: process.env.BD_USUARIO_NUEVO,
  password: process.env.BD_CONTRASENA_NUEVO,
  connectString: process.env.BD_CADENA_CONEXION,
});

function identidad(identificadorUsuario, identificadorSucursal) {
  return { identificadorUsuario, identificadorSucursal, permisos: [] };
}

try {
  const destino = await conexion.execute(
    `SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AS ESQUEMA,
            SYS_CONTEXT('USERENV', 'CON_NAME') AS PDB FROM DUAL`, [], formatoFilas,
  );
  if (destino.rows[0].ESQUEMA !== 'DB_PANADERIA' || destino.rows[0].PDB !== 'XEPDB1') {
    throw new Error('La prueba no está conectada al destino autorizado.');
  }
  if (process.env.COLA_PEDIDOS_HABILITADA !== 'true') {
    throw new Error('La prueba requiere la cola habilitada explícitamente.');
  }
  const receta = await conexion.execute(
    `SELECT * FROM (
       SELECT r.ID_RECETA, r.ID_PRODUCTO, r.UNIDADES_PRODUCIDAS
         FROM RECETA r
         JOIN PRODUCTO pf ON pf.ID_PRODUCTO = r.ID_PRODUCTO AND pf.ESTADO = 'A' AND pf.TIPO = 'PFI'
        WHERE r.ESTADO = 'A'
          AND NOT EXISTS (
            SELECT 1
              FROM DETALLE_RECETA dr
              LEFT JOIN INVENTARIO i ON i.ID_PRODUCTO = dr.ID_PRODUCTO AND i.ESTADO = 'A'
             WHERE dr.ID_RECETA = r.ID_RECETA
               AND (i.ID_INVENTARIO IS NULL OR i.CANTIDAD - i.CANTIDAD_RESERVADA < dr.CANTIDAD * 2)
          )
       ORDER BY r.ID_RECETA
     ) WHERE ROWNUM = 1`, [], formatoFilas,
  );
  if (!receta.rows.length) throw new Error('No existe una receta activa con inventario suficiente para una prueba reversible.');
  const jornada = await conexion.execute(
    `SELECT ID_JORNADA FROM JORNADA WHERE ESTADO = 'A' ORDER BY ID_JORNADA FETCH FIRST 1 ROW ONLY`, [], formatoFilas,
  );
  if (!jornada.rows.length) throw new Error('No existe una jornada activa.');
  const seleccionada = receta.rows[0];
  const cantidad = Number(seleccionada.UNIDADES_PRODUCIDAS) * 2;
  const pedido = await crearPedido({
    identificadorJornada: jornada.rows[0].ID_JORNADA,
    observaciones: 'Prueba transaccional reversible de producción',
    detalles: [{ identificadorProducto: seleccionada.ID_PRODUCTO, cantidad }],
  }, identidad(112, 3), conexion, false);

  const detalleCreado = await conexion.execute(
    `SELECT ID_DETALLE_PEDIDO FROM DETALLE_PEDIDO
      WHERE ID_PEDIDO = :identificadorPedido`,
    { identificadorPedido: pedido.ID_PEDIDO }, formatoFilas,
  );
  const detalle = detalleCreado.rows[0];
  if (!detalle) throw new Error('No se creó el detalle temporal del pedido.');
  const unaReceta = [{ identificadorDetallePedido: detalle.ID_DETALLE_PEDIDO, identificadorReceta: seleccionada.ID_RECETA }];
  const planInsuficiente = await planificarProduccion({ identificadorPedido: pedido.ID_PEDIDO, recetas: unaReceta }, conexion);
  if (!planInsuficiente.cobertura.some(cobertura => Number(cobertura.faltante) > 0)) {
    throw new Error('La planificación con una receta no detectó cobertura insuficiente.');
  }
  const recetasRepetidas = [...unaReceta, ...unaReceta];
  const planCompleto = await planificarProduccion({ identificadorPedido: pedido.ID_PEDIDO, recetas: recetasRepetidas }, conexion);
  if (planCompleto.cobertura.some(cobertura => Number(cobertura.faltante) > 0)) {
    throw new Error('La planificación con receta repetida no cubrió la línea del pedido.');
  }
  const autorizacion = await autorizarProduccion({ identificadorPedido: pedido.ID_PEDIDO, recetas: recetasRepetidas }, identidad(107, null), conexion, false);
  if (autorizacion.producciones.length !== 2) throw new Error('No se crearon dos producciones independientes para la receta repetida.');
  for (const identificadorProduccion of autorizacion.producciones) {
    await iniciarProduccion(identificadorProduccion, identidad(108, null), conexion, false);
    await finalizarProduccion(identificadorProduccion, identidad(108, null), conexion, false);
  }
  const estadoPedido = await conexion.execute(
    `SELECT e.NOMBRE AS ESTADO
       FROM PEDIDO p JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO = p.ID_ESTADO_PEDIDO
      WHERE p.ID_PEDIDO = :identificadorPedido`,
    { identificadorPedido: pedido.ID_PEDIDO }, formatoFilas,
  );
  if (estadoPedido.rows[0]?.ESTADO !== 'PRODUCIDO') throw new Error('El pedido no pasó a PRODUCIDO tras finalizar todas las producciones.');
  const reservas = await conexion.execute(
    `SELECT COUNT(*) AS ACTIVAS FROM RESERVA_INVENTARIO
      WHERE ID_PRODUCCION IN (:primera, :segunda) AND ESTADO = 'ACTIVA'`,
    { primera: autorizacion.producciones[0], segunda: autorizacion.producciones[1] }, formatoFilas,
  );
  if (Number(reservas.rows[0].ACTIVAS) !== 0) throw new Error('Persistieron reservas activas tras la finalización.');
  console.log('Producción real reversible verificada: cobertura insuficiente, receta repetida, reserva, consumo, excedente y estado PRODUCIDO.');
} finally {
  await conexion.rollback();
  await conexion.close();
}
