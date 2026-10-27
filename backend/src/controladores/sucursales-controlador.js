import { obtenerConexion } from '../configuracion/base-datos.js';
import { consultarSucursalesActivas } from '../servicios/sucursales-servicio.js';

export async function listarSucursalesActivas(solicitud, respuesta) {
  const conexion = await obtenerConexion();
  try {
    respuesta.json(await consultarSucursalesActivas(conexion));
  } finally {
    await conexion.close();
  }
}
