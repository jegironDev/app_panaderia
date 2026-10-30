import * as productos from '../servicios/productos-servicio.js';
const id = valor => { const numero = Number(valor); if (!Number.isInteger(numero) || numero <= 0) { const error = new Error('El identificador no es válido.'); error.codigoEstado = 400; throw error; } return numero; };
export async function listarProductosAdministracion(solicitud, respuesta) { respuesta.json(await productos.listarProductosAdministracion(solicitud.query)); }
export async function consultarProductoAdministracion(solicitud, respuesta) { const producto = await productos.consultarProductoAdministracion(id(solicitud.params.id)); if (!producto) return respuesta.status(404).json({ error: 'Producto no encontrado.' }); respuesta.json(producto); }
export async function crearProducto(solicitud, respuesta) { respuesta.status(201).json(await productos.crearProducto(solicitud.body || {})); }
export async function editarProducto(solicitud, respuesta) { respuesta.json(await productos.editarProducto(id(solicitud.params.id), solicitud.body || {})); }
export async function estadoProducto(solicitud, respuesta) { respuesta.json(await productos.cambiarEstadoProducto(id(solicitud.params.id), String(solicitud.body?.estado || '').toUpperCase())); }
