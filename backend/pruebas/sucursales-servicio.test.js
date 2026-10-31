import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { crearSucursal, editarSucursal, inhabilitarSucursal, validarNombreSucursal, verificarSucursalActiva } from '../src/servicios/sucursales-servicio.js';

test('una sucursal inexistente o inactiva se informa como 404', async () => {
  const conexionSinSucursalActiva = { execute: async () => ({ rows: [] }) };
  await assert.rejects(
    () => verificarSucursalActiva(conexionSinSucursalActiva, 99),
    error => error.codigoEstado === 404,
  );
});

test('valida que solo se edite un nombre de sucursal no vacío y dentro del límite Oracle', () => {
  assert.equal(validarNombreSucursal({ nombre: ' Centro ' }), 'Centro');
  assert.throws(() => validarNombreSucursal({ nombre: '' }), /obligatorio/);
  assert.throws(() => validarNombreSucursal({ nombre: 'x'.repeat(101) }), /100 caracteres/);
  assert.throws(() => validarNombreSucursal({ nombre: 'Centro', estado: 'I' }), /Solo puede modificar/);
});

test('crea una sucursal activa usando la identidad Oracle, deja bitácora y no asigna dependencias', async () => {
  const consultas = [];
  const conexion = {
    execute: async (sql) => {
      consultas.push(sql);
      if (sql.includes('UPPER(TRIM(NOMBRE))')) return { rows: [] };
      if (sql.includes('RETURNING ID_SUCURSAL')) return { outBinds: { identificadorSucursal: [90] } };
      return { rowsAffected: 1 };
    }, rollback: async () => {}, close: async () => {},
  };
  const resultado = await crearSucursal('Sucursal de prueba', 106, conexion);
  assert.deepEqual(resultado, { ID_SUCURSAL: 90, NOMBRE: 'Sucursal de prueba', ESTADO: 'A' });
  assert.ok(consultas.some(sql => sql.includes('LOCK TABLE SUCURSAL')));
  assert.ok(consultas.some(sql => sql.includes("INSERT INTO SUCURSAL (NOMBRE, ESTADO) VALUES (:nombre, 'A')")));
  assert.ok(consultas.some(sql => sql.includes('BITACORA_SUCURSALES')));
  assert.ok(!consultas.some(sql => /USUARIO|RUTA|PEDIDO|INVENTARIO/.test(sql) && !sql.includes('BITACORA_SUCURSALES')));
});

test('la creación rechaza un duplicado antes de insertar', async () => {
  const consultas = [];
  const conexion = {
    execute: async (sql) => { consultas.push(sql); return sql.includes('UPPER(TRIM(NOMBRE))') ? { rows: [{ 1: 1 }] } : { rows: [] }; },
    rollback: async () => {}, close: async () => {},
  };
  await assert.rejects(() => crearSucursal('Centro', 106, conexion), error => error.codigoEstado === 409);
  assert.ok(!consultas.some(sql => sql.includes('INSERT INTO SUCURSAL')));
});

test('la edición bloquea la fila, evita duplicados y deja auditoría en la misma transacción', async () => {
  const consultas = [];
  const conexion = {
    execute: async (sql) => {
      consultas.push(sql);
      if (sql.includes('FOR UPDATE')) return { rows: [{ ID_SUCURSAL: 90, NOMBRE: 'Centro', ESTADO: 'A' }] };
      if (sql.includes('UPPER(TRIM(NOMBRE))')) return { rows: [] };
      return { rowsAffected: 1 };
    }, commit: async () => { consultas.push('COMMIT'); }, rollback: async () => {}, close: async () => {},
  };
  const resultado = await editarSucursal(90, 'Centro actualizado', 106, conexion);
  assert.equal(resultado.NOMBRE, 'Centro actualizado');
  assert.ok(consultas.some(sql => sql.includes('UPDATE SUCURSAL SET NOMBRE')));
  assert.ok(consultas.some(sql => sql.includes('BITACORA_SUCURSALES')));
  assert.ok(!consultas.includes('COMMIT'));
});

test('la inhabilitación bloquea pedidos, entregas, rutas y usuarios activos antes de actualizar', async () => {
  let consultas = 0;
  const conexion = {
    execute: async (sql) => {
      consultas += 1;
      if (sql.includes('FOR UPDATE')) return { rows: [{ ID_SUCURSAL: 90, NOMBRE: 'Prueba', ESTADO: 'A' }] };
      return { rows: [{ CANTIDAD: 1 }] };
    }, rollback: async () => {}, close: async () => {},
  };
  await assert.rejects(() => inhabilitarSucursal(90, 106, conexion), error => error.codigoEstado === 409 && /pedidos operativos/.test(error.message));
  assert.equal(consultas, 2);
});

test('la inhabilitación segura cambia solo el estado, registra auditoría y no ofrece reactivación', async () => {
  const consultas = [];
  const respuestas = [
    { rows: [{ ID_SUCURSAL: 90, NOMBRE: 'Prueba', ESTADO: 'A' }] },
    { rows: [{ CANTIDAD: 0 }] }, { rows: [{ CANTIDAD: 0 }] }, { rows: [{ CANTIDAD: 0 }] }, { rows: [{ CANTIDAD: 0 }] },
  ];
  const conexion = {
    execute: async (sql) => { consultas.push(sql); return respuestas.shift() || { rowsAffected: 1 }; },
    rollback: async () => {}, close: async () => {},
  };
  const resultado = await inhabilitarSucursal(90, 106, conexion);
  assert.equal(resultado.ESTADO, 'I');
  assert.ok(consultas.some(sql => sql.includes("UPDATE SUCURSAL SET ESTADO = 'I'")));
  assert.ok(consultas.some(sql => sql.includes('BITACORA_SUCURSALES')));
});

test('las rutas administrativas exigen GESTIONAR_SUCURSALES y no hay ruta de reactivación', async () => {
  const rutas = await readFile(new URL('../src/rutas/api-rutas.js', import.meta.url), 'utf8');
  const controlador = await readFile(new URL('../src/controladores/sucursales-controlador.js', import.meta.url), 'utf8');
  assert.match(rutas, /"\/sucursales\/administracion"[\s\S]*?requerirPermiso\("GESTIONAR_SUCURSALES"\)/);
  assert.match(rutas, /rutasApi\.post\([\s\S]*?"\/sucursales"[\s\S]*?requerirPermiso\("GESTIONAR_SUCURSALES"\)/);
  assert.match(rutas, /"\/sucursales\/:id\/estado"[\s\S]*?requerirPermiso\("GESTIONAR_SUCURSALES"\)/);
  assert.match(controlador, /estado === 'A'[\s\S]*?reactivación de sucursales no está permitida/);
});
