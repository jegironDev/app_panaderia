import test from 'node:test';
import assert from 'node:assert/strict';
import { requerirPermiso } from '../src/intermediarios/autorizacion.js';
import {
  autorizarProduccion,
  consultarOpcionesPlanificacion,
  consultarProduccionesPorPedido,
  finalizarProduccion,
  iniciarProduccion,
  listarProducciones,
  planificarProduccion,
  validarSolicitudPlanificacion,
} from '../src/servicios/produccion-servicio.js';

const solicitud = {
  identificadorPedido: 8,
  recetas: [{ identificadorDetallePedido: 81, identificadorReceta: 11 }],
};
const identidad = { identificadorUsuario: 1, permisos: ['AUTORIZAR_PRODUCCION'] };

test('planifica una ejecución independiente sin lotes y conserva la cobertura', async () => {
  const plan = await planificarProduccion(solicitud, crearConexionProduccion());
  assert.equal(plan.producciones[0].cantidadSolicitada, 6);
  assert.equal(plan.producciones[0].cantidadPlanificada, 30);
  assert.equal(plan.producciones[0].cantidadExcedente, 24);
  assert.deepEqual(plan.cobertura, [{ identificadorDetallePedido: 81, producto: 'Pan francés', cantidadSolicitada: 6, cantidadPlanificada: 30, faltante: 0 }]);
  assert.deepEqual(plan.disponibilidad, [{ identificadorProducto: 6, cantidadRequerida: 2, disponible: 9, faltante: 0 }]);
});

test('expone recetas activas compatibles para seleccionar explícitamente la planificación', async () => {
  const opciones = await consultarOpcionesPlanificacion(8, crearConexionProduccion());
  assert.equal(opciones.detalles[0].identificadorDetallePedido, 81);
  assert.deepEqual(opciones.detalles[0].recetas, [{ ID_RECETA: 11, NOMBRE: 'Pan francés estándar', UNIDADES_PRODUCIDAS: 30 }]);
});

test('rechaza una receta que no corresponde al producto solicitado', async () => {
  const conexion = crearConexionProduccion({ recetaCompatible: false });
  await assert.rejects(() => planificarProduccion(solicitud, conexion), error => error.codigoEstado === 409);
});

test('informa faltante durante planificación sin crear reservas', async () => {
  const conexion = crearConexionProduccion({ cantidadInventario: 1, cantidadReservada: 0 });
  const plan = await planificarProduccion(solicitud, conexion);
  assert.equal(plan.disponibilidad[0].faltante, 1);
  assert.equal(conexion.operaciones.some(sql => sql.includes('INSERT INTO RESERVA_INVENTARIO')), false);
});

test('autoriza, congela ingredientes y reserva sin consumir inventario físico', async () => {
  const conexion = crearConexionProduccion();
  await conColaHabilitada(() => autorizarProduccion(solicitud, identidad, conexion));
  assert.equal(conexion.commitCount, 1);
  assert.equal(conexion.rollbackCount, 0);
  assert.ok(conexion.operaciones.some(sql => sql.includes('INSERT INTO DETALLE_PRODUCCION')));
  assert.ok(conexion.operaciones.some(sql => sql.includes('INSERT INTO RESERVA_INVENTARIO')));
  assert.ok(conexion.operaciones.some(sql => sql.includes('SET CANTIDAD_RESERVADA = CANTIDAD_RESERVADA +')));
  assert.equal(conexion.operaciones.some(sql => /SET CANTIDAD\s*=/.test(sql)), false);
  assert.ok(conexion.operaciones.some(sql => sql.includes("'AUTORIZADA'")));
});

test('revierte toda la autorización si falla al congelar un ingrediente', async () => {
  const conexion = crearConexionProduccion({ fallarDetalle: true });
  await conColaHabilitada(async () => {
    await assert.rejects(() => autorizarProduccion(solicitud, identidad, conexion), /Fallo simulado/);
  });
  assert.equal(conexion.commitCount, 0);
  assert.equal(conexion.rollbackCount, 1);
});

test('impide autorizar dos veces el mismo pedido después de retirar su posición de cola', async () => {
  const conexion = crearConexionProduccion();
  await conColaHabilitada(() => autorizarProduccion(solicitud, identidad, conexion));
  await conColaHabilitada(async () => {
    await assert.rejects(() => autorizarProduccion(solicitud, identidad, conexion), error => error.codigoEstado === 409);
  });
});

test('acepta recetas repetidas como producciones independientes y rechaza una selección vacía', () => {
  assert.throws(() => validarSolicitudPlanificacion({ identificadorPedido: 8, recetas: [] }), error => error.codigoEstado === 400);
  const validada = validarSolicitudPlanificacion({ identificadorPedido: 8, recetas: [{ identificadorDetallePedido: 81, identificadorReceta: 11 }, { identificadorDetallePedido: 81, identificadorReceta: 11 }] });
  assert.equal(validada.recetas.length, 2);
});

test('la ruta de producción exige AUTORIZAR_PRODUCCION', () => {
  let codigo;
  requerirPermiso('AUTORIZAR_PRODUCCION')(
    { identidad: { permisos: [] } },
    { status(valor) { codigo = valor; return this; }, json() {} },
    () => assert.fail('No debe continuar'),
  );
  assert.equal(codigo, 403);
});

test('inicia una producción autorizada sin consumir inventario ni liberar reservas', async () => {
  const conexion = crearConexionCicloProduccion();
  const respuesta = await iniciarProduccion(21, { identificadorUsuario: 1 }, conexion);
  assert.equal(respuesta.estado, 'EN_PRODUCCION');
  assert.equal(conexion.commitCount, 1);
  assert.equal(conexion.operaciones.some(sql => sql.includes("SET ESTADO = 'CONSUMIDA'")), false);
  assert.equal(conexion.operaciones.some(sql => sql.includes('INSERT INTO DETALLE_INVENTARIO')), false);
  assert.equal(conexion.operaciones.some(sql => /UPDATE INVENTARIO\s+SET CANTIDAD =/.test(sql)), false);
});

test('rechaza iniciar dos veces una producción o una histórica finalizada', async () => {
  const conexion = crearConexionCicloProduccion({ estadoProduccion: 'FINALIZADA' });
  await assert.rejects(() => iniciarProduccion(21, { identificadorUsuario: 1 }, conexion), error => error.codigoEstado === 409);
  assert.equal(conexion.commitCount, 0);
  assert.equal(conexion.rollbackCount, 1);
});

test('rechaza finalizar una producción que ya finalizó sin generar movimientos nuevos', async () => {
  const conexion = crearConexionCicloProduccion({ estadoProduccion: 'FINALIZADA' });
  await assert.rejects(() => finalizarProduccion(21, { identificadorUsuario: 7 }, conexion), error => error.codigoEstado === 409);
  assert.equal(conexion.operaciones.some(sql => sql.includes('INSERT INTO DETALLE_INVENTARIO')), false);
  assert.equal(conexion.commitCount, 0);
});

test('finaliza de forma atómica: consume reservas, registra movimientos y aumenta el producto final', async () => {
  const conexion = crearConexionCicloProduccion({ estadoProduccion: 'EN_PRODUCCION', produccionesPendientes: 0 });
  const respuesta = await finalizarProduccion(21, { identificadorUsuario: 7 }, conexion);
  assert.equal(respuesta.estado, 'FINALIZADA');
  assert.equal(respuesta.cantidadProducida, 50);
  assert.equal(conexion.commitCount, 1);
  assert.equal(conexion.operaciones.filter(sql => sql.includes("SET ESTADO = 'CONSUMIDA'")).length, 2);
  assert.equal(conexion.operaciones.filter(sql => sql.includes('INSERT INTO DETALLE_INVENTARIO')).length, 3);
  assert.ok(conexion.operaciones.some(sql => sql.includes("TIPO_MOVIMIENTO") && sql.includes("'PRODUCCION'")));
  assert.ok(conexion.operaciones.some(sql => sql.includes("SET ESTADO = 'FINALIZADA'")));
  assert.ok(conexion.operaciones.some(sql => sql.includes('UPDATE PEDIDO SET ID_ESTADO_PEDIDO')));
  assert.equal(conexion.operaciones.some(sql => sql.includes('UPDATE DETALLE_PEDIDO')), false);
});

test('mantiene el pedido sin cambios mientras exista otra producción no finalizada', async () => {
  const conexion = crearConexionCicloProduccion({ estadoProduccion: 'EN_PRODUCCION', produccionesPendientes: 1 });
  await finalizarProduccion(21, { identificadorUsuario: 7 }, conexion);
  assert.equal(conexion.operaciones.some(sql => sql.includes('UPDATE PEDIDO SET ID_ESTADO_PEDIDO')), false);
});

test('revierte la finalización si falla el movimiento de inventario', async () => {
  const conexion = crearConexionCicloProduccion({ estadoProduccion: 'EN_PRODUCCION', fallarMovimiento: true });
  await assert.rejects(() => finalizarProduccion(21, { identificadorUsuario: 7 }, conexion), /Fallo simulado/);
  assert.equal(conexion.commitCount, 0);
  assert.equal(conexion.rollbackCount, 1);
});

test('las rutas de inicio y finalización exigen sus permisos específicos', () => {
  for (const permiso of ['INICIAR_PRODUCCION', 'CONFIRMAR_PRODUCCION']) {
    let codigo;
    requerirPermiso(permiso)(
      { identidad: { permisos: [] } },
      { status(valor) { codigo = valor; return this; }, json() {} },
      () => assert.fail('No debe continuar'),
    );
    assert.equal(codigo, 403);
  }
});

test('lista producciones y aplica filtros parametrizados sin escribir en Oracle', async () => {
  const conexion = {
    parametros: null,
    async execute(sql, parametros) {
      this.parametros = parametros;
      assert.match(sql, /pr\.ESTADO = :estado/);
      assert.match(sql, /pr\.ID_PEDIDO = :identificadorPedido/);
      return { rows: [{ ID_PRODUCCION: 21, ESTADO: 'FINALIZADA' }] };
    },
  };
  const resultado = await listarProducciones({ estado: 'finalizada', identificadorPedido: '8' }, conexion);
  assert.equal(resultado[0].ID_PRODUCCION, 21);
  assert.deepEqual(conexion.parametros, { estado: 'FINALIZADA', identificadorPedido: 8 });
});

test('rechaza filtros de producción inválidos', async () => {
  await assert.rejects(() => listarProducciones({ estado: 'CUALQUIERA' }, {}), error => error.codigoEstado === 400);
  await assert.rejects(() => listarProducciones({ identificadorPedido: '0' }, {}), error => error.codigoEstado === 400);
});

test('consulta un pedido agrupado con sucursal e ingredientes congelados sin modificar datos', async () => {
  const consultas = [];
  const conexion = {
    async execute(sql) {
      consultas.push(sql);
      if (sql.includes('FROM PEDIDO pe')) return { rows: [{ ID_PEDIDO: 8, SUCURSAL: 'Centro', ESTADO_PEDIDO: 'PRODUCIDO' }] };
      if (sql.includes('FROM PRODUCCION pr')) return { rows: [{ ID_PRODUCCION: 21, PRODUCTO: 'Pan dulce', RECETA: 'Dulce', ESTADO: 'FINALIZADA' }] };
      if (sql.includes('FROM DETALLE_PRODUCCION dp')) return { rows: [{ ID_PRODUCCION: 21, INGREDIENTE: 'Harina', CANTIDAD_REQUERIDA: 2.5, ABREVIATURA: 'kg' }] };
      throw new Error(`Consulta no esperada: ${sql}`);
    },
  };
  const pedido = await consultarProduccionesPorPedido(8, conexion);
  assert.equal(pedido.SUCURSAL, 'Centro');
  assert.equal(pedido.PRODUCCIONES[0].INGREDIENTES[0].INGREDIENTE, 'Harina');
  assert.equal(consultas.some(sql => /^\s*(INSERT|UPDATE|DELETE)/im.test(sql)), false);
});

async function conColaHabilitada(funcion) {
  const anterior = process.env.COLA_PEDIDOS_HABILITADA;
  process.env.COLA_PEDIDOS_HABILITADA = 'true';
  try { return await funcion(); } finally {
    if (anterior === undefined) delete process.env.COLA_PEDIDOS_HABILITADA;
    else process.env.COLA_PEDIDOS_HABILITADA = anterior;
  }
}

function crearConexionProduccion(opciones = {}) {
  let estadoPedido = 'PENDIENTE';
  let posicionCola = 1;
  let siguienteProduccion = 100;
  const conexion = {
    operaciones: [], commitCount: 0, rollbackCount: 0,
    async execute(sql, parametros = {}) {
      this.operaciones.push(sql);
      if (sql.includes('COLA_PEDIDOS_CONTROL')) return { rows: [{ ID_CONTROL: 1 }] };
      if (sql.includes('FROM PEDIDO p JOIN ESTADO_PEDIDO')) return { rows: [{ ID_PEDIDO: 8, POSICION_COLA: posicionCola, ESTADO: estadoPedido }] };
      if (sql.includes('FROM DETALLE_PEDIDO')) return { rows: [{ ID_DETALLE_PEDIDO: 81, ID_PRODUCTO: 9, CANTIDAD: 6, NOMBRE_PRODUCTO: 'Pan francés' }] };
      if (sql.includes('FROM RECETA')) return { rows: opciones.recetaCompatible === false ? [] : [{ ID_RECETA: 11, NOMBRE: 'Pan francés estándar', UNIDADES_PRODUCIDAS: 30 }] };
      if (sql.includes('FROM DETALLE_RECETA')) return { rows: [{ ID_PRODUCTO: 6, ID_UNIDAD_MEDIDA: 5, CANTIDAD: 2 }] };
      if (sql.includes('FROM INVENTARIO')) return { rows: [{ ID_INVENTARIO: 60, CANTIDAD: opciones.cantidadInventario ?? 10, CANTIDAD_RESERVADA: opciones.cantidadReservada ?? 1 }] };
      if (sql.includes('FROM ESTADO_PEDIDO WHERE NOMBRE')) return { rows: [{ ID_ESTADO_PEDIDO: 4 }] };
      if (sql.includes('INSERT INTO PRODUCCION')) return { outBinds: { identificadorProduccion: [siguienteProduccion++] } };
      if (sql.includes('INSERT INTO DETALLE_PRODUCCION')) {
        if (opciones.fallarDetalle) throw new Error('Fallo simulado al congelar detalle');
        return {};
      }
      if (sql.includes('INSERT INTO RESERVA_INVENTARIO') || sql.includes('UPDATE INVENTARIO') || sql.includes('BITACORA_PEDIDOS')) return {};
      if (sql.includes('UPDATE PEDIDO')) { estadoPedido = 'APROBADO_PARA_PRODUCCION'; posicionCola = null; return { rowsAffected: 1 }; }
      throw new Error(`Consulta no esperada: ${sql}`);
    },
    async commit() { this.commitCount += 1; },
    async rollback() { this.rollbackCount += 1; },
  };
  return conexion;
}

function crearConexionCicloProduccion(opciones = {}) {
  const estado = opciones.estadoProduccion ?? 'AUTORIZADA';
  let bloqueosInventario = 0;
  const conexion = {
    operaciones: [], commitCount: 0, rollbackCount: 0,
    async execute(sql, parametros = {}) {
      this.operaciones.push(sql);
      if (sql.includes('FROM PRODUCCION pr') && sql.includes('FOR UPDATE')) {
        return { rows: [{ ID_PRODUCCION: 21, ID_PEDIDO: 8, ESTADO: estado, CANTIDAD_PLANIFICADA: 50, RENDIMIENTO_RECETA_APLICADO: 50, ID_PRODUCTO_FINAL: 9 }] };
      }
      if (sql.includes('FROM DETALLE_PRODUCCION dp')) {
        return { rows: [
          { ID_DETALLE_PRODUCCION: 1, ID_PRODUCTO: 6, ID_UNIDAD_MEDIDA: 5, CANTIDAD_REQUERIDA: 2.5 },
          { ID_DETALLE_PRODUCCION: 2, ID_PRODUCTO: 8, ID_UNIDAD_MEDIDA: 5, CANTIDAD_REQUERIDA: 0.05 },
        ] };
      }
      if (sql.includes('FROM RESERVA_INVENTARIO')) {
        return { rows: [
          { ID_RESERVA: 101, ID_INVENTARIO: 60, CANTIDAD: 2.5 },
          { ID_RESERVA: 102, ID_INVENTARIO: 80, CANTIDAD: 0.05 },
        ] };
      }
      if (sql.includes('SELECT ID_INVENTARIO\n       FROM INVENTARIO')) {
        const inventarios = { 6: 60, 8: 80 };
        return { rows: [{ ID_INVENTARIO: inventarios[parametros.identificadorProducto] }] };
      }
      if (sql.includes('FROM INVENTARIO') && sql.includes('FOR UPDATE')) {
        bloqueosInventario += 1;
        const inventarios = [
          { ID_INVENTARIO: 60, CANTIDAD: 10, CANTIDAD_RESERVADA: 2.5 },
          { ID_INVENTARIO: 80, CANTIDAD: 1, CANTIDAD_RESERVADA: 0.05 },
          { ID_INVENTARIO: 90, CANTIDAD: 4, CANTIDAD_RESERVADA: 0 },
        ];
        return { rows: [inventarios[bloqueosInventario - 1]] };
      }
      if (sql.includes("UPDATE PRODUCCION SET ESTADO = 'EN_PRODUCCION'")) return { rowsAffected: 1 };
      if (sql.includes('UPDATE INVENTARIO')) return { rowsAffected: 1 };
      if (sql.includes('INSERT INTO DETALLE_INVENTARIO')) {
        if (opciones.fallarMovimiento) throw new Error('Fallo simulado de movimiento');
        return { rowsAffected: 1 };
      }
      if (sql.includes("UPDATE RESERVA_INVENTARIO")) return { rowsAffected: 1 };
      if (sql.includes("SET ESTADO = 'FINALIZADA'")) return { rowsAffected: 1 };
      if (sql.includes('COUNT(*) AS PENDIENTES')) return { rows: [{ PENDIENTES: opciones.produccionesPendientes ?? 1 }] };
      if (sql.includes('FROM ESTADO_PEDIDO WHERE NOMBRE')) return { rows: [{ ID_ESTADO_PEDIDO: 7 }] };
      if (sql.includes('UPDATE PEDIDO SET ID_ESTADO_PEDIDO')) return { rowsAffected: 1 };
      throw new Error(`Consulta no esperada: ${sql}`);
    },
    async commit() { this.commitCount += 1; },
    async rollback() { this.rollbackCount += 1; },
  };
  return conexion;
}
