import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obtenerFiltroSucursal,
  obtenerSucursalAutenticada,
  verificarAccesoSucursal,
} from '../src/servicios/aislamiento-sucursales-servicio.js';

const identidadSucursalUno = { identificadorSucursal: 1 };

test('obtiene la sucursal desde la identidad autenticada', () => {
  assert.equal(obtenerSucursalAutenticada(identidadSucursalUno), 1);
});

test('permite acceder a un recurso de la misma sucursal', () => {
  assert.doesNotThrow(() => verificarAccesoSucursal(identidadSucursalUno, 1));
  assert.deepEqual(obtenerFiltroSucursal(identidadSucursalUno), {
    condicion: 'ID_SUCURSAL = :identificadorSucursalAutenticada',
    parametros: { identificadorSucursalAutenticada: 1 },
  });
});

test('rechaza acceder a un recurso de otra sucursal', () => {
  assert.throws(
    () => verificarAccesoSucursal(identidadSucursalUno, 2),
    error => error.codigoEstado === 403,
  );
});

test('rechaza una identidad sin sucursal y admite acceso global explícito', () => {
  assert.throws(
    () => obtenerSucursalAutenticada({ identificadorSucursal: null }),
    error => error.codigoEstado === 403,
  );
  assert.deepEqual(obtenerFiltroSucursal({ identificadorSucursal: null }, 'ID_SUCURSAL', true), {
    condicion: '',
    parametros: {},
  });
});
