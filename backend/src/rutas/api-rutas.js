import { Router } from "express";
import {
  cerrarSesionUsuario,
  consultarSesionUsuario,
  iniciarSesionUsuario,
  inicializarAccesoUsuario,
} from "../controladores/acceso-controlador.js";
import {
  consultarExistencias,
  listarProductos,
  listarUnidadesMedida,
} from "../controladores/catalogos-controlador.js";
import { listarProductosAdministracion, consultarProductoAdministracion, crearProducto, editarProducto, estadoProducto } from '../controladores/productos-controlador.js';
import {
  actualizarEstadoUsuario,
  consultarUsuario,
  listarUsuarios,
  modificarUsuario,
  registrarUsuario,
} from "../controladores/usuarios-controlador.js";
import {
  agregarRolUsuario,
  eliminarRolUsuario,
  listarRoles,
  listarRolesUsuario,
} from "../controladores/roles-controlador.js";
import {
  agregarPermisoRol,
  eliminarPermisoRol,
  listarPermisos,
  listarPermisosEfectivosUsuario,
  listarPermisosRol,
} from "../controladores/permisos-controlador.js";
import {
  actualizarEstadoPuesto,
  actualizarPuesto,
  consultarPuestoAdministracion,
  listarPuestosAsignables,
  listarPuestosAdministracion,
  registrarPuesto,
} from "../controladores/puestos-controlador.js";
import { obtenerEstadoConexion } from "../controladores/estado-controlador.js";
import { listarSucursalesActivas } from "../controladores/sucursales-controlador.js";
import {
  autorizarPedidoRegistrado,
  bajarPedidoEnCola,
  consultarPedido,
  listarColaPedidos,
  listarEstadosPedido,
  listarJornadas,
  listarPedidos,
  registrarPedido,
  registrarSolicitudCancelacion,
  subirPedidoEnCola,
} from "../controladores/pedidos-controlador.js";
import {
  actualizarReceta,
  consultarReceta,
  inactivarReceta,
  listarRecetas,
  registrarReceta,
} from "../controladores/recetas-controlador.js";
import {
  autorizarPlanificacionProduccion,
  consultarOpcionesPlanificacionProduccion,
  consultarPlanificacionProduccion,
  consultarProduccion,
  consultarProduccionesPedido,
  finalizarProduccionRegistrada,
  iniciarProduccionRegistrada,
  listarProduccionesRegistradas,
} from "../controladores/produccion-controlador.js";
import {
  crearAbastecimiento, crearDespachos, crearRuta, dashboard, editarRuta, entregar,
  estadoRuta, listarAbastecimientos, listarCancelaciones, listarDespachos, listarRutas,
  miRuta, resolverCancelacion,
} from "../controladores/operaciones-controlador.js";
import { pedidosDisponibles as pedidosDisponiblesDistribucion, pilotos as pilotosDistribucion, crearEjecucion, ejecuciones as ejecucionesDistribucion, detalleEjecucion as detalleEjecucionDistribucion, miRuta as miRutaDistribucion, confirmarEntrega as confirmarEntregaDistribucion, solicitarCambio, solicitudesCambio, misSolicitudesCambio, resolverCambio, bitacoraGeneral } from '../controladores/distribucion-controlador.js';
import {
  requerirAlgunPermiso,
  requerirPermiso,
  requerirSesion,
} from "../intermediarios/autorizacion.js";
import { manejadorAsincrono } from "../intermediarios/manejo-errores.js";

export const rutasApi = Router();

rutasApi.post(
  "/acceso/inicializar",
  manejadorAsincrono(inicializarAccesoUsuario),
);
rutasApi.get(
  "/producciones/pedidos/:id",
  manejadorAsincrono(requerirSesion),
  requerirAlgunPermiso(["AUTORIZAR_PRODUCCION", "INICIAR_PRODUCCION", "CONFIRMAR_PRODUCCION"]),
  manejadorAsincrono(consultarProduccionesPedido),
);
rutasApi.get(
  "/producciones",
  manejadorAsincrono(requerirSesion),
  requerirAlgunPermiso(["AUTORIZAR_PRODUCCION", "INICIAR_PRODUCCION", "CONFIRMAR_PRODUCCION"]),
  manejadorAsincrono(listarProduccionesRegistradas),
);
rutasApi.post(
  "/acceso/iniciar-sesion",
  manejadorAsincrono(iniciarSesionUsuario),
);
rutasApi.post("/acceso/cerrar-sesion", cerrarSesionUsuario);
rutasApi.get('/acceso/sesion', manejadorAsincrono(requerirSesion), consultarSesionUsuario);
rutasApi.get("/estado-conexion", obtenerEstadoConexion);
rutasApi.get('/dashboard', manejadorAsincrono(requerirSesion), requerirPermiso('VER_REPORTES'), manejadorAsincrono(dashboard));
rutasApi.get('/despachos/pedidos-disponibles', manejadorAsincrono(requerirSesion), requerirPermiso('PREPARAR_DESPACHOS'), manejadorAsincrono(pedidosDisponiblesDistribucion));
rutasApi.get('/despachos/pilotos', manejadorAsincrono(requerirSesion), requerirPermiso('PREPARAR_DESPACHOS'), manejadorAsincrono(pilotosDistribucion));
rutasApi.get('/ejecuciones-ruta', manejadorAsincrono(requerirSesion), requerirPermiso('PREPARAR_DESPACHOS'), manejadorAsincrono(ejecucionesDistribucion));
rutasApi.post('/ejecuciones-ruta', manejadorAsincrono(requerirSesion), requerirPermiso('PREPARAR_DESPACHOS'), manejadorAsincrono(crearEjecucion));
rutasApi.get('/ejecuciones-ruta/:id', manejadorAsincrono(requerirSesion), requerirPermiso('PREPARAR_DESPACHOS'), manejadorAsincrono(detalleEjecucionDistribucion));
rutasApi.get('/piloto/entregas', manejadorAsincrono(requerirSesion), requerirPermiso('CONSULTAR_MI_RUTA'), manejadorAsincrono(miRutaDistribucion));
rutasApi.post('/piloto/entregas/:id/confirmar', manejadorAsincrono(requerirSesion), requerirPermiso('CONFIRMAR_ENTREGAS'), manejadorAsincrono(confirmarEntregaDistribucion));
rutasApi.post('/piloto/entregas/:id/solicitudes-reordenamiento', manejadorAsincrono(requerirSesion), requerirPermiso('SOLICITAR_REORDENAMIENTO'), manejadorAsincrono(solicitarCambio));
rutasApi.get('/piloto/solicitudes-reordenamiento', manejadorAsincrono(requerirSesion), requerirPermiso('SOLICITAR_REORDENAMIENTO'), manejadorAsincrono(misSolicitudesCambio));
rutasApi.get('/reordenamientos', manejadorAsincrono(requerirSesion), requerirPermiso('RESOLVER_REORDENAMIENTOS'), manejadorAsincrono(solicitudesCambio));
rutasApi.post('/reordenamientos/:id/resolver', manejadorAsincrono(requerirSesion), requerirPermiso('RESOLVER_REORDENAMIENTOS'), manejadorAsincrono(resolverCambio));
rutasApi.get('/bitacoras', manejadorAsincrono(requerirSesion), requerirPermiso('VER_REPORTES'), manejadorAsincrono(bitacoraGeneral));
rutasApi.get('/abastecimientos', manejadorAsincrono(requerirSesion), requerirPermiso('VER_INVENTARIO'), manejadorAsincrono(listarAbastecimientos));
rutasApi.post('/abastecimientos', manejadorAsincrono(requerirSesion), requerirPermiso('REGISTRAR_ENTRADA_INVENTARIO'), manejadorAsincrono(crearAbastecimiento));
rutasApi.get('/rutas', manejadorAsincrono(requerirSesion), requerirAlgunPermiso(['GESTIONAR_RUTAS', 'CONSULTAR_RUTAS']), manejadorAsincrono(listarRutas));
rutasApi.post('/rutas', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_RUTAS'), manejadorAsincrono(crearRuta));
rutasApi.put('/rutas/:id', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_RUTAS'), manejadorAsincrono(editarRuta));
rutasApi.patch('/rutas/:id/estado', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_RUTAS'), manejadorAsincrono(estadoRuta));
rutasApi.get('/despachos', manejadorAsincrono(requerirSesion), requerirPermiso('PREPARAR_DESPACHOS'), manejadorAsincrono(listarDespachos));
rutasApi.post('/despachos', manejadorAsincrono(requerirSesion), requerirPermiso('PREPARAR_DESPACHOS'), manejadorAsincrono(crearDespachos));
rutasApi.get('/mi-ruta', manejadorAsincrono(requerirSesion), requerirPermiso('CONFIRMAR_ENTREGAS'), manejadorAsincrono(miRuta));
rutasApi.post('/despachos/:id/entregar', manejadorAsincrono(requerirSesion), requerirPermiso('CONFIRMAR_ENTREGAS'), manejadorAsincrono(entregar));
rutasApi.get('/cancelaciones', manejadorAsincrono(requerirSesion), requerirPermiso('RESOLVER_CANCELACIONES_PEDIDOS'), manejadorAsincrono(listarCancelaciones));
rutasApi.post('/cancelaciones/:id/resolver', manejadorAsincrono(requerirSesion), requerirPermiso('RESOLVER_CANCELACIONES_PEDIDOS'), manejadorAsincrono(resolverCancelacion));
rutasApi.get(
  "/sucursales",
  manejadorAsincrono(requerirSesion),
  requerirAlgunPermiso(["CREAR_USUARIOS", "EDITAR_USUARIOS"]),
  manejadorAsincrono(listarSucursalesActivas),
);
rutasApi.get(
  "/pedidos/estados",
  manejadorAsincrono(requerirSesion),
  requerirAlgunPermiso([
    "CREAR_PEDIDOS",
    "SOLICITAR_CANCELACION_PEDIDOS",
    "AUTORIZAR_PEDIDOS",
  ]),
  manejadorAsincrono(listarEstadosPedido),
);
rutasApi.get(
  "/pedidos/jornadas",
  manejadorAsincrono(requerirSesion),
  requerirAlgunPermiso([
    "CREAR_PEDIDOS",
    "SOLICITAR_CANCELACION_PEDIDOS",
    "AUTORIZAR_PEDIDOS",
  ]),
  manejadorAsincrono(listarJornadas),
);
rutasApi.get(
  "/pedidos/cola",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("AUTORIZAR_PRODUCCION"),
  manejadorAsincrono(listarColaPedidos),
);
rutasApi.get(
  "/pedidos",
  manejadorAsincrono(requerirSesion),
  requerirAlgunPermiso([
    "CREAR_PEDIDOS",
    "SOLICITAR_CANCELACION_PEDIDOS",
    "AUTORIZAR_PEDIDOS",
  ]),
  manejadorAsincrono(listarPedidos),
);
rutasApi.get(
  "/pedidos/:id",
  manejadorAsincrono(requerirSesion),
  requerirAlgunPermiso([
    "CREAR_PEDIDOS",
    "SOLICITAR_CANCELACION_PEDIDOS",
    "AUTORIZAR_PEDIDOS",
  ]),
  manejadorAsincrono(consultarPedido),
);
rutasApi.post(
  "/pedidos",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("CREAR_PEDIDOS"),
  manejadorAsincrono(registrarPedido),
);
rutasApi.post(
  "/pedidos/:id/autorizar",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("AUTORIZAR_PEDIDOS"),
  manejadorAsincrono(autorizarPedidoRegistrado),
);
rutasApi.patch(
  "/pedidos/:id/cola/subir",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("AUTORIZAR_PRODUCCION"),
  manejadorAsincrono(subirPedidoEnCola),
);
rutasApi.patch(
  "/pedidos/:id/cola/bajar",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("AUTORIZAR_PRODUCCION"),
  manejadorAsincrono(bajarPedidoEnCola),
);
rutasApi.post(
  "/pedidos/:id/solicitudes-cancelacion",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("SOLICITAR_CANCELACION_PEDIDOS"),
  manejadorAsincrono(registrarSolicitudCancelacion),
);
rutasApi.get(
  "/producciones/pedidos/:id/opciones-planificacion",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("AUTORIZAR_PRODUCCION"),
  manejadorAsincrono(consultarOpcionesPlanificacionProduccion),
);
rutasApi.post(
  "/producciones/planificar",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("AUTORIZAR_PRODUCCION"),
  manejadorAsincrono(consultarPlanificacionProduccion),
);
rutasApi.post(
  "/producciones/autorizar",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("AUTORIZAR_PRODUCCION"),
  manejadorAsincrono(autorizarPlanificacionProduccion),
);
rutasApi.post(
  "/producciones/:id/iniciar",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("INICIAR_PRODUCCION"),
  manejadorAsincrono(iniciarProduccionRegistrada),
);
rutasApi.post(
  "/producciones/:id/finalizar",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("CONFIRMAR_PRODUCCION"),
  manejadorAsincrono(finalizarProduccionRegistrada),
);
rutasApi.get(
  "/producciones/:id",
  manejadorAsincrono(requerirSesion),
  requerirAlgunPermiso(["AUTORIZAR_PRODUCCION", "INICIAR_PRODUCCION", "CONFIRMAR_PRODUCCION"]),
  manejadorAsincrono(consultarProduccion),
);
rutasApi.get(
  "/recetas",
  manejadorAsincrono(requerirSesion),
  requerirAlgunPermiso(["GESTIONAR_RECETAS", "AUTORIZAR_PEDIDOS"]),
  manejadorAsincrono(listarRecetas),
);
rutasApi.get(
  "/recetas/:id",
  manejadorAsincrono(requerirSesion),
  requerirAlgunPermiso(["GESTIONAR_RECETAS", "AUTORIZAR_PEDIDOS"]),
  manejadorAsincrono(consultarReceta),
);
rutasApi.post(
  "/recetas",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_RECETAS"),
  manejadorAsincrono(registrarReceta),
);
rutasApi.put(
  "/recetas/:id",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_RECETAS"),
  manejadorAsincrono(actualizarReceta),
);
rutasApi.patch(
  "/recetas/:id/estado",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_RECETAS"),
  manejadorAsincrono(inactivarReceta),
);
rutasApi.get(
  "/unidades-medida",
  manejadorAsincrono(requerirSesion),
  requerirAlgunPermiso(["GESTIONAR_RECETAS", "AUTORIZAR_PEDIDOS"]),
  manejadorAsincrono(listarUnidadesMedida),
);
rutasApi.get(
  "/productos",
  manejadorAsincrono(requerirSesion),
  manejadorAsincrono(listarProductos),
);
rutasApi.get('/productos/administracion', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_PRODUCTOS'), manejadorAsincrono(listarProductosAdministracion));
rutasApi.get('/productos/administracion/:id', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_PRODUCTOS'), manejadorAsincrono(consultarProductoAdministracion));
rutasApi.post('/productos', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_PRODUCTOS'), manejadorAsincrono(crearProducto));
rutasApi.put('/productos/:id', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_PRODUCTOS'), manejadorAsincrono(editarProducto));
rutasApi.patch('/productos/:id/estado', manejadorAsincrono(requerirSesion), requerirPermiso('GESTIONAR_PRODUCTOS'), manejadorAsincrono(estadoProducto));
rutasApi.get(
  "/usuarios",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("VER_USUARIOS"),
  manejadorAsincrono(listarUsuarios),
);
rutasApi.get(
  "/usuarios/:id",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("VER_USUARIOS"),
  manejadorAsincrono(consultarUsuario),
);
rutasApi.post(
  "/usuarios",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("CREAR_USUARIOS"),
  manejadorAsincrono(registrarUsuario),
);
rutasApi.put(
  "/usuarios/:id",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("EDITAR_USUARIOS"),
  manejadorAsincrono(modificarUsuario),
);
rutasApi.patch(
  "/usuarios/:id/estado",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("DESACTIVAR_USUARIOS"),
  manejadorAsincrono(actualizarEstadoUsuario),
);
rutasApi.get(
  "/roles",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_ROLES"),
  manejadorAsincrono(listarRoles),
);
rutasApi.get(
  "/puestos/asignables",
  manejadorAsincrono(requerirSesion),
  requerirAlgunPermiso(["GESTIONAR_USUARIOS", "GESTIONAR_PUESTOS"]),
  manejadorAsincrono(listarPuestosAsignables),
);
rutasApi.get(
  "/puestos",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_PUESTOS"),
  manejadorAsincrono(listarPuestosAdministracion),
);
rutasApi.get(
  "/puestos/:id",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_PUESTOS"),
  manejadorAsincrono(consultarPuestoAdministracion),
);
rutasApi.post(
  "/puestos",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_PUESTOS"),
  manejadorAsincrono(registrarPuesto),
);
rutasApi.put(
  "/puestos/:id",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_PUESTOS"),
  manejadorAsincrono(actualizarPuesto),
);
rutasApi.patch(
  "/puestos/:id/estado",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_PUESTOS"),
  manejadorAsincrono(actualizarEstadoPuesto),
);
rutasApi.get(
  "/usuarios/:id/roles",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_ROLES"),
  manejadorAsincrono(listarRolesUsuario),
);
rutasApi.post(
  "/usuarios/:id/roles",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_ROLES"),
  manejadorAsincrono(agregarRolUsuario),
);
rutasApi.delete(
  "/usuarios/:id/roles/:idRol",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_ROLES"),
  manejadorAsincrono(eliminarRolUsuario),
);
rutasApi.get(
  "/permisos",
  manejadorAsincrono(requerirSesion),
  requerirAlgunPermiso(["GESTIONAR_PERMISOS", "GESTIONAR_PUESTOS"]),
  manejadorAsincrono(listarPermisos),
);
rutasApi.get(
  "/roles/:id/permisos",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_PERMISOS"),
  manejadorAsincrono(listarPermisosRol),
);
rutasApi.post(
  "/roles/:id/permisos",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_PERMISOS"),
  manejadorAsincrono(agregarPermisoRol),
);
rutasApi.delete(
  "/roles/:id/permisos/:idPermiso",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_PERMISOS"),
  manejadorAsincrono(eliminarPermisoRol),
);
rutasApi.get(
  "/usuarios/:id/permisos",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("GESTIONAR_PERMISOS"),
  manejadorAsincrono(listarPermisosEfectivosUsuario),
);
rutasApi.get(
  "/inventario/stock",
  manejadorAsincrono(requerirSesion),
  requerirPermiso("VER_INVENTARIO"),
  manejadorAsincrono(consultarExistencias),
);
