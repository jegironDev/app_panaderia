const contrasena = process.env.CONTRASENA_INICIAL_USUARIOS;
const base = process.env.URL_API_VERIFICACION || 'http://127.0.0.1:3000/api';
const comprobaciones = [
  ['dherrera', '/pedidos', 200],
  ['dherrera', '/pedidos/cola', 403],
  ['dherrera', '/producciones', 403],
  ['cmendez', '/producciones', 200],
  ['cmendez', '/recetas', 200],
  ['cmendez', '/usuarios', 403],
  ['amorales', '/producciones', 200],
  ['rcastillo', '/pedidos', 403],
];

if (!contrasena) throw new Error('Falta CONTRASENA_INICIAL_USUARIOS para la comprobación local.');

const sesiones = new Map();
for (const [usuario] of comprobaciones) {
  if (sesiones.has(usuario)) continue;
  const respuesta = await fetch(`${base}/acceso/iniciar-sesion`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, contrasena }),
  });
  if (!respuesta.ok) throw new Error(`No fue posible autenticar ${usuario}: HTTP ${respuesta.status}.`);
  sesiones.set(usuario, (await respuesta.json()).token);
}
for (const [usuario, ruta, esperado] of comprobaciones) {
  const respuesta = await fetch(`${base}${ruta}`, { headers: { Authorization: `Bearer ${sesiones.get(usuario)}` } });
  if (respuesta.status !== esperado) throw new Error(`${usuario} en ${ruta}: se esperaba HTTP ${esperado} y se obtuvo ${respuesta.status}.`);
  console.log(`${usuario} ${ruta}: HTTP ${respuesta.status}.`);
}
