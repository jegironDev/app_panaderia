import { Router } from 'express';
import { consultarExistencias, listarProductos } from '../controladores/catalogos-controlador.js';
import { obtenerEstadoConexion } from '../controladores/estado-controlador.js';
import { manejadorAsincrono } from '../intermediarios/manejo-errores.js';

export const rutasApi = Router();

rutasApi.get('/estado-conexion', obtenerEstadoConexion);
rutasApi.get('/productos', manejadorAsincrono(listarProductos));
rutasApi.get('/inventario/stock', manejadorAsincrono(consultarExistencias));
