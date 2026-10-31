import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rutaServicio = new URL('../src/servicios/distribucion-servicio.js', import.meta.url);

test('resolver un rechazo persiste el estado resuelto y conserva la posición de la entrega', async () => {
  const codigo = await readFile(rutaServicio, 'utf8');
  assert.match(codigo, /let estado='RECHAZADA';/);
  assert.match(codigo, /UPDATE SOLICITUD_REORDENAMIENTO SET ESTADO=:estado,ID_USUARIO_RESUELVE=:usuario,FECHA_RESOLUCION=SYSTIMESTAMP,OBSERVACION_RESOLUCION=:observacion/);
  assert.match(codigo, /if\(decision==='AUTORIZAR'\)\{/);
  assert.doesNotMatch(codigo, /decision==='RECHAZAR'[\s\S]{0,500}UPDATE ENTREGA_RUTA SET POSICION/);
});

test('la consulta del piloto solo lee solicitudes y conserva sus campos de resolución', async () => {
  const codigo = await readFile(rutaServicio, 'utf8');
  const inicio = codigo.indexOf('export async function misSolicitudesCambio');
  const fin = codigo.indexOf('export async function resolverCambio', inicio);
  const funcion = codigo.slice(inicio, fin);
  assert.match(funcion, /SELECT s\.\*,er\.ID_PEDIDO,r\.NOMBRE RUTA,u\.USUARIO RESPONSABLE/);
  assert.doesNotMatch(funcion, /\bUPDATE\b|\bINSERT\b|\bDELETE\b/);
});
