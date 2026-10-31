import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validarDesactivacionProducto, validarProducto } from '../src/servicios/productos-servicio.js';

test('valida productos finales con precio comercial positivo', () => {
  assert.deepEqual(validarProducto({ nombre: 'Pan de prueba', tipo: 'PFI', identificadorUnidadMedida: 1, precio: 7.5 }), { nombre: 'Pan de prueba', tipo: 'PFI', identificadorUnidadMedida: 1, precio: 7.5 });
  assert.throws(() => validarProducto({ nombre: 'Pan sin precio', tipo: 'PFI', identificadorUnidadMedida: 1, precio: 0 }), /precio de venta/);
});

test('admite ingredientes sin tarifa comercial y rechaza datos inválidos', () => {
  assert.equal(validarProducto({ nombre: 'Harina de prueba', tipo: 'MAT', identificadorUnidadMedida: 2, precio: 0 }).tipo, 'MAT');
  assert.throws(() => validarProducto({ nombre: '', tipo: 'MAT', identificadorUnidadMedida: 2, precio: 0 }), /nombre/);
  assert.throws(() => validarProducto({ nombre: 'Dato', tipo: 'OTRO', identificadorUnidadMedida: 2, precio: 0 }), /tipo/);
  assert.throws(() => validarProducto({ nombre: 'Dato', tipo: 'INS', identificadorUnidadMedida: 0, precio: 0 }), /unidad/);
});

test('la comprobación de duplicado no incluye precio entre los binds SQL', async () => {
  const texto = await readFile(new URL('../src/servicios/productos-servicio.js', import.meta.url), 'utf8');
  assert.match(texto, /const binds = \{ nombre: producto\.nombre, tipo: producto\.tipo, identificadorUnidadMedida: producto\.identificadorUnidadMedida/);
  assert.doesNotMatch(texto, /excluir \? \{ \.\.\.producto, excluir \} : producto/);
});

test('la desactivación bloquea saldos, reservas y producciones activas antes de inactivar recetas propias', async () => {
  const texto = await readFile(new URL('../src/servicios/productos-servicio.js', import.meta.url), 'utf8');
  assert.match(texto, /CANTIDAD\) !== 0 \|\| Number\(inventario\.CANTIDAD_RESERVADA\) !== 0/);
  assert.match(texto, /pr\.ESTADO IN \('PLANIFICADA','AUTORIZADA','EN_PRODUCCION'\)/);
  assert.match(texto, /UPDATE RECETA SET ESTADO='I' WHERE ID_PRODUCTO=:identificadorProducto AND ESTADO='A'/);
  assert.match(texto, /await conexion\.rollback\(\)/);
});

test('la validación de desactivación rechaza una existencia física o reservada y no continúa con otras consultas', async () => {
  let consultas = 0;
  const conexion = { execute: async () => { consultas += 1; return { rows: [{ ID_INVENTARIO: 1, CANTIDAD: 0, CANTIDAD_RESERVADA: 0.5 }] }; } };
  await assert.rejects(() => validarDesactivacionProducto(conexion, 8), /existencia física o reservada/);
  assert.equal(consultas, 1);
});

test('la validación de desactivación permite continuar solo sin saldos, producciones, recetas consumidoras ni pedidos operativos', async () => {
  const respuestas = [{ rows: [{ ID_INVENTARIO: 1, CANTIDAD: 0, CANTIDAD_RESERVADA: 0 }] }, { rows: [] }, { rows: [] }, { rows: [] }];
  const conexion = { execute: async () => respuestas.shift() };
  await validarDesactivacionProducto(conexion, 8);
  assert.equal(respuestas.length, 0);
});
