import test from 'node:test';
import assert from 'node:assert/strict';
import { obtenerFiltroSucursal } from '../src/servicios/aislamiento-sucursales-servicio.js';
import { autorizarPedido, crearPedido, esEstadoAprobadoParaProduccion, validarDatosNuevoPedido, validarMotivoCancelacion } from '../src/servicios/pedidos-servicio.js';

const pedidoValido = {
  identificadorJornada: 1,
  observaciones: 'Pedido para jornada matutina',
  detalles: [
    { identificadorProducto: 4, cantidad: 35 },
    { identificadorProducto: 5, cantidad: 10 },
  ],
};

test('valida un pedido con detalles enteros positivos y observaciones permitidas', () => {
  assert.deepEqual(validarDatosNuevoPedido(pedidoValido), pedidoValido);
});

test('rechaza detalles vacíos, productos repetidos y cantidades no enteras o no positivas', () => {
  const casos = [
    { ...pedidoValido, detalles: [] },
    { ...pedidoValido, detalles: [{ identificadorProducto: 4, cantidad: 1 }, { identificadorProducto: 4, cantidad: 2 }] },
    { ...pedidoValido, detalles: [{ identificadorProducto: 4, cantidad: 0 }] },
    { ...pedidoValido, detalles: [{ identificadorProducto: 4, cantidad: -1 }] },
    { ...pedidoValido, detalles: [{ identificadorProducto: 4, cantidad: 1.5 }] },
  ];
  for (const datos of casos) {
    assert.throws(() => validarDatosNuevoPedido(datos), error => error.codigoEstado === 400);
  }
});

test('rechaza identificadores de sucursal o usuario entregados por el cliente', () => {
  assert.throws(
    () => validarDatosNuevoPedido({ ...pedidoValido, identificadorSucursal: 99 }),
    error => error.codigoEstado === 400,
  );
  assert.throws(
    () => validarDatosNuevoPedido({ ...pedidoValido, identificadorUsuario: 99 }),
    error => error.codigoEstado === 400,
  );
});

test('valida el motivo de cancelación y su límite Oracle', () => {
  assert.equal(validarMotivoCancelacion('  Corregir cantidades  '), 'Corregir cantidades');
  assert.throws(() => validarMotivoCancelacion(''), error => error.codigoEstado === 400);
  assert.throws(() => validarMotivoCancelacion('x'.repeat(301)), error => error.codigoEstado === 400);
});

test('el filtro de solicitud de cancelación se aplica dentro de SQL para la sucursal autenticada', () => {
  assert.deepEqual(obtenerFiltroSucursal({ identificadorSucursal: 2 }, 'p.ID_SUCURSAL', false), {
    condicion: 'p.ID_SUCURSAL = :identificadorSucursalAutenticada',
    parametros: { identificadorSucursalAutenticada: 2 },
  });
  assert.throws(
    () => obtenerFiltroSucursal({ identificadorSucursal: null }, 'p.ID_SUCURSAL', false),
    error => error.codigoEstado === 403,
  );
});

test('la solicitud de cancelación exige una sucursal en la identidad autenticada', () => {
  assert.throws(
    () => obtenerFiltroSucursal({ identificadorSucursal: null }, 'p.ID_SUCURSAL', false),
    error => error.codigoEstado === 403,
  );
  assert.deepEqual(obtenerFiltroSucursal({ identificadorSucursal: 1 }, 'p.ID_SUCURSAL', false), {
    condicion: 'p.ID_SUCURSAL = :identificadorSucursalAutenticada',
    parametros: { identificadorSucursalAutenticada: 1 },
  });
});

test('reconoce ambos nombres del estado aprobado durante la transición', () => {
  assert.equal(esEstadoAprobadoParaProduccion('AUTORIZADO'), true);
  assert.equal(esEstadoAprobadoParaProduccion('APROBADO_PARA_PRODUCCION'), true);
  assert.equal(esEstadoAprobadoParaProduccion('PENDIENTE'), false);
});

test('bloquea la autorización directa sin modificar el estado mientras falta la planificación', async () => {
  let consultas = 0;
  const conexion = {
    async execute() {
      consultas += 1;
      return { rows: [{ ID_PEDIDO: 50, ESTADO: 'PENDIENTE' }] };
    },
  };
  await assert.rejects(
    () => autorizarPedido(50, { identificadorUsuario: 1 }, conexion),
    error => error.codigoEstado === 409
      && error.mensajeCliente === 'La planificación de producción es necesaria antes de aprobar el pedido.',
  );
  assert.equal(consultas, 1);
});

test('bloquea un pedido ya aprobado bajo cualquiera de los nombres transitorios', async () => {
  for (const estado of ['AUTORIZADO', 'APROBADO_PARA_PRODUCCION']) {
    const conexion = { async execute() { return { rows: [{ ID_PEDIDO: 50, ESTADO: estado }] }; } };
    await assert.rejects(
      () => autorizarPedido(50, { identificadorUsuario: 1 }, conexion),
      error => error.codigoEstado === 409 && error.mensajeCliente === 'El pedido ya fue aprobado para producción.',
    );
  }
});

test('revierte la transacción si falla la inserción de un detalle', async () => {
  let rollback = 0;
  let commit = 0;
  const conexion = {
    async execute(sql) {
      if (sql.includes('FROM JORNADA') || sql.includes('FROM ESTADO_PEDIDO')) {
        return { rows: [{ ID_JORNADA: 1, ID_ESTADO_PEDIDO: 2 }] };
      }
      if (sql.includes('FROM PRODUCTO')) {
        return { rows: [{ ID_PRODUCTO: 3, PRECIO: 2 }] };
      }
      if (sql.includes('INSERT INTO PEDIDO')) return { outBinds: { identificadorPedido: [50] } };
      if (sql.includes('INSERT INTO DETALLE_PEDIDO')) throw new Error('Fallo simulado del detalle');
      throw new Error('Consulta no esperada');
    },
    async commit() { commit += 1; },
    async rollback() { rollback += 1; },
  };
  await assert.rejects(
    () => crearPedido(pedidoValido, { identificadorUsuario: 7, identificadorSucursal: 1 }, conexion),
    /Fallo simulado/,
  );
  assert.equal(commit, 0);
  assert.equal(rollback, 1);
});

test('calcula importes históricos desde productos PFI sin aceptar importes del cliente', async () => {
  const insercionesDetalle = [];
  let cabecera;
  const conexion = {
    async execute(sql, parametros) {
      if (sql.includes('FROM JORNADA')) return { rows: [{ ID_JORNADA: 1 }] };
      if (sql.includes('FROM ESTADO_PEDIDO')) return { rows: [{ ID_ESTADO_PEDIDO: 2 }] };
      if (sql.includes('FROM PRODUCTO')) {
        return { rows: [{ ID_PRODUCTO: parametros.identificadorProducto, PRECIO: parametros.identificadorProducto === 4 ? 2 : 3.5 }] };
      }
      if (sql.includes('INSERT INTO PEDIDO')) { cabecera = parametros; return { outBinds: { identificadorPedido: [50] } }; }
      if (sql.includes('INSERT INTO DETALLE_PEDIDO')) { insercionesDetalle.push(parametros); return {}; }
      if (sql.includes('INSERT INTO BITACORA_PEDIDOS')) return {};
      throw new Error('Consulta no esperada');
    },
    async commit() {}, async rollback() {},
  };
  const creado = await crearPedido(pedidoValido, { identificadorUsuario: 7, identificadorSucursal: 1 }, conexion);
  assert.equal(cabecera.total, 105);
  assert.deepEqual(insercionesDetalle.map(detalle => [detalle.precioUnitario, detalle.subtotal]), [[2, 70], [3.5, 35]]);
  assert.equal(creado.TOTAL, 105);
  assert.throws(() => validarDatosNuevoPedido({ ...pedidoValido, total: 1 }), error => error.codigoEstado === 400);
  assert.throws(() => validarDatosNuevoPedido({ ...pedidoValido, detalles: [{ identificadorProducto: 4, cantidad: 1, precioUnitario: 1 }] }), error => error.codigoEstado === 400);
});

test('rechaza productos que no son finales o no están activos', async () => {
  const conexion = {
    async execute(sql) {
      if (sql.includes('FROM JORNADA')) return { rows: [{ ID_JORNADA: 1 }] };
      if (sql.includes('FROM ESTADO_PEDIDO')) return { rows: [{ ID_ESTADO_PEDIDO: 2 }] };
      if (sql.includes('FROM PRODUCTO')) return { rows: [] };
      throw new Error('No debe insertar pedidos');
    },
    async commit() {}, async rollback() {},
  };
  await assert.rejects(
    () => crearPedido(pedidoValido, { identificadorUsuario: 7, identificadorSucursal: 1 }, conexion),
    error => error.codigoEstado === 404,
  );
});
