const contrasena = process.env.CONTRASENA_INICIAL_USUARIOS;
const base = process.env.URL_API_VERIFICACION || 'http://127.0.0.1:3000/api';
const rutas = [
  '/productos',
  '/unidades-medida',
  '/inventario/stock',
  '/recetas',
  '/pedidos/estados',
  '/pedidos/jornadas',
  '/pedidos',
  '/pedidos/cola',
  '/producciones',
];

if (!contrasena) throw new Error('Falta CONTRASENA_INICIAL_USUARIOS para la comprobación local.');

const ingreso = await fetch(`${base}/acceso/iniciar-sesion`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ usuario: 'JGIRON', contrasena }),
});
if (!ingreso.ok) throw new Error(`No fue posible iniciar sesión de administración: HTTP ${ingreso.status}.`);
const { token } = await ingreso.json();
for (const ruta of rutas) {
  const respuesta = await fetch(`${base}${ruta}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!respuesta.ok) throw new Error(`${ruta} respondió HTTP ${respuesta.status}.`);
  const cuerpo = await respuesta.json();
  const cantidad = Array.isArray(cuerpo) ? cuerpo.length : Object.keys(cuerpo).length;
  console.log(`${ruta}: HTTP ${respuesta.status} (${cantidad} elementos/campos).`);
}
