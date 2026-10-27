import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('./.env', import.meta.url) });
const base = process.env.PRUEBA_URL_API || 'http://127.0.0.1:3000/api';

async function solicitud(ruta, opciones = {}) {
  const { headers = {}, ...opcionesSolicitud } = opciones;
  return fetch(base + ruta, {
    ...opcionesSolicitud,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}
async function token(usuario, contrasena) {
  const respuesta = await solicitud('/acceso/iniciar-sesion', { method: 'POST', body: JSON.stringify({ usuario, contrasena }) });
  assert.equal(respuesta.status, 200);
  return (await respuesta.json()).token;
}

const contexto = { usuarioPrueba: null, identificadorAdmin: null, sesionPrueba: null, estaInactivo: false };
let tokenAdministrador;
let tokenSinPermiso;

function conToken(tokenSesion) {
  return { Authorization: `Bearer ${tokenSesion}` };
}

async function comprobarEstado(ruta, opciones, esperado) {
  const respuesta = await solicitud(ruta, opciones);
  assert.equal(respuesta.status, esperado);
  return respuesta;
}

test.before(async () => {
  tokenAdministrador = await token(process.env.PRUEBA_USUARIO_ADMIN, process.env.PRUEBA_CONTRASENA_ADMIN);
  tokenSinPermiso = await token(process.env.PRUEBA_USUARIO_SIN_PERMISO, process.env.PRUEBA_CONTRASENA_SIN_PERMISO);
});

test.after(async () => {
  if (contexto.usuarioPrueba && contexto.estaInactivo) {
    await solicitud(`/usuarios/${contexto.usuarioPrueba.ID_USUARIO}/estado`, {
      method: 'PATCH', headers: conToken(tokenAdministrador), body: JSON.stringify({ estado: 'A' })
    });
  }
  if (contexto.permisoPilotoAsignado) {
    await solicitud(`/roles/${contexto.identificadorRolPiloto}/permisos/${contexto.identificadorPermisoInventario}`, {
      method: 'DELETE', headers: conToken(tokenAdministrador)
    });
  }
});

test('GET /usuarios sin sesión responde 401', async () => {
  await comprobarEstado('/usuarios', {}, 401);
});

test('GET /usuarios sin permiso responde 403', async () => {
  await comprobarEstado('/usuarios', { headers: conToken(tokenSinPermiso) }, 403);
});

test('GET /usuarios autorizado no expone datos sensibles', async () => {
  const respuesta = await comprobarEstado('/usuarios', { headers: conToken(tokenAdministrador) }, 200);
  const usuarios = await respuesta.json();
  const administrador = usuarios.find(usuario => usuario.USUARIO === process.env.PRUEBA_USUARIO_ADMIN);
  const usuarioSinPermiso = usuarios.find(usuario => usuario.USUARIO === process.env.PRUEBA_USUARIO_SIN_PERMISO);
  assert.ok(administrador);
  assert.ok(usuarioSinPermiso);
  assert.equal(Object.hasOwn(administrador, 'PSWD'), false);
  contexto.identificadorAdmin = administrador.ID_USUARIO;
  contexto.identificadorUsuarioSinPermiso = usuarioSinPermiso.ID_USUARIO;
});

test('POST /usuarios sin sesión responde 401', async () => {
  await comprobarEstado('/usuarios', { method: 'POST', body: JSON.stringify({}) }, 401);
});

test('POST /usuarios sin permiso responde 403', async () => {
  await comprobarEstado('/usuarios', { method: 'POST', headers: conToken(tokenSinPermiso), body: JSON.stringify({}) }, 403);
});

test('POST /usuarios con datos inválidos responde 400', async () => {
  await comprobarEstado('/usuarios', { method: 'POST', headers: conToken(tokenAdministrador), body: JSON.stringify({ usuario: 'invalido' }) }, 400);
});

test('POST /usuarios autorizado responde 201', async () => {
  contexto.apellidoPrueba = `Node${Date.now()}`;
  const respuesta = await comprobarEstado('/usuarios', {
    method: 'POST', headers: conToken(tokenAdministrador),
    body: JSON.stringify({ contrasena: process.env.PRUEBA_CONTRASENA_NUEVA, primerNombre: 'Prueba', primerApellido: contexto.apellidoPrueba, tipo: 'OPERATIVO' })
  }, 201);
  contexto.usuarioPrueba = await respuesta.json();
  assert.equal(contexto.usuarioPrueba.USUARIO, `p${contexto.apellidoPrueba.toLowerCase()}`);
  assert.equal(Object.hasOwn(contexto.usuarioPrueba, 'PSWD'), false);
});

test('POST /usuarios genera una alternativa al encontrar una colisión', async () => {
  const respuesta = await comprobarEstado('/usuarios', {
    method: 'POST', headers: conToken(tokenAdministrador),
    body: JSON.stringify({ contrasena: process.env.PRUEBA_CONTRASENA_NUEVA, primerNombre: 'Prueba', primerApellido: contexto.apellidoPrueba, tipo: 'OPERATIVO' })
  }, 201);
  assert.equal((await respuesta.json()).USUARIO, `pr${contexto.apellidoPrueba.toLowerCase()}`);
});

test('GET /api/usuarios/:id valida consultas individuales', async () => {
  const respuesta = await comprobarEstado(`/usuarios/${contexto.usuarioPrueba.ID_USUARIO}`, { headers: conToken(tokenAdministrador) }, 200);
  const usuario = await respuesta.json();
  assert.ok(['ID_USUARIO','ID_SUCURSAL','USUARIO','PRIMER_NOMBRE','SEGUNDO_NOMBRE','PRIMER_APELLIDO','SEGUNDO_APELLIDO','PUESTO','TIPO','ESTADO','BLOQUEADO','INICIOS_FALLIDOS','REQUIERE_CAMBIO_PSWD'].every(campo => Object.hasOwn(usuario, campo)));
  assert.equal(Object.hasOwn(usuario, 'PSWD'), false);
  await comprobarEstado('/usuarios/abc', { headers: conToken(tokenAdministrador) }, 400);
  await comprobarEstado('/usuarios/999999', { headers: conToken(tokenAdministrador) }, 404);
});

test('PUT /usuarios/:id aplica autorización, campos opcionales y conserva el acceso', async () => {
  const datosValidos = { primerNombre: 'PruebaEditada', segundoNombre: 'Dos', primerApellido: contexto.apellidoPrueba, segundoApellido: 'Final', puesto: 'Pruebas', tipo: 'OPERATIVO' };
  await comprobarEstado(`/usuarios/${contexto.usuarioPrueba.ID_USUARIO}`, { method: 'PUT', body: JSON.stringify(datosValidos) }, 401);
  await comprobarEstado(`/usuarios/${contexto.usuarioPrueba.ID_USUARIO}`, { method: 'PUT', headers: conToken(tokenSinPermiso), body: JSON.stringify(datosValidos) }, 403);
  await comprobarEstado(`/usuarios/${contexto.usuarioPrueba.ID_USUARIO}`, { method: 'PUT', headers: conToken(tokenAdministrador), body: JSON.stringify({ tipo: 'NO_VALIDO' }) }, 400);
  await comprobarEstado(`/usuarios/${contexto.usuarioPrueba.ID_USUARIO}`, { method: 'PUT', headers: conToken(tokenAdministrador), body: JSON.stringify({ ...datosValidos, BLOQUEADO: 'S' }) }, 400);
  await comprobarEstado('/usuarios/999999', { method: 'PUT', headers: conToken(tokenAdministrador), body: JSON.stringify(datosValidos) }, 404);
  const respuesta = await comprobarEstado(`/usuarios/${contexto.usuarioPrueba.ID_USUARIO}`, { method: 'PUT', headers: conToken(tokenAdministrador), body: JSON.stringify(datosValidos) }, 200);
  const usuarioEditado = await respuesta.json();
  assert.equal(usuarioEditado.USUARIO, contexto.usuarioPrueba.USUARIO);
  assert.equal(usuarioEditado.SEGUNDO_NOMBRE, 'Dos');
  assert.equal(usuarioEditado.PUESTO, 'Pruebas');
});

test('PATCH /usuarios/:id/estado rechaza solicitudes no válidas', async () => {
  await comprobarEstado(`/usuarios/${contexto.usuarioPrueba.ID_USUARIO}/estado`, { method: 'PATCH', body: JSON.stringify({ estado: 'I' }) }, 401);
  await comprobarEstado(`/usuarios/${contexto.usuarioPrueba.ID_USUARIO}/estado`, { method: 'PATCH', headers: conToken(tokenSinPermiso), body: JSON.stringify({ estado: 'I' }) }, 403);
  await comprobarEstado('/usuarios/abc/estado', { method: 'PATCH', headers: conToken(tokenAdministrador), body: JSON.stringify({ estado: 'I' }) }, 400);
  await comprobarEstado('/usuarios/999999/estado', { method: 'PATCH', headers: conToken(tokenAdministrador), body: JSON.stringify({ estado: 'I' }) }, 404);
  await comprobarEstado(`/usuarios/${contexto.usuarioPrueba.ID_USUARIO}/estado`, { method: 'PATCH', headers: conToken(tokenAdministrador), body: JSON.stringify({ estado: 'X' }) }, 400);
  await comprobarEstado(`/usuarios/${contexto.identificadorAdmin}/estado`, { method: 'PATCH', headers: conToken(tokenAdministrador), body: JSON.stringify({ estado: 'I' }) }, 400);
});

test('PATCH /usuarios/:id/estado invalida sesiones de una cuenta desactivada', async () => {
  contexto.sesionPrueba = await token(contexto.usuarioPrueba.USUARIO, process.env.PRUEBA_CONTRASENA_NUEVA);
  await comprobarEstado(`/usuarios/${contexto.usuarioPrueba.ID_USUARIO}/estado`, {
    method: 'PATCH', headers: conToken(tokenAdministrador), body: JSON.stringify({ estado: 'I' })
  }, 200);
  contexto.estaInactivo = true;
  await comprobarEstado('/productos', { headers: conToken(contexto.sesionPrueba) }, 401);
  await comprobarEstado(`/usuarios/${contexto.usuarioPrueba.ID_USUARIO}/estado`, {
    method: 'PATCH', headers: conToken(tokenAdministrador), body: JSON.stringify({ estado: 'A' })
  }, 200);
  contexto.estaInactivo = false;
  const sesionNueva = await token(contexto.usuarioPrueba.USUARIO, process.env.PRUEBA_CONTRASENA_NUEVA);
  await comprobarEstado('/productos', { headers: conToken(sesionNueva) }, 200);
});

test('GET de roles requiere GESTIONAR_ROLES y devuelve el catálogo activo', async () => {
  await comprobarEstado('/roles', {}, 401);
  await comprobarEstado('/roles', { headers: conToken(tokenSinPermiso) }, 403);
  const respuesta = await comprobarEstado('/roles', { headers: conToken(tokenAdministrador) }, 200);
  const roles = await respuesta.json();
  const rolBodega = roles.find(rol => rol.NOMBRE === 'ENCARGADO_BODEGA');
  assert.ok(rolBodega);
  contexto.identificadorRolBodega = rolBodega.ID_ROL;
});

test('GET de roles asignados consulta solamente cuentas existentes', async () => {
  await comprobarEstado(`/usuarios/${contexto.usuarioPrueba.ID_USUARIO}/roles`, { headers: conToken(tokenAdministrador) }, 200);
  await comprobarEstado('/usuarios/999999/roles', { headers: conToken(tokenAdministrador) }, 404);
});

test('POST de roles valida sesión, permiso y referencias', async () => {
  const ruta = `/usuarios/${contexto.usuarioPrueba.ID_USUARIO}/roles`;
  await comprobarEstado(ruta, { method: 'POST', body: JSON.stringify({ identificadorRol: contexto.identificadorRolBodega }) }, 401);
  await comprobarEstado(ruta, { method: 'POST', headers: conToken(tokenSinPermiso), body: JSON.stringify({ identificadorRol: contexto.identificadorRolBodega }) }, 403);
  await comprobarEstado('/usuarios/999999/roles', { method: 'POST', headers: conToken(tokenAdministrador), body: JSON.stringify({ identificadorRol: contexto.identificadorRolBodega }) }, 404);
  await comprobarEstado(ruta, { method: 'POST', headers: conToken(tokenAdministrador), body: JSON.stringify({ identificadorRol: 999999 }) }, 404);
});

test('la asignación y el retiro de rol actualizan permisos de inmediato', async () => {
  const ruta = `/usuarios/${contexto.usuarioPrueba.ID_USUARIO}/roles`;
  await comprobarEstado(ruta, {
    method: 'POST', headers: conToken(tokenAdministrador), body: JSON.stringify({ identificadorRol: contexto.identificadorRolBodega })
  }, 201);
  await comprobarEstado(ruta, {
    method: 'POST', headers: conToken(tokenAdministrador), body: JSON.stringify({ identificadorRol: contexto.identificadorRolBodega })
  }, 409);

  const sesionConRol = await token(contexto.usuarioPrueba.USUARIO, process.env.PRUEBA_CONTRASENA_NUEVA);
  await comprobarEstado('/inventario/stock', { headers: conToken(sesionConRol) }, 200);

  const rutaRetiro = `${ruta}/${contexto.identificadorRolBodega}`;
  await comprobarEstado(rutaRetiro, { method: 'DELETE' }, 401);
  await comprobarEstado(rutaRetiro, { method: 'DELETE', headers: conToken(tokenSinPermiso) }, 403);
  await comprobarEstado('/usuarios/999999/roles/1', { method: 'DELETE', headers: conToken(tokenAdministrador) }, 404);
  await comprobarEstado(`${ruta}/abc`, { method: 'DELETE', headers: conToken(tokenAdministrador) }, 400);
  await comprobarEstado(rutaRetiro, { method: 'DELETE', headers: conToken(tokenAdministrador) }, 200);
  await comprobarEstado('/inventario/stock', { headers: conToken(sesionConRol) }, 403);
});

test('GET de permisos requiere GESTIONAR_PERMISOS y devuelve el catálogo', async () => {
  await comprobarEstado('/permisos', {}, 401);
  await comprobarEstado('/permisos', { headers: conToken(tokenSinPermiso) }, 403);
  const respuesta = await comprobarEstado('/permisos', { headers: conToken(tokenAdministrador) }, 200);
  const permisos = await respuesta.json();
  const permisoInventario = permisos.find(permiso => permiso.CODIGO === 'VER_INVENTARIO');
  assert.ok(permisoInventario);
  contexto.identificadorPermisoInventario = permisoInventario.ID_PERMISO;
});

test('GET de permisos por rol y efectivos valida referencias', async () => {
  const roles = await (await solicitud('/roles', { headers: conToken(tokenAdministrador) })).json();
  const piloto = roles.find(rol => rol.NOMBRE === 'PILOTO');
  assert.ok(piloto);
  contexto.identificadorRolPiloto = piloto.ID_ROL;
  await comprobarEstado(`/roles/${piloto.ID_ROL}/permisos`, { headers: conToken(tokenAdministrador) }, 200);
  await comprobarEstado('/roles/999999/permisos', { headers: conToken(tokenAdministrador) }, 404);
  await comprobarEstado(`/usuarios/${contexto.identificadorUsuarioSinPermiso}/permisos`, { headers: conToken(tokenAdministrador) }, 200);
  await comprobarEstado('/usuarios/999999/permisos', { headers: conToken(tokenAdministrador) }, 404);
});

test('POST de permisos valida sesión, permiso y referencias', async () => {
  const ruta = `/roles/${contexto.identificadorRolPiloto}/permisos`;
  await comprobarEstado(ruta, { method: 'POST', body: JSON.stringify({ identificadorPermiso: contexto.identificadorPermisoInventario }) }, 401);
  await comprobarEstado(ruta, { method: 'POST', headers: conToken(tokenSinPermiso), body: JSON.stringify({ identificadorPermiso: contexto.identificadorPermisoInventario }) }, 403);
  await comprobarEstado('/roles/999999/permisos', { method: 'POST', headers: conToken(tokenAdministrador), body: JSON.stringify({ identificadorPermiso: contexto.identificadorPermisoInventario }) }, 404);
  await comprobarEstado(ruta, { method: 'POST', headers: conToken(tokenAdministrador), body: JSON.stringify({ identificadorPermiso: 999999 }) }, 404);
});

test('la asignación y el retiro de permiso afectan una sesión vigente', async () => {
  const ruta = `/roles/${contexto.identificadorRolPiloto}/permisos`;
  await comprobarEstado('/inventario/stock', { headers: conToken(tokenSinPermiso) }, 403);
  await comprobarEstado(ruta, {
    method: 'POST', headers: conToken(tokenAdministrador), body: JSON.stringify({ identificadorPermiso: contexto.identificadorPermisoInventario })
  }, 201);
  contexto.permisoPilotoAsignado = true;
  await comprobarEstado(ruta, {
    method: 'POST', headers: conToken(tokenAdministrador), body: JSON.stringify({ identificadorPermiso: contexto.identificadorPermisoInventario })
  }, 409);
  const permisosEfectivos = await comprobarEstado(`/usuarios/${contexto.identificadorUsuarioSinPermiso}/permisos`, { headers: conToken(tokenAdministrador) }, 200);
  assert.ok((await permisosEfectivos.json()).some(permiso => permiso.CODIGO === 'VER_INVENTARIO'));
  await comprobarEstado('/inventario/stock', { headers: conToken(tokenSinPermiso) }, 200);

  const rutaRetiro = `${ruta}/${contexto.identificadorPermisoInventario}`;
  await comprobarEstado(rutaRetiro, { method: 'DELETE' }, 401);
  await comprobarEstado(rutaRetiro, { method: 'DELETE', headers: conToken(tokenSinPermiso) }, 403);
  await comprobarEstado(`${ruta}/abc`, { method: 'DELETE', headers: conToken(tokenAdministrador) }, 400);
  await comprobarEstado('/roles/999999/permisos/1', { method: 'DELETE', headers: conToken(tokenAdministrador) }, 404);
  await comprobarEstado(rutaRetiro, { method: 'DELETE', headers: conToken(tokenAdministrador) }, 200);
  contexto.permisoPilotoAsignado = false;
  await comprobarEstado('/inventario/stock', { headers: conToken(tokenSinPermiso) }, 403);
});
