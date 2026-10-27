// Envía errores asíncronos al manejador común de Express.
export const manejadorAsincrono = funcion => (solicitud, respuesta, siguiente) =>
  Promise.resolve(funcion(solicitud, respuesta, siguiente)).catch(siguiente);

// Evita revelar trazas, consultas o valores privados al cliente HTTP.
export function manejarError(error, solicitud, respuesta, siguiente) {
  console.error('Error en API:', error.message);
  respuesta
    .status(error.codigoEstado || 500)
    .json({ error: 'No fue posible completar la operación' });
}

// Mantiene una respuesta coherente para rutas de API que no existen.
export function responderRutaNoEncontrada(solicitud, respuesta) {
  respuesta.status(404).json({ error: 'Ruta no encontrada' });
}
