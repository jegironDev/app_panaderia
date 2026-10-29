import test from 'node:test';
import assert from 'node:assert/strict';
import { requerirAlgunPermiso, requerirSesion } from '../src/intermediarios/autorizacion.js';
import { consultarUnidadesMedidaActivas } from '../src/servicios/consultas-oracle.js';

test('consulta únicamente las unidades activas ordenadas por nombre', async () => {
  let sentencia;
  let parametros;
  const conexion = {
    async execute(sql, binds) {
      sentencia = sql;
      parametros = binds;
      return {
        rows: [
          { ID_UNIDAD_MEDIDA: 5, NOMBRE: 'Kilogramo', ABREVIATURA: 'kg' },
          { ID_UNIDAD_MEDIDA: 6, NOMBRE: 'Litro', ABREVIATURA: 'lt' },
          { ID_UNIDAD_MEDIDA: 4, NOMBRE: 'Unidad', ABREVIATURA: 'und' },
        ],
      };
    },
  };
  const unidades = await consultarUnidadesMedidaActivas(conexion);
  assert.deepEqual(unidades.map(unidad => unidad.NOMBRE), ['Kilogramo', 'Litro', 'Unidad']);
  assert.match(sentencia, /FROM UNIDAD_MEDIDA/);
  assert.match(sentencia, /WHERE ESTADO = :estado/);
  assert.match(sentencia, /ORDER BY NOMBRE/);
  assert.deepEqual(parametros, { estado: 'A' });
});

test('propaga errores de Oracle y no cierra una conexión prestada', async () => {
  let cierres = 0;
  const errorOracle = new Error('Error simulado de Oracle');
  const conexion = {
    async execute() { throw errorOracle; },
    async close() { cierres += 1; },
  };
  await assert.rejects(() => consultarUnidadesMedidaActivas(conexion), error => error === errorOracle);
  assert.equal(cierres, 0);
});

test('la ruta requiere sesión y permite cualquiera de los permisos aprobados', async () => {
  let codigoSesion;
  await requerirSesion({ header() { return undefined; } }, { status(codigo) { codigoSesion = codigo; return this; }, json() {} }, () => {});
  assert.equal(codigoSesion, 401);

  for (const permiso of ['GESTIONAR_RECETAS', 'AUTORIZAR_PEDIDOS']) {
    let siguiente = false;
    requerirAlgunPermiso(['GESTIONAR_RECETAS', 'AUTORIZAR_PEDIDOS'])(
      { identidad: { tipo: 'ESTANDAR', permisos: [permiso] } },
      { status() { throw new Error('No debe rechazar'); }, json() {} },
      () => { siguiente = true; },
    );
    assert.equal(siguiente, true);
  }

  let codigoPermiso;
  requerirAlgunPermiso(['GESTIONAR_RECETAS', 'AUTORIZAR_PEDIDOS'])(
    { identidad: { tipo: 'ADMIN', permisos: [] } },
    { status(codigo) { codigoPermiso = codigo; return this; }, json() {} },
    () => {},
  );
  assert.equal(codigoPermiso, 403);
});
