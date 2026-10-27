import test from 'node:test';
import assert from 'node:assert/strict';
import { obtenerFiltroSucursal } from '../src/servicios/aislamiento-sucursales-servicio.js';
import { crearPedido, validarDatosNuevoPedido, validarMotivoCancelacion } from '../src/servicios/pedidos-servicio.js';

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

test('revierte la transacción si falla la inserción de un detalle', async () => {
  let rollback = 0;
  let commit = 0;
  const conexion = {
    async execute(sql) {
      if (sql.includes('FROM JORNADA') || sql.includes('FROM ESTADO_PEDIDO') || sql.includes('FROM PRODUCTO')) {
        return { rows: [{ ID_JORNADA: 1, ID_ESTADO_PEDIDO: 2, ID_PRODUCTO: 3 }] };
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
