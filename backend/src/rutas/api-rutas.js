import { Router } from 'express';
import {
  cerrarSesionUsuario,
  iniciarSesionUsuario,
  inicializarAccesoUsuario,
} from '../controladores/acceso-controlador.js';
import { consultarExistencias, listarProductos, listarUnidadesMedida } from '../controladores/catalogos-controlador.js';
import { actualizarEstadoUsuario, consultarUsuario, listarUsuarios, modificarUsuario, registrarUsuario } from '../controladores/usuarios-controlador.js';
import { agregarRolUsuario, eliminarRolUsuario, listarRoles, listarRolesUsuario } from '../controladores/roles-controlador.js';
import { agregarPermisoRol, eliminarPermisoRol, listarPermisos, listarPermisosEfectivosUsuario, listarPermisosRol } from '../controladores/permisos-controlador.js';
import { obtenerEstadoConexion } from '../controladores/estado-controlador.js';
import { listarSucursalesActivas } from '../controladores/sucursales-controlador.js';
import { autorizarPedidoRegistrado, bajarPedidoEnCola, consultarPedido, listarColaPedidos, listarEstadosPedido, listarJornadas, listarPedidos, registrarPedido, registrarSolicitudCancelacion, subirPedidoEnCola } from '../controladores/pedidos-controlador.js';
import { actualizarReceta, consultarReceta, inactivarReceta, listarRecetas, registrarReceta } from '../controladores/recetas-controlador.js';
import { requerirAlgunPermiso, requerirPermiso, requerirSesion } from '../intermediarios/autorizacion.js';
import { manejadorAsincrono } from '../intermediarios/manejo-errores.js';

export const rutasApi = Router();

rutasApi.post('/acceso/inicializar', manejadorAsincrono(inicializarAccesoUsuario));
rutasApi.post('/acceso/iniciar-sesion', manejadorAsincrono(iniciarSesionUsuario));
rutasApi.post('/acceso/cerrar-sesion', cerrarSesionUsuario);
rutasApi.get('/estado-conexion', obtenerEstadoConexion);
rutasApi.get('/sucursales', manejadorAsincrono(requerirSesion), requerirAlgunPermiso(['CREAR_USUARIOS', 'EDITAR_USUARIOS']), manejadorAsincrono(listarSucursalesActivas));
rutasApi.get('/pedidos/estados', manejadorAsincrono(requerirSesion), requerirAlgunPermiso(['CREAR_PEDIDOS', 'SOLICITAR_CANCELACION_PEDIDOS', 'AUTORIZAR_PEDIDOS']), manejadorAsincrono(listarEstadosPedido));
rutasApi.get('/pedidos/jornadas', manejadorAsincrono(requerirSesion), requerirAlgunPermiso(['CREAR_PEDIDOS', 'SOLICITAR_CANCELACION_PEDIDOS', 'AUTORIZAR_PEDIDOS']), manejadorAsincrono(listarJornadas));
rutasApi.get('/pedidos/cola', manejadorAsincrono(requerirSesion), requerirPermiso('AUTORIZAR_PRODUCCION'), manejadorAsincrono(listarColaPedidos));
rutasApi.get('/pedidos', manejadorAsincrono(requerirSesion), requerirAlgunPermiso(['CREAR_PEDIDOS', 'SOLICITAR_CANCELACION_PEDIDOS', 'AUTORIZAR_PEDIDOS']), manejadorAsincrono(listarPedidos));
rutasApi.get('/pedidos/:id', manejadorAsincrono(requerirSesion), requerirAlgunPermiso(['CREAR_PEDIDOS', 'SOLICITAR_CANCELACION_PEDIDOS', 'AUTORIZAR_PEDIDOS']), manejadorAsincrono(consultarPedido));
rutasApi.post('/pedidos', manejadorAsincrono(requerirSesion), requerirPermiso('CREAR_PEDIDOS'), manejadorAsincrono(registrarPedido));
rutasApi.post('/pedidos/:id/autorizar', manejadorAsincrono(requerirSesion), requerirPermiso('AUTORIZAR_PEDIDOS'), manejadorAsincrono(autorizarPedidoRegistrado));
rutasApi.patch('/pedidos/:id/cola/subir', manejadorAsincrono(requerirSesion), requerirPermiso('AUTORIZAR_PRODUCCION'), manejadorAsincrono(subirPedidoEnCola));
rutasApi.patch('/pedidos/:id/cola/bajar', manejadorAsincrono(requerirSesion), requerirPermiso('AUTORIZAR_PRODUCCION'), manejadorAsincrono(bajarPedidoEnCola));
rutasApi.post('/pedidos/:id/solicitudes-cancelacion', manejadorAsincrono(requerirSesion), requerirPermiso('SOLICITAR_CANCELACION_PEDIDOS'), manejadorAsincrono(registrarSolicitudCancelacion));
rutasApi.get('/recetas', manejadorAsincrono(requerirSesion), requerirAlgunPermiso(['GESTIONAR_RECETAS', 'AUTORIZAR_PEDIDOS']), manejadorAsincrono(listarRecetas));
rutasApi.get('/recetas/:id', manejadorAsincrono(requerirSesion), requerirAlgunPermiso(['GESTIONAR_RECETAS', 'AUTORIZAR_PEDIDOS']), manejadorAsincrono(consultarReceta));
rutasApi.post('/recetas', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_RECETAS'), manejadorAsincrono(registrarReceta));
rutasApi.put('/recetas/:id', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_RECETAS'), manejadorAsincrono(actualizarReceta));
rutasApi.patch('/recetas/:id/estado', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_RECETAS'), manejadorAsincrono(inactivarReceta));
rutasApi.get('/unidades-medida', manejadorAsincrono(requerirSesion), requerirAlgunPermiso(['GESTIONAR_RECETAS', 'AUTORIZAR_PEDIDOS']), manejadorAsincrono(listarUnidadesMedida));
rutasApi.get('/productos', manejadorAsincrono(requerirSesion), manejadorAsincrono(listarProductos));
rutasApi.get('/usuarios', manejadorAsincrono(requerirSesion), requerirPermiso('VER_USUARIOS'), manejadorAsincrono(listarUsuarios));
rutasApi.get('/usuarios/:id', manejadorAsincrono(requerirSesion), requerirPermiso('VER_USUARIOS'), manejadorAsincrono(consultarUsuario));
rutasApi.post('/usuarios', manejadorAsincrono(requerirSesion), requerirPermiso('CREAR_USUARIOS'), manejadorAsincrono(registrarUsuario));
rutasApi.put('/usuarios/:id', manejadorAsincrono(requerirSesion), requerirPermiso('EDITAR_USUARIOS'), manejadorAsincrono(modificarUsuario));
rutasApi.patch('/usuarios/:id/estado', manejadorAsincrono(requerirSesion), requerirPermiso('DESACTIVAR_USUARIOS'), manejadorAsincrono(actualizarEstadoUsuario));
rutasApi.get('/roles', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_ROLES'), manejadorAsincrono(listarRoles));
rutasApi.get('/usuarios/:id/roles', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_ROLES'), manejadorAsincrono(listarRolesUsuario));
rutasApi.post('/usuarios/:id/roles', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_ROLES'), manejadorAsincrono(agregarRolUsuario));
rutasApi.delete('/usuarios/:id/roles/:idRol', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_ROLES'), manejadorAsincrono(eliminarRolUsuario));
rutasApi.get('/permisos', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_PERMISOS'), manejadorAsincrono(listarPermisos));
rutasApi.get('/roles/:id/permisos', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_PERMISOS'), manejadorAsincrono(listarPermisosRol));
rutasApi.post('/roles/:id/permisos', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_PERMISOS'), manejadorAsincrono(agregarPermisoRol));
rutasApi.delete('/roles/:id/permisos/:idPermiso', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_PERMISOS'), manejadorAsincrono(eliminarPermisoRol));
rutasApi.get('/usuarios/:id/permisos', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_PERMISOS'), manejadorAsincrono(listarPermisosEfectivosUsuario));
rutasApi.get(
  '/inventario/stock',
  manejadorAsincrono(requerirSesion),
  requerirPermiso('VER_INVENTARIO'),
  manejadorAsincrono(consultarExistencias),
);
