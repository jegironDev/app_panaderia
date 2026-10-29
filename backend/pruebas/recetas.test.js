import test from 'node:test';
import assert from 'node:assert/strict';
import oracledb from 'oracledb';
import { requerirAlgunPermiso, requerirSesion } from '../src/intermediarios/autorizacion.js';
import {
  consultarRecetaPorIdentificador,
  consultarRecetas,
  crearReceta,
  actualizarEstadoReceta,
  desactivarReceta,
  modificarReceta,
  validarDatosReceta,
} from '../src/servicios/recetas-servicio.js';

const recetaValida = {
  identificadorProducto: 10,
  nombre: 'Pan francés diario',
  unidadesProducidas: 100,
  ingredientes: [
    { identificadorProducto: 20, identificadorUnidadMedida: 5, cantidad: 5 },
    { identificadorProducto: 21, identificadorUnidadMedida: 5, cantidad: 0.1 },
  ],
};

test('valida receta, rendimiento e ingredientes configurables', () => {
  assert.deepEqual(validarDatosReceta(recetaValida), recetaValida);
  for (const datos of [
    { ...recetaValida, nombre: '' },
    { ...recetaValida, unidadesProducidas: 0 },
    { ...recetaValida, unidadesProducidas: 1.5 },
    { ...recetaValida, ingredientes: [] },
    { ...recetaValida, ingredientes: [{ identificadorProducto: 20, identificadorUnidadMedida: 5, cantidad: 1 }, { identificadorProducto: 20, identificadorUnidadMedida: 5, cantidad: 2 }] },
    { ...recetaValida, ingredientes: [{ identificadorProducto: 20, identificadorUnidadMedida: 5, cantidad: -1 }] },
    { ...recetaValida, ingredientes: [{ identificadorProducto: 20, identificadorUnidadMedida: 5, cantidad: 0.001 }] },
  ]) {
    assert.throws(() => validarDatosReceta(datos), error => error.codigoEstado === 400);
  }
});

test('lista recetas y obtiene detalle con producto terminado e ingredientes', async () => {
  const conexion = {
    async execute(sql) {
      if (sql.includes('COUNT(dr.ID_DETALLE_RECETA)')) {
        return { rows: [{ ID_RECETA: 7, NOMBRE: 'Pan', UNIDADES_PRODUCIDAS: 50, ESTADO: 'A', ID_PRODUCTO: 10, NOMBRE_PRODUCTO: 'Pan final', TIPO_PRODUCTO: 'PFI', INGREDIENTES: 2 }] };
      }
      if (sql.includes('FROM RECETA r') && !sql.includes('PRODUCCIONES')) {
        return { rows: [{ ID_RECETA: 7, NOMBRE: 'Pan', UNIDADES_PRODUCIDAS: 50, ESTADO: 'A', ID_PRODUCTO: 10, NOMBRE_PRODUCTO: 'Pan final', TIPO_PRODUCTO: 'PFI' }] };
      }
      if (sql.includes('FROM DETALLE_RECETA')) {
        return { rows: [{ ID_DETALLE_RECETA: 1, ID_PRODUCTO: 20, NOMBRE_PRODUCTO: 'Harina', TIPO_PRODUCTO: 'MAT', ID_UNIDAD_MEDIDA: 1, NOMBRE_UNIDAD_MEDIDA: 'Kilogramo', ABREVIATURA: 'kg', CANTIDAD: 5 }] };
      }
      throw new Error('Consulta no esperada');
    },
  };
  const listado = await consultarRecetas(conexion);
  const detalle = await consultarRecetaPorIdentificador(7, conexion);
  assert.equal(listado[0].NOMBRE_PRODUCTO, 'Pan final');
  assert.equal(detalle.INGREDIENTES[0].NOMBRE_PRODUCTO, 'Harina');
});

test('crear permite varias recetas activas para un mismo producto terminado', async () => {
  const insertadas = [];
  const parametrosCabecera = [];
  let siguienteIdentificador = 70;
  const conexion = crearConexionReceta({
    alInsertarReceta(parametros) {
      insertadas.push(parametros);
      parametrosCabecera.push(parametros);
      return siguienteIdentificador++;
    },
  });
  const primera = await crearReceta(recetaValida, conexion);
  const segunda = await crearReceta({ ...recetaValida, nombre: 'Pan francés alternativo' }, conexion);
  assert.equal(primera.ID_RECETA, 70);
  assert.equal(segunda.ID_RECETA, 71);
  assert.equal(insertadas.length, 2);
  assert.equal(insertadas[0].identificadorProducto, insertadas[1].identificadorProducto);
  assert.deepEqual(Object.keys(parametrosCabecera[0]).sort(), [
    'identificadorProducto', 'identificadorReceta', 'nombre', 'unidadesProducidas',
  ]);
  assert.equal(Object.hasOwn(parametrosCabecera[0], 'ingredientes'), false);
  assert.equal(parametrosCabecera[0].identificadorReceta.dir, oracledb.BIND_OUT);
  assert.equal(parametrosCabecera[0].identificadorReceta.type, oracledb.NUMBER);
});

test('revierte la creación completa si falla la inserción de un detalle', async () => {
  let rollback = 0;
  let commit = 0;
  const conexion = {
    async execute(sql, parametros) {
      if (sql.includes("TIPO = 'PFI'")) return { rows: [{ ID_PRODUCTO: parametros.identificadorProducto }] };
      if (sql.includes("TIPO IN ('MAT', 'INS')")) return { rows: [{ ID_PRODUCTO: parametros.identificadorProducto, ID_UNIDAD_MEDIDA: 5 }] };
      if (sql.includes('FROM UNIDAD_MEDIDA')) return { rows: [{ ID_UNIDAD_MEDIDA: parametros.identificadorUnidadMedida }] };
      if (sql.includes('INSERT INTO RECETA')) return { outBinds: { identificadorReceta: [70] } };
      if (sql.includes('INSERT INTO DETALLE_RECETA')) throw new Error('Fallo simulado de detalle');
      throw new Error('Consulta no esperada');
    },
    async commit() { commit += 1; },
    async rollback() { rollback += 1; },
  };
  await assert.rejects(() => crearReceta(recetaValida, conexion), /Fallo simulado de detalle/);
  assert.equal(commit, 0);
  assert.equal(rollback, 1);
});

test('POST conserva la conexión prestada hasta consultar, confirmar y devolver la receta', async () => {
  const eventos = [];
  const conexion = crearConexionReceta({ eventos });
  const resultado = await crearReceta(recetaValida, conexion);
  assert.equal(resultado.ID_RECETA, 7);
  assert.equal(eventos.includes('CERRAR'), false);
  assert.ok(eventos.indexOf('INSERTAR_CABECERA') < eventos.indexOf('INSERTAR_DETALLE'));
  assert.ok(eventos.indexOf('INSERTAR_DETALLE') < eventos.indexOf('CONSULTAR_CABECERA'));
  assert.ok(eventos.indexOf('CONSULTAR_DETALLE') < eventos.indexOf('COMMIT'));
});

test('PUT conserva la conexión prestada durante actualización, consulta y confirmación', async () => {
  const eventos = [];
  let parametrosActualizacion;
  const conexion = crearConexionReceta({
    eventos,
    producciones: 0,
    alActualizar(parametros) { parametrosActualizacion = parametros; },
  });
  const resultado = await modificarReceta(7, recetaValida, conexion);
  assert.equal(resultado.ID_RECETA, 7);
  assert.equal(eventos.includes('CERRAR'), false);
  assert.ok(eventos.indexOf('ACTUALIZAR_CABECERA') < eventos.indexOf('CONSULTAR_CABECERA'));
  assert.ok(eventos.indexOf('CONSULTAR_DETALLE') < eventos.indexOf('COMMIT'));
  assert.deepEqual(Object.keys(parametrosActualizacion).sort(), [
    'identificadorProducto', 'identificadorReceta', 'nombre', 'unidadesProducidas',
  ]);
  assert.equal(Object.hasOwn(parametrosActualizacion, 'ingredientes'), false);
});

test('editar revierte encabezado e ingredientes cuando falla el reemplazo de un detalle', async () => {
  let confirmaciones = 0;
  let reversiones = 0;
  const conexion = crearConexionReceta({ producciones: 0, fallarDetalle: true, confirmaciones, reversiones });
  conexion.commit = async () => { confirmaciones += 1; };
  conexion.rollback = async () => { reversiones += 1; };

  await assert.rejects(() => modificarReceta(7, recetaValida, conexion), /Fallo simulado de detalle/);
  assert.equal(confirmaciones, 0);
  assert.equal(reversiones, 1);
});

test('crear rechaza producto final no válido, ingredientes no MAT/INS y unidades inactivas', async () => {
  for (const tipoFallo of ['productoFinal', 'ingrediente', 'unidad']) {
    const conexion = crearConexionReceta({ tipoFallo });
    await assert.rejects(() => crearReceta(recetaValida, conexion), error => error.codigoEstado === 404);
  }
});

test('rechaza una unidad que no corresponde exactamente al ingrediente', async () => {
  const datos = {
    ...recetaValida,
    ingredientes: [{ identificadorProducto: 20, identificadorUnidadMedida: 4, cantidad: 1 }],
  };
  await assert.rejects(
    () => crearReceta(datos, crearConexionReceta({ unidadProducto: 5 })),
    error => error.codigoEstado === 400 && error.mensajeCliente === 'La unidad de medida seleccionada no corresponde al ingrediente.',
  );
});

test('editar queda bloqueado si la receta tiene producciones asociadas', async () => {
  let rollback = 0;
  let actualizo = false;
  const conexion = {
    async execute(sql) {
      if (sql.includes('PRODUCCIONES')) return { rows: [{ ID_RECETA: 7, PRODUCCIONES: 1 }] };
      if (sql.startsWith('UPDATE RECETA')) actualizo = true;
      throw new Error('No debe continuar');
    },
    async commit() {},
    async rollback() { rollback += 1; },
  };
  await assert.rejects(() => modificarReceta(7, recetaValida, conexion), error => error.codigoEstado === 409);
  assert.equal(actualizo, false);
  assert.equal(rollback, 1);
});

test('editar una receta sin producción reemplaza sus ingredientes en una transacción', async () => {
  const operaciones = [];
  const conexion = crearConexionReceta({ operaciones, producciones: 0 });
  const resultado = await modificarReceta(7, recetaValida, conexion);
  assert.equal(resultado.ID_RECETA, 7);
  assert.equal(operaciones.some(sql => sql.startsWith('UPDATE RECETA')), true);
  assert.equal(operaciones.some(sql => sql.startsWith('DELETE FROM DETALLE_RECETA')), true);
});

test('desactivar conserva la receta y no elimina cabecera ni detalles', async () => {
  const operaciones = [];
  const conexion = crearConexionReceta({ operaciones });
  const resultado = await desactivarReceta(7, conexion);
  assert.equal(resultado.ESTADO, 'I');
  assert.equal(operaciones.some(sql => sql.startsWith('UPDATE RECETA SET ESTADO')), true);
  assert.equal(operaciones.some(sql => sql.startsWith('DELETE FROM RECETA')), false);
});

test('activa, desactiva y conserva compatibilidad al omitir el estado', async () => {
  const conexion = crearConexionReceta({});
  const activada = await actualizarEstadoReceta(7, 'A', conexion);
  assert.equal(activada.ESTADO, 'A');
  const desactivada = await actualizarEstadoReceta(7, undefined, conexion);
  assert.equal(desactivada.ESTADO, 'I');
  await assert.rejects(
    () => actualizarEstadoReceta(7, 'X', conexion),
    error => error.codigoEstado === 400,
  );
});

test('las rutas de recetas exigen sesión y el permiso correcto sin usar TIPO', async () => {
  let codigoSesion;
  await requerirSesion({ header() { return undefined; } }, { status(codigo) { codigoSesion = codigo; return this; }, json() {} }, () => {});
  assert.equal(codigoSesion, 401);

  let codigoPermiso;
  let siguiente = false;
  requerirAlgunPermiso(['GESTIONAR_RECETAS', 'AUTORIZAR_PEDIDOS'])(
    { identidad: { tipo: 'ADMIN', permisos: [] } },
    { status(codigo) { codigoPermiso = codigo; return this; }, json() {} },
    () => { siguiente = true; },
  );
  assert.equal(codigoPermiso, 403);
  assert.equal(siguiente, false);

  requerirAlgunPermiso(['GESTIONAR_RECETAS', 'AUTORIZAR_PEDIDOS'])(
    { identidad: { tipo: 'ESTANDAR', permisos: ['AUTORIZAR_PEDIDOS'] } },
    { status() { throw new Error('No debe rechazar'); }, json() {} },
    () => { siguiente = true; },
  );
  assert.equal(siguiente, true);
});

function crearConexionReceta(opciones = {}) {
  let estado = 'A';
  let cerrada = false;
  return {
    async execute(sql, parametros) {
      if (cerrada) {
        const error = new Error('NJS-003: invalid or closed connection');
        error.code = 'NJS-003';
        throw error;
      }
      opciones.operaciones?.push(sql);
      if (sql.includes('PRODUCCIONES')) return { rows: [{ ID_RECETA: parametros.identificadorReceta, PRODUCCIONES: opciones.producciones || 0 }] };
      if (sql.includes("TIPO = 'PFI'")) return { rows: opciones.tipoFallo === 'productoFinal' ? [] : [{ ID_PRODUCTO: parametros.identificadorProducto }] };
      if (sql.includes("TIPO IN ('MAT', 'INS')")) return { rows: opciones.tipoFallo === 'ingrediente' ? [] : [{ ID_PRODUCTO: parametros.identificadorProducto, ID_UNIDAD_MEDIDA: opciones.unidadProducto || 5 }] };
      if (sql.includes('FROM UNIDAD_MEDIDA')) return { rows: opciones.tipoFallo === 'unidad' ? [] : [{ ID_UNIDAD_MEDIDA: parametros.identificadorUnidadMedida }] };
      if (sql.includes('INSERT INTO RECETA')) { opciones.eventos?.push('INSERTAR_CABECERA'); return { outBinds: { identificadorReceta: [opciones.alInsertarReceta?.(parametros) || 7] } }; }
      if (sql.includes('INSERT INTO DETALLE_RECETA')) {
        if (opciones.fallarDetalle) throw new Error('Fallo simulado de detalle');
        opciones.eventos?.push('INSERTAR_DETALLE');
        return {};
      }
      if (sql.startsWith('DELETE FROM DETALLE_RECETA')) return {};
      if (sql.startsWith('UPDATE RECETA\n')) {
        opciones.alActualizar?.(parametros);
        opciones.eventos?.push('ACTUALIZAR_CABECERA');
        return {};
      }
      if (sql.startsWith('UPDATE RECETA SET ESTADO')) { estado = parametros.estado; return { rowsAffected: 1 }; }
      if (sql.includes('FROM RECETA r') && !sql.includes('PRODUCCIONES')) {
        opciones.eventos?.push('CONSULTAR_CABECERA');
        return { rows: [{ ID_RECETA: parametros.identificadorReceta, NOMBRE: 'Receta', UNIDADES_PRODUCIDAS: 100, ESTADO: estado, ID_PRODUCTO: 10, NOMBRE_PRODUCTO: 'Pan', TIPO_PRODUCTO: 'PFI' }] };
      }
      if (sql.includes('FROM DETALLE_RECETA')) { opciones.eventos?.push('CONSULTAR_DETALLE'); return { rows: [] }; }
      throw new Error('Consulta no esperada');
    },
    async commit() { opciones.eventos?.push('COMMIT'); },
    async rollback() {},
    async close() { cerrada = true; opciones.eventos?.push('CERRAR'); },
  };
}
