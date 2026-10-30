import * as distribucion from '../servicios/distribucion-servicio.js';
export async function pedidosDisponibles(s,r){r.json(await distribucion.pedidosDisponibles());}
export async function pilotos(s,r){r.json(await distribucion.pilotos());}
export async function crearEjecucion(s,r){r.status(201).json(await distribucion.crearEjecucion(s.body||{},s.identidad));}
export async function ejecuciones(s,r){r.json(await distribucion.ejecuciones());}
export async function detalleEjecucion(s,r){r.json(await distribucion.detalleEjecucion(s.params.id));}
export async function miRuta(s,r){r.json(await distribucion.miRuta(s.identidad));}
export async function confirmarEntrega(s,r){r.json(await distribucion.confirmarEntrega(s.params.id,s.identidad));}
export async function solicitarCambio(s,r){r.status(201).json(await distribucion.solicitarCambio(s.params.id,s.body||{},s.identidad));}
export async function solicitudesCambio(s,r){r.json(await distribucion.solicitudesCambio());}
export async function misSolicitudesCambio(s,r){r.json(await distribucion.misSolicitudesCambio(s.identidad));}
export async function resolverCambio(s,r){r.json(await distribucion.resolverCambio(s.params.id,s.body||{},s.identidad));}
export async function bitacoraGeneral(s,r){r.json(await distribucion.bitacoraGeneral(s.query));}
