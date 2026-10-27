import test from 'node:test';
import assert from 'node:assert/strict';
import { generarCandidatosUsuario } from '../src/servicios/nombres-usuario-servicio.js';

test('normaliza tildes, espacios y caracteres especiales al generar candidatos', () => {
  const candidatos = generarCandidatosUsuario(' Ána María ', ' García-López ');
  assert.equal(candidatos.next().value, 'agarcia-lopez'.replace('-', ''));
  assert.equal(candidatos.next().value, 'angarcia-lopez'.replace('-', ''));
  assert.equal(candidatos.next().value, 'angarcia-lopez1'.replace('-', ''));
});

test('limita el nombre de usuario a cincuenta caracteres conservando el sufijo', () => {
  const apellido = 'a'.repeat(50);
  const candidatos = generarCandidatosUsuario('Luz', apellido);
  candidatos.next();
  candidatos.next();
  const candidatoConSufijo = candidatos.next().value;
  assert.equal(candidatoConSufijo.length, 50);
  assert.equal(candidatoConSufijo.endsWith('1'), true);
});
