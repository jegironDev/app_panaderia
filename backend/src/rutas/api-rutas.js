import { Router } from 'express';
import {
  cerrarSesionUsuario,
  iniciarSesionUsuario,
  inicializarAccesoUsuario,
} from '../controladores/acceso-controlador.js';
import { consultarExistencias, listarProductos } from '../controladores/catalogos-controlador.js';
import { obtenerEstadoConexion } from '../controladores/estado-controlador.js';
import { manejadorAsincrono } from '../intermediarios/manejo-errores.js';

export const rutasApi = Router();

rutasApi.post('/acceso/inicializar', manejadorAsincrono(inicializarAccesoUsuario));
rutasApi.post('/acceso/iniciar-sesion', manejadorAsincrono(iniciarSesionUsuario));
rutasApi.post('/acceso/cerrar-sesion', cerrarSesionUsuario);
rutasApi.get('/estado-conexion', obtenerEstadoConexion);
rutasApi.get('/productos', manejadorAsincrono(listarProductos));
rutasApi.get('/inventario/stock', manejadorAsincrono(consultarExistencias));
