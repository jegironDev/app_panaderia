// Informa que Express está activo; no sustituye las consultas reales a Oracle.
export function obtenerEstadoConexion(solicitud, respuesta) {
  respuesta.json({ estado: 'activo', servicio: 'panaderia-api' });
}
