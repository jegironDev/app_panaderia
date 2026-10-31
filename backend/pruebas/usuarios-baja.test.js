import test from 'node:test';
import assert from 'node:assert/strict';
import { actualizarEstadoUsuario } from '../src/controladores/usuarios-controlador.js';
import { cambiarEstadoUsuario } from '../src/servicios/usuarios-servicio.js';

test('la reactivación se rechaza antes de abrir una conexión Oracle', async () => {
  await assert.rejects(
    () => cambiarEstadoUsuario(12, 'A', 1),
    error => error.codigoEstado === 409 && error.message === 'La baja de un usuario es irreversible.',
  );
});

test('el controlador no admite reactivar un usuario dado de baja', async () => {
  let codigo;
  let cuerpo;
  const respuesta = { status: valor => { codigo = valor; return respuesta; }, json: valor => { cuerpo = valor; } };
  await actualizarEstadoUsuario({ params: { id: '12' }, body: { estado: 'A' }, identidad: { identificadorUsuario: 1 } }, respuesta);
  assert.equal(codigo, 409);
  assert.equal(cuerpo.error, 'La baja de un usuario es irreversible.');
});
