import test from 'node:test';
import assert from 'node:assert/strict';
import { validarProducto } from '../src/servicios/productos-servicio.js';

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
