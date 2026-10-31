import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estaColaPedidosHabilitada,
  consultarColaPedidos,
  consultarPedidosPendientesSinCola,
  incorporarPedidoEnCola,
  exigirColaPedidosHabilitada,
  moverPedidoEnCola,
  retirarPedidoDeCola,
} from '../src/servicios/cola-pedidos-servicio.js';
import { crearPedido } from '../src/servicios/pedidos-servicio.js';
import { requerirPermiso } from '../src/intermediarios/autorizacion.js';

const pedidoValido = {
  identificadorJornada: 1,
  observaciones: null,
  detalles: [{ identificadorProducto: 4, cantidad: 2 }],
};

test('la cola permanece deshabilitada de forma explícita por defecto', () => {
  const valorAnterior = process.env.COLA_PEDIDOS_HABILITADA;
  delete process.env.COLA_PEDIDOS_HABILITADA;
  try {
    assert.equal(estaColaPedidosHabilitada(), false);
    assert.throws(
      () => exigirColaPedidosHabilitada(),
      error => error.codigoEstado === 503 && /todavía no está disponible/.test(error.mensajeCliente),
    );
  } finally {
    if (valorAnterior === undefined) delete process.env.COLA_PEDIDOS_HABILITADA;
    else process.env.COLA_PEDIDOS_HABILITADA = valorAnterior;
  }
});

test('las operaciones de cola se rechazan antes de consultar Oracle mientras la migración no exista', async () => {
  await assert.rejects(
    () => consultarColaPedidos(false),
    error => error.codigoEstado === 503 && /todavía no está disponible/.test(error.mensajeCliente),
  );
  await assert.rejects(
    () => moverPedidoEnCola(10, 'SUBIR', null, false),
    error => error.codigoEstado === 503,
  );
});

test('crear pedido sin migración no referencia POSICION_COLA', async () => {
  const valorAnterior = process.env.COLA_PEDIDOS_HABILITADA;
  delete process.env.COLA_PEDIDOS_HABILITADA;
  let sentenciaCabecera = '';
  const conexion = {
    async execute(sql, parametros) {
      if (sql.includes('FROM JORNADA')) return { rows: [{ ID_JORNADA: 1 }] };
      if (sql.includes('FROM ESTADO_PEDIDO')) return { rows: [{ ID_ESTADO_PEDIDO: 1 }] };
      if (sql.includes('FROM PRODUCTO')) return { rows: [{ ID_PRODUCTO: 4, PRECIO: 2 }] };
      if (sql.includes('INSERT INTO PEDIDO')) {
        sentenciaCabecera = sql;
        assert.equal(Object.hasOwn(parametros, 'posicionCola'), false);
        return { outBinds: { identificadorPedido: [91] } };
      }
      if (sql.includes('INSERT INTO DETALLE_PEDIDO') || sql.includes('INSERT INTO BITACORA_PEDIDOS')) return {};
      throw new Error('Consulta no esperada');
    },
    async commit() {},
    async rollback() {},
  };
  try {
    await crearPedido(pedidoValido, { identificadorUsuario: 1, identificadorSucursal: 1 }, conexion);
    assert.equal(sentenciaCabecera.includes('POSICION_COLA'), false);
  } finally {
    if (valorAnterior === undefined) delete process.env.COLA_PEDIDOS_HABILITADA;
    else process.env.COLA_PEDIDOS_HABILITADA = valorAnterior;
  }
});

test('crear pedido asigna posición dentro de la transacción solo cuando la cola está habilitada', async () => {
  const valorAnterior = process.env.COLA_PEDIDOS_HABILITADA;
  process.env.COLA_PEDIDOS_HABILITADA = 'true';
  const llamadas = [];
  const conexion = {
    async execute(sql, parametros) {
      llamadas.push({ sql, parametros });
      if (sql.includes('COLA_PEDIDOS_CONTROL')) return { rows: [{ ID_CONTROL: 1 }] };
      if (sql.includes('FROM DUAL')) return { rows: [{ POSICION_COLA: 76 }] };
      if (sql.includes('FROM JORNADA')) return { rows: [{ ID_JORNADA: 1 }] };
      if (sql.includes('FROM ESTADO_PEDIDO')) return { rows: [{ ID_ESTADO_PEDIDO: 1 }] };
      if (sql.includes('FROM PRODUCTO')) return { rows: [{ ID_PRODUCTO: 4, PRECIO: 2 }] };
      if (sql.includes('INSERT INTO PEDIDO')) return { outBinds: { identificadorPedido: [92] } };
      if (sql.includes('INSERT INTO DETALLE_PEDIDO') || sql.includes('INSERT INTO BITACORA_PEDIDOS')) return {};
      throw new Error('Consulta no esperada');
    },
    async commit() {},
    async rollback() {},
  };
  try {
    await crearPedido(pedidoValido, { identificadorUsuario: 1, identificadorSucursal: 1 }, conexion);
    assert.equal(llamadas[0].sql.includes('COLA_PEDIDOS_CONTROL'), true);
    const insercion = llamadas.find(llamada => llamada.sql.includes('INSERT INTO PEDIDO'));
    assert.equal(insercion.sql.includes('POSICION_COLA'), true);
    assert.equal(insercion.parametros.posicionCola, 76);
  } finally {
    if (valorAnterior === undefined) delete process.env.COLA_PEDIDOS_HABILITADA;
    else process.env.COLA_PEDIDOS_HABILITADA = valorAnterior;
  }
});

test('lista pendientes fuera de cola sin asignarles una posición', async () => {
  let cerro = false;
  const conexion = { async execute(sql) { assert.match(sql, /POSICION_COLA IS NULL/); return { rows: [{ ID_PEDIDO: 21, POSICION_COLA: null }] }; }, async close() { cerro = true; } };
  const pendientes = await consultarPedidosPendientesSinCola(conexion, true);
  assert.deepEqual(pendientes, [{ ID_PEDIDO: 21, POSICION_COLA: null }]);
  assert.equal(cerro, false);
});

test('incorporar a cola bloquea el coordinador, asigna secuencia y audita en una transacción', async () => {
  const llamadas = []; let commits = 0; let rollbacks = 0;
  const conexion = {
    async execute(sql, parametros) {
      llamadas.push({ sql, parametros });
      if (sql.includes('COLA_PEDIDOS_CONTROL')) return { rows: [{ ID_CONTROL: 1 }] };
      if (sql.includes('FROM PEDIDO p JOIN ESTADO_PEDIDO')) return { rows: [{ ID_PEDIDO: 21, POSICION_COLA: null, ESTADO: 'PENDIENTE' }] };
      if (sql.includes('FROM DUAL')) return { rows: [{ POSICION_COLA: 77 }] };
      if (sql.startsWith('UPDATE PEDIDO')) return { rowsAffected: 1 };
      if (sql.includes('INSERT INTO BITACORA_PEDIDOS')) return {};
      throw new Error('Consulta no esperada');
    },
    async commit() { commits += 1; }, async rollback() { rollbacks += 1; },
  };
  const resultado = await incorporarPedidoEnCola(21, { identificadorUsuario: 5 }, conexion, true);
  assert.deepEqual(resultado, { identificadorPedido: 21, posicionCola: 77 });
  assert.equal(llamadas[0].sql.includes('COLA_PEDIDOS_CONTROL'), true);
  assert.equal(llamadas.find(llamada => llamada.sql.startsWith('UPDATE PEDIDO')).parametros.posicionCola, 77);
  assert.equal(commits, 1); assert.equal(rollbacks, 0);
});

test('incorporar rechaza pedidos aprobados o ya presentes sin modificar la cola', async () => {
  for (const pedido of [{ ESTADO: 'APROBADO_PARA_PRODUCCION', POSICION_COLA: null }, { ESTADO: 'PENDIENTE', POSICION_COLA: 12 }]) {
    let actualizaciones = 0; let rollback = 0;
    const conexion = { async execute(sql) { if (sql.includes('COLA_PEDIDOS_CONTROL')) return { rows: [{ ID_CONTROL: 1 }] }; if (sql.includes('FROM PEDIDO p JOIN ESTADO_PEDIDO')) return { rows: [{ ID_PEDIDO: 22, ...pedido }] }; if (sql.startsWith('UPDATE PEDIDO')) actualizaciones += 1; throw new Error('No esperada'); }, async commit() {}, async rollback() { rollback += 1; } };
    await assert.rejects(() => incorporarPedidoEnCola(22, { identificadorUsuario: 5 }, conexion, true), error => error.codigoEstado === 409);
    assert.equal(actualizaciones, 0); assert.equal(rollback, 1);
  }
});

test('reordenar bloquea primero el coordinador y usa una posición temporal única', async () => {
  const llamadas = [];
  let commits = 0;
  let rollbacks = 0;
  const conexion = {
    async execute(sql, parametros) {
      llamadas.push({ sql, parametros });
      if (sql.includes('COLA_PEDIDOS_CONTROL')) return { rows: [{ ID_CONTROL: 1 }] };
      if (sql.includes('FROM DUAL')) return { rows: [{ POSICION_COLA: 99 }] };
      if (sql.includes('FOR UPDATE') && parametros?.identificadorPedido === 10) {
        return { rows: [{ ID_PEDIDO: 10, POSICION_COLA: 20 }] };
      }
      if (sql.includes('ROWNUM = 1')) return { rows: [{ ID_PEDIDO: 20, POSICION_COLA: 10 }] };
      if (sql.includes('FOR UPDATE') && parametros?.identificadorPedido === 20) {
        return { rows: [{ ID_PEDIDO: 20, POSICION_COLA: 10 }] };
      }
      if (sql.startsWith('UPDATE PEDIDO')) return {};
      throw new Error('Consulta no esperada');
    },
    async commit() { commits += 1; },
    async rollback() { rollbacks += 1; },
  };
  const resultado = await moverPedidoEnCola(10, 'SUBIR', conexion, true);
  assert.equal(llamadas[0].sql.includes('COLA_PEDIDOS_CONTROL'), true);
  assert.equal(commits, 1);
  assert.equal(rollbacks, 0);
  assert.deepEqual(resultado, { identificadorPedido: 10, posicionCola: 10 });
  const actualizaciones = llamadas.filter(llamada => llamada.sql.startsWith('UPDATE PEDIDO'));
  assert.deepEqual(actualizaciones.map(llamada => llamada.parametros.posicion), [99, 20, 10]);
});

test('bajar intercambia con el siguiente pedido pendiente', async () => {
  const actualizaciones = [];
  const conexion = {
    async execute(sql, parametros) {
      if (sql.includes('COLA_PEDIDOS_CONTROL')) return { rows: [{ ID_CONTROL: 1 }] };
      if (sql.includes('FROM DUAL')) return { rows: [{ POSICION_COLA: 99 }] };
      if (sql.includes('FOR UPDATE') && parametros?.identificadorPedido === 10) return { rows: [{ ID_PEDIDO: 10, POSICION_COLA: 10 }] };
      if (sql.includes('ROWNUM = 1')) return { rows: [{ ID_PEDIDO: 20, POSICION_COLA: 20 }] };
      if (sql.includes('FOR UPDATE') && parametros?.identificadorPedido === 20) return { rows: [{ ID_PEDIDO: 20, POSICION_COLA: 20 }] };
      if (sql.startsWith('UPDATE PEDIDO')) { actualizaciones.push(parametros); return {}; }
      throw new Error('Consulta no esperada');
    },
    async commit() {},
    async rollback() {},
  };
  const resultado = await moverPedidoEnCola(10, 'BAJAR', conexion, true);
  assert.deepEqual(resultado, { identificadorPedido: 10, posicionCola: 20 });
  assert.deepEqual(actualizaciones.map(actualizacion => actualizacion.posicion), [99, 10, 20]);
});

test('reordenar revierte si la cola cambia antes de bloquear el vecino', async () => {
  let rollback = 0;
  const conexion = {
    async execute(sql, parametros) {
      if (sql.includes('COLA_PEDIDOS_CONTROL')) return { rows: [{ ID_CONTROL: 1 }] };
      if (sql.includes('FOR UPDATE') && parametros?.identificadorPedido === 10) return { rows: [{ ID_PEDIDO: 10, POSICION_COLA: 20 }] };
      if (sql.includes('ROWNUM = 1')) return { rows: [{ ID_PEDIDO: 20, POSICION_COLA: 10 }] };
      if (sql.includes('FOR UPDATE') && parametros?.identificadorPedido === 20) return { rows: [{ ID_PEDIDO: 20, POSICION_COLA: 11 }] };
      throw new Error('Consulta no esperada');
    },
    async commit() { throw new Error('No debe confirmar'); },
    async rollback() { rollback += 1; },
  };
  await assert.rejects(() => moverPedidoEnCola(10, 'SUBIR', conexion, true), error => error.codigoEstado === 409);
  assert.equal(rollback, 1);
});

test('retirar de la cola mantiene el bloqueo coordinador y deja la posición nula', async () => {
  const llamadas = [];
  const conexion = {
    async execute(sql, parametros) {
      llamadas.push({ sql, parametros });
      if (sql.includes('COLA_PEDIDOS_CONTROL')) return { rows: [{ ID_CONTROL: 1 }] };
      if (sql.includes('FOR UPDATE')) return { rows: [{ ID_PEDIDO: 10, POSICION_COLA: 20 }] };
      if (sql.startsWith('UPDATE PEDIDO')) return {};
      throw new Error('Consulta no esperada');
    },
  };
  await retirarPedidoDeCola(conexion, 10, true);
  assert.equal(llamadas[0].sql.includes('COLA_PEDIDOS_CONTROL'), true);
  assert.equal(llamadas.at(-1).parametros.identificadorPedido, 10);
});

test('la autorización de cola exige AUTORIZAR_PRODUCCION sin basarse en el tipo', () => {
  let codigoEstado;
  const respuesta = { status(codigo) { codigoEstado = codigo; return this; }, json() {} };
  let siguiente = false;
  requerirPermiso('AUTORIZAR_PRODUCCION')(
    { identidad: { tipo: 'ADMIN', permisos: [] } },
    respuesta,
    () => { siguiente = true; },
  );
  assert.equal(codigoEstado, 403);
  assert.equal(siguiente, false);
});
