import test from 'node:test';
import assert from 'node:assert/strict';
import { fuentesDisponiblesBitacora, consultarBitacora } from '../src/servicios/distribucion-servicio.js';
import { requerirPermiso, requerirSesion } from '../src/intermediarios/autorizacion.js';

test('expone únicamente las fuentes útiles del portal de auditoría', () => {
  assert.deepEqual(
    fuentesDisponiblesBitacora().map(fuente => fuente.codigo),
    ['pedidos', 'sesiones', 'usuarios'],
  );
});

test('rechaza un tipo de bitácora fuera de la lista permitida antes de consultar Oracle', async () => {
  await assert.rejects(
    () => consultarBitacora('TABLA_INEXISTENTE'),
    error => error.codigoEstado === 404 && /no válido/.test(error.message),
  );
});

test('valida que la fecha inicial no sea posterior a la final', async () => {
  await assert.rejects(
    () => consultarBitacora('general', { desde: '2026-10-30', hasta: '2026-10-01' }),
    error => error.codigoEstado === 400 && /inicial/.test(error.message),
  );
});

test('las rutas históricas conservan sesión y permiso de reportes', async () => {
  let codigoSesion;
  await requerirSesion(
    { header() { return undefined; } },
    { status(codigo) { codigoSesion = codigo; return this; }, json() {} },
    () => {},
  );
  assert.equal(codigoSesion, 401);

  let continuo = false;
  requerirPermiso('VER_REPORTES')(
    { identidad: { permisos: ['VER_REPORTES'] } },
    { status() { throw new Error('No debe rechazar'); }, json() {} },
    () => { continuo = true; },
  );
  assert.equal(continuo, true);
});
