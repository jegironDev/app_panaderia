import * as operaciones from '../servicios/operaciones-servicio.js';
const id = valor => { const n=Number(valor); if(!Number.isInteger(n)||n<=0){const e=new Error('Identificador no válido.');e.codigoEstado=400;e.mensajeCliente=e.message;throw e;}return n; };
export async function listarAbastecimientos(s,r){r.json(await operaciones.listarAbastecimientos(s.query));}
export async function crearAbastecimiento(s,r){r.status(201).json(await operaciones.registrarAbastecimiento(s.body||{},s.identidad));}
export async function listarRutas(s,r){r.json(await operaciones.listarRutas(s.query.incluirInactivas==='true'));}
export async function crearRuta(s,r){r.status(201).json(await operaciones.guardarRuta(null,s.body||{}));}
export async function editarRuta(s,r){r.json(await operaciones.guardarRuta(id(s.params.id),s.body||{}));}
export async function estadoRuta(s,r){const estado=String(s.body?.estado||'').toUpperCase();if(!['A','I'].includes(estado)){const e=new Error('Estado no válido.');e.codigoEstado=400;e.mensajeCliente=e.message;throw e;}r.json(await operaciones.cambiarEstadoRuta(id(s.params.id),estado));}
export async function listarDespachos(s,r){r.json(await operaciones.listarDespachos(s.identidad,false));}
export async function crearDespachos(s,r){r.status(201).json(await operaciones.prepararDespachos(s.body||{},s.identidad));}
export async function miRuta(s,r){r.json(await operaciones.listarDespachos(s.identidad,true));}
export async function entregar(s,r){r.json(await operaciones.confirmarEntrega(id(s.params.id),s.identidad));}
export async function listarCancelaciones(s,r){r.json(await operaciones.listarCancelaciones());}
export async function resolverCancelacion(s,r){r.json(await operaciones.resolverCancelacion(id(s.params.id),s.body||{},s.identidad));}
export async function dashboard(s,r){r.json(await operaciones.consultarDashboard(s.query.limiteSemanal||s.query.limite,s.query.limiteMensual||s.query.limite));}
