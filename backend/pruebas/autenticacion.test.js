import test from 'node:test';
import assert from 'node:assert/strict';
import { crearHashContrasena, verificarContrasena } from '../src/servicios/contrasenas-servicio.js';
import { normalizarNombreAcceso, obtenerUsuarioPorNombre } from '../src/servicios/acceso-servicio.js';
import { existeNombreUsuarioSinDistinguirMayusculas } from '../src/servicios/usuarios-servicio.js';

test('normaliza el acceso sin distinguir capitalización ni espacios externos', () => {
  for (const variante of ['JGIRON', 'jgiron', 'JgIrOn', '  jgiron  ']) {
    assert.equal(normalizarNombreAcceso(variante), 'JGIRON');
  }
});

test('la consulta de acceso usa Oracle parametrizado e insensible a capitalización', async () => {
  let consulta;
  let parametros;
  const conexion = {
    async execute(sql, valores) {
      consulta = sql;
      parametros = valores;
      return { rows: [{ ID_USUARIO: 1, USUARIO: 'JGIRON' }] };
    },
  };

  const usuario = await obtenerUsuarioPorNombre(conexion, '  JgIrOn ');
  assert.equal(usuario.USUARIO, 'JGIRON');
  assert.match(consulta, /UPPER\(TRIM\(USUARIO\)\)/);
  assert.deepEqual(parametros, { nombreUsuarioNormalizado: 'JGIRON' });
});

test('la contraseña conserva sensibilidad a mayúsculas y minúsculas', async () => {
  const hash = await crearHashContrasena('ClaveSeguraA1');
  assert.equal(await verificarContrasena('ClaveSeguraA1', hash), true);
  assert.equal(await verificarContrasena('claveseguraa1', hash), false);
  assert.equal(await verificarContrasena('ClaveSeguraA1 ', hash), false);
});

test('la generación detecta colisiones por diferencias de capitalización', async () => {
  let parametros;
  const conexion = {
    async execute(sql, valores) {
      parametros = valores;
      assert.match(sql, /UPPER\(TRIM\(USUARIO\)\)/);
      return { rows: [{ 1: 1 }] };
    },
  };

  assert.equal(await existeNombreUsuarioSinDistinguirMayusculas(conexion, 'jgiron'), true);
  assert.deepEqual(parametros, { usuarioNormalizado: 'JGIRON' });
});

test('la búsqueda de acceso no cambia estado, bloqueo ni intentos', async () => {
  let consulta;
  const conexion = {
    async execute(sql) {
      consulta = sql;
      return { rows: [] };
    },
  };

  assert.equal(await obtenerUsuarioPorNombre(conexion, 'inexistente'), null);
  assert.match(consulta, /^\s*SELECT/i);
  assert.doesNotMatch(consulta, /UPDATE\s+USUARIO|SET\s+(INICIOS_FALLIDOS|BLOQUEADO)/i);
});

test('un nombre vacío tras quitar espacios no consulta Oracle', async () => {
  const conexion = { execute: async () => { throw new Error('No debe consultar Oracle'); } };
  assert.equal(await obtenerUsuarioPorNombre(conexion, '   '), null);
});
