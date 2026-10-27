import test from 'node:test';
import assert from 'node:assert/strict';
import { verificarSucursalActiva } from '../src/servicios/sucursales-servicio.js';

test('una sucursal inexistente o inactiva se informa como 404', async () => {
  const conexionSinSucursalActiva = { execute: async () => ({ rows: [] }) };
  await assert.rejects(
    () => verificarSucursalActiva(conexionSinSucursalActiva, 99),
    error => error.codigoEstado === 404,
  );
});
