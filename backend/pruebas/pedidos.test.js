import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { obtenerFiltroSucursal } from '../src/servicios/aislamiento-sucursales-servicio.js';
import { tieneAccesoGlobalPedidos } from '../src/servicios/pedidos-servicio.js';

dotenv.config({ path: new URL('./.env', import.meta.url) });
const base = process.env.PRUEBA_URL_API || 'http://127.0.0.1:3000/api';

async function solicitud(ruta, opciones = {}) {
  const { headers = {}, ...resto } = opciones;
  return fetch(base + ruta, { ...resto, headers: { ...headers } });
}

async function iniciarSesion(usuario, contrasena) {
  const respuesta = await solicitud('/acceso/iniciar-sesion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, contrasena }),
  });
  assert.equal(respuesta.status, 200);
  return (await respuesta.json()).token;
}

const encabezado = token => ({ Authorization: `Bearer ${token}` });
let tokenAdministrador;
let tokenSinPermiso;

test.before(async () => {
  tokenAdministrador = await iniciarSesion(process.env.PRUEBA_USUARIO_ADMIN, process.env.PRUEBA_CONTRASENA_ADMIN);
  tokenSinPermiso = await iniciarSesion(process.env.PRUEBA_USUARIO_SIN_PERMISO, process.env.PRUEBA_CONTRASENA_SIN_PERMISO);
});

test('el alcance global de pedidos depende exclusivamente de AUTORIZAR_PEDIDOS', () => {
  assert.equal(tieneAccesoGlobalPedidos({ permisos: ['AUTORIZAR_PEDIDOS'] }), true);
  assert.equal(tieneAccesoGlobalPedidos({ permisos: ['CREAR_PEDIDOS'] }), false);
  assert.throws(
    () => obtenerFiltroSucursal({ identificadorSucursal: null }, 'p.ID_SUCURSAL', false),
    error => error.codigoEstado === 403,
  );
});

test('GET /pedidos exige sesión y permiso de pedidos', async () => {
  assert.equal((await solicitud('/pedidos')).status, 401);
  assert.equal((await solicitud('/pedidos', { headers: encabezado(tokenSinPermiso) })).status, 403);
});

test('GET /pedidos con alcance global devuelve los pedidos DEMO', async () => {
  const respuesta = await solicitud('/pedidos', { headers: encabezado(tokenAdministrador) });
  assert.equal(respuesta.status, 200);
  const pedidos = await respuesta.json();
  assert.ok(pedidos.length >= 3);
  assert.ok(pedidos.some(pedido => pedido.ID_PEDIDO === 1 && pedido.ID_SUCURSAL === 1));
  assert.ok(pedidos.some(pedido => pedido.ID_PEDIDO === 2 && pedido.ID_SUCURSAL === 2));
});

test('GET /pedidos/:id valida identificadores, inexistentes y detalles DEMO', async () => {
  assert.equal((await solicitud('/pedidos/abc', { headers: encabezado(tokenAdministrador) })).status, 400);
  assert.equal((await solicitud('/pedidos/999999', { headers: encabezado(tokenAdministrador) })).status, 404);
  const respuesta = await solicitud('/pedidos/1', { headers: encabezado(tokenAdministrador) });
  assert.equal(respuesta.status, 200);
  const pedido = await respuesta.json();
  assert.equal(pedido.ID_PEDIDO, 1);
  assert.ok(Array.isArray(pedido.DETALLES));
  assert.ok(pedido.DETALLES.length >= 1);
});

test('los catálogos de pedidos devuelven únicamente registros activos', async () => {
  const estados = await solicitud('/pedidos/estados', { headers: encabezado(tokenAdministrador) });
  const jornadas = await solicitud('/pedidos/jornadas', { headers: encabezado(tokenAdministrador) });
  assert.equal(estados.status, 200);
  assert.equal(jornadas.status, 200);
  assert.ok((await estados.json()).some(estado => estado.ID_ESTADO_PEDIDO === 1));
  assert.ok((await jornadas.json()).some(jornada => jornada.ID_JORNADA === 1));
});
