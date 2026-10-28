import { consultarProcedimiento, consultarProductosPorTipo } from '../servicios/consultas-oracle.js';

// Devuelve los productos activos obtenidos desde el paquete Oracle existente.
export async function listarProductos(solicitud, respuesta) {
  if (solicitud.query.tipo === 'PFI') {
    return respuesta.json(await consultarProductosPorTipo('PFI'));
  }
  respuesta.json(await consultarProcedimiento('OBTENER_PRODUCTOS'));
}

// Devuelve las existencias disponibles calculadas por la vista Oracle existente.
export async function consultarExistencias(solicitud, respuesta) {
  respuesta.json(await consultarProcedimiento('OBTENER_STOCK'));
}
