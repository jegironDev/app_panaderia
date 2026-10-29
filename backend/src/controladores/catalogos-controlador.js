import { consultarProcedimiento, consultarProductosDetallados, consultarProductosPorTipo, consultarUnidadesMedidaActivas } from '../servicios/consultas-oracle.js';

// Devuelve los productos activos obtenidos desde el paquete Oracle existente.
export async function listarProductos(solicitud, respuesta) {
  if (solicitud.query.formato === 'detallado') {
    const tipo = typeof solicitud.query.tipo === 'string' && solicitud.query.tipo.trim()
      ? solicitud.query.tipo.trim()
      : null;
    return respuesta.json(await consultarProductosDetallados(tipo));
  }
  if (solicitud.query.tipo === 'PFI') {
    return respuesta.json(await consultarProductosPorTipo('PFI'));
  }
  respuesta.json(await consultarProcedimiento('OBTENER_PRODUCTOS'));
}

// Expone las unidades activas necesarias para seleccionar ingredientes de recetas.
export async function listarUnidadesMedida(solicitud, respuesta) {
  respuesta.json(await consultarUnidadesMedidaActivas());
}

// Devuelve las existencias disponibles calculadas por la vista Oracle existente.
export async function consultarExistencias(solicitud, respuesta) {
  respuesta.json(await consultarProcedimiento('OBTENER_STOCK'));
}
