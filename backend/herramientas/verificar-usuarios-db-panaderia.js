const contrasena = process.env.CONTRASENA_INICIAL_USUARIOS;
const base = process.env.URL_API_VERIFICACION || 'http://127.0.0.1:3000/api';
const usuarios = ['JGIRON', 'cmendez', 'amorales', 'lramirez', 'plopez', 'rcastillo', 'dherrera', 'svargas'];

if (!contrasena) {
  throw new Error('Falta CONTRASENA_INICIAL_USUARIOS para la comprobación local.');
}

for (const usuario of usuarios) {
  const ingreso = await fetch(`${base}/acceso/iniciar-sesion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, contrasena }),
  });
  if (!ingreso.ok) throw new Error(`El inicio de sesión de ${usuario} respondió HTTP ${ingreso.status}.`);
  const sesion = await ingreso.json();
  const productos = await fetch(`${base}/productos`, {
    headers: { Authorization: `Bearer ${sesion.token}` },
  });
  if (!productos.ok) throw new Error(`La sesión de ${usuario} no accedió al catálogo: HTTP ${productos.status}.`);
  console.log(`${usuario}: autenticación y sesión verificadas (${sesion.usuario.permisos.length} permisos).`);
}
