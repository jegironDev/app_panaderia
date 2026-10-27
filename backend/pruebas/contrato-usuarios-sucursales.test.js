import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('./.env', import.meta.url) });
const base = process.env.PRUEBA_URL_API || 'http://127.0.0.1:3000/api';

async function solicitud(ruta, opciones = {}) {
  const { headers = {}, ...resto } = opciones;
  return fetch(base + ruta, { ...resto, headers: { 'Content-Type': 'application/json', ...headers } });
}

async function iniciarSesion(usuario, contrasena) {
  const respuesta = await solicitud('/acceso/iniciar-sesion', { method: 'POST', body: JSON.stringify({ usuario, contrasena }) });
  assert.equal(respuesta.status, 200);
  return (await respuesta.json()).token;
}

const encabezado = token => ({ Authorization: `Bearer ${token}` });
let tokenAdministrador;
let tokenSinPermiso;
let sucursalActiva;

test.before(async () => {
  tokenAdministrador = await iniciarSesion(process.env.PRUEBA_USUARIO_ADMIN, process.env.PRUEBA_CONTRASENA_ADMIN);
  tokenSinPermiso = await iniciarSesion(process.env.PRUEBA_USUARIO_SIN_PERMISO, process.env.PRUEBA_CONTRASENA_SIN_PERMISO);
});

test('GET /sucursales requiere sesión y permiso de administración de usuarios', async () => {
  assert.equal((await solicitud('/sucursales')).status, 401);
  assert.equal((await solicitud('/sucursales', { headers: encabezado(tokenSinPermiso) })).status, 403);
  const respuesta = await solicitud('/sucursales', { headers: encabezado(tokenAdministrador) });
  assert.equal(respuesta.status, 200);
  const sucursales = await respuesta.json();
  assert.ok(sucursales.length >= 1);
  assert.ok(sucursales.every(sucursal => Object.keys(sucursal).every(campo => ['ID_SUCURSAL', 'NOMBRE'].includes(campo))));
  sucursalActiva = sucursales[0];
});

test('POST /usuarios aplica el contrato de tipo y sucursal', async () => {
  const basePrueba = { contrasena: process.env.PRUEBA_CONTRASENA_NUEVA, primerNombre: 'Ána', primerApellido: `Prueba ${Date.now()}` };
  assert.equal((await solicitud('/usuarios', { method: 'POST', headers: encabezado(tokenAdministrador), body: JSON.stringify({ ...basePrueba, usuario: 'manual', tipo: 'OPERATIVO' }) })).status, 400);
  assert.equal((await solicitud('/usuarios', { method: 'POST', headers: encabezado(tokenAdministrador), body: JSON.stringify({ ...basePrueba, PSWD: 'no-usar', tipo: 'OPERATIVO' }) })).status, 400);
  assert.equal((await solicitud('/usuarios', { method: 'POST', headers: encabezado(tokenAdministrador), body: JSON.stringify({ ...basePrueba, primerNombre: 'x'.repeat(51), tipo: 'OPERATIVO' }) })).status, 400);
  assert.equal((await solicitud('/usuarios', { method: 'POST', headers: encabezado(tokenAdministrador), body: JSON.stringify({ ...basePrueba, tipo: 'ADMIN', identificadorSucursal: sucursalActiva.ID_SUCURSAL }) })).status, 400);
  assert.equal((await solicitud('/usuarios', { method: 'POST', headers: encabezado(tokenAdministrador), body: JSON.stringify({ ...basePrueba, tipo: 'ESTANDAR' }) })).status, 400);
  assert.equal((await solicitud('/usuarios', { method: 'POST', headers: encabezado(tokenAdministrador), body: JSON.stringify({ ...basePrueba, tipo: 'ESTANDAR', identificadorSucursal: 999999 }) })).status, 404);
  const respuesta = await solicitud('/usuarios', { method: 'POST', headers: encabezado(tokenAdministrador), body: JSON.stringify({ ...basePrueba, segundoNombre: 'María', segundoApellido: 'Final', puesto: 'Demostración', tipo: 'ESTANDAR', identificadorSucursal: sucursalActiva.ID_SUCURSAL }) });
  assert.equal(respuesta.status, 201);
  const usuario = await respuesta.json();
  assert.equal(usuario.ID_SUCURSAL, sucursalActiva.ID_SUCURSAL);
  assert.equal(usuario.SEGUNDO_NOMBRE, 'María');
  assert.equal(Object.hasOwn(usuario, 'PSWD'), false);
});

test('POST concurrente genera usuarios distintos y válidos', async () => {
  const apellido = `Concurrente${Date.now()}`;
  const respuestas = await Promise.all([1, 2, 3].map(() => solicitud('/usuarios', {
    method: 'POST', headers: encabezado(tokenAdministrador),
    body: JSON.stringify({ contrasena: process.env.PRUEBA_CONTRASENA_NUEVA, primerNombre: 'Zoé', primerApellido: apellido, tipo: 'OPERATIVO' }),
  })));
  assert.deepEqual(respuestas.map(respuesta => respuesta.status), [201, 201, 201]);
  const usuarios = await Promise.all(respuestas.map(respuesta => respuesta.json()));
  assert.equal(new Set(usuarios.map(usuario => usuario.USUARIO)).size, 3);
});
