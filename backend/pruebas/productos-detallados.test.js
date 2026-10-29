import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarProductosDetallados } from '../src/servicios/consultas-oracle.js';

test('el catálogo detallado conserva identificadores de producto y unidad por presentación', async () => {
  let sentencia;
  let parametros;
  const conexion = {
    async execute(sql, binds) {
      sentencia = sql;
      parametros = binds;
      return {
        rows: [
          { ID_PRODUCTO: 7, NOMBRE: 'Azúcar', TIPO: 'MAT', PRECIO: 9, ID_UNIDAD_MEDIDA: 5, NOMBRE_UNIDAD_MEDIDA: 'Kilogramo', ABREVIATURA: 'kg' },
          { ID_PRODUCTO: 17, NOMBRE: 'Azúcar', TIPO: 'MAT', PRECIO: 19.84, ID_UNIDAD_MEDIDA: 8, NOMBRE_UNIDAD_MEDIDA: 'Libra', ABREVIATURA: 'lb' },
        ],
      };
    },
  };
  const productos = await consultarProductosDetallados(null, conexion);
  assert.equal(productos[0].ID_PRODUCTO, 7);
  assert.equal(productos[1].ID_PRODUCTO, 17);
  assert.equal(productos[0].ID_UNIDAD_MEDIDA, 5);
  assert.equal(productos[1].ID_UNIDAD_MEDIDA, 8);
  assert.match(sentencia, /JOIN UNIDAD_MEDIDA/);
  assert.match(sentencia, /WHERE p.ESTADO = 'A'/);
  assert.deepEqual(parametros, {});
});

test('el catálogo detallado admite filtro tipado sin alterar la consulta por identificador', async () => {
  let sentencia;
  let parametros;
  const conexion = {
    async execute(sql, binds) {
      sentencia = sql;
      parametros = binds;
      return { rows: [{ ID_PRODUCTO: 9, NOMBRE: 'Pan francés', TIPO: 'PFI', PRECIO: 2, ID_UNIDAD_MEDIDA: 4, NOMBRE_UNIDAD_MEDIDA: 'Unidad', ABREVIATURA: 'und' }] };
    },
  };
  const productos = await consultarProductosDetallados('PFI', conexion);
  assert.equal(productos[0].TIPO, 'PFI');
  assert.match(sentencia, /p.TIPO = :tipo/);
  assert.deepEqual(parametros, { tipo: 'PFI' });
});
