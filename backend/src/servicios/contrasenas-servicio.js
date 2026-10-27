import { randomBytes, scrypt as derivarClave, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const derivarClaveAsincrona = promisify(derivarClave);

// Genera un hash con sal aleatoria para no almacenar contraseñas en texto plano.
export async function crearHashContrasena(contrasena) {
  const sal = randomBytes(16).toString('hex');
  const claveDerivada = await derivarClaveAsincrona(contrasena, sal, 64);

  return `scrypt$${sal}$${claveDerivada.toString('hex')}`;
}

// Compara una contraseña recibida con el hash almacenado sin filtrar diferencias temporales.
export async function verificarContrasena(contrasena, hashAlmacenado) {
  const [algoritmo, sal, claveEsperada] = hashAlmacenado.split('$');

  if (algoritmo !== 'scrypt' || !sal || !claveEsperada) {
    return false;
  }

  const claveCalculada = await derivarClaveAsincrona(contrasena, sal, 64);
  return timingSafeEqual(claveCalculada, Buffer.from(claveEsperada, 'hex'));
}
