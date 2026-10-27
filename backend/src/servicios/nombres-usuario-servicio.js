const longitudMaximaUsuario = 50;

// Normaliza texto para construir un identificador estable y compatible con Oracle.
export function normalizarParteUsuario(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Genera candidatos en el orden definido: inicial, dos letras y sufijos numéricos.
export function* generarCandidatosUsuario(primerNombre, primerApellido) {
  const nombre = normalizarParteUsuario(primerNombre);
  const apellido = normalizarParteUsuario(primerApellido);
  if (!nombre || !apellido) {
    const error = new Error('El nombre y apellido deben contener caracteres utilizables');
    error.codigoEstado = 400;
    throw error;
  }
  const baseInicial = `${nombre.slice(0, 1)}${apellido}`;
  yield limitarLongitud(baseInicial);
  const baseDosLetras = `${nombre.slice(0, 2)}${apellido}`;
  if (baseDosLetras !== baseInicial) yield limitarLongitud(baseDosLetras);
  for (let sufijo = 1; ; sufijo += 1) yield limitarLongitud(baseDosLetras, String(sufijo));
}

function limitarLongitud(base, sufijo = '') {
  return `${base.slice(0, longitudMaximaUsuario - sufijo.length)}${sufijo}`;
}
