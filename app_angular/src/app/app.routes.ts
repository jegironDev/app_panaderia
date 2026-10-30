import { Routes } from '@angular/router';
import { InicioSesion } from './autenticacion/inicio-sesion/inicio-sesion';
import { Usuarios } from './gestion-usuarios/usuarios/usuarios';
import { CrearUsuario } from './gestion-usuarios/crear-usuario/crear-usuario';
import { EditarUsuario } from './gestion-usuarios/editar-usuario/editar-usuario';
import { Pedidos } from './gestion-pedidos/pedidos/pedidos';
import { CrearPedido } from './gestion-pedidos/crear-pedido/crear-pedido';
import { DetallePedido } from './gestion-pedidos/detalle-pedido/detalle-pedido';
import { Inicio } from './inicio/inicio';
import { Recetas } from './gestion-recetas/recetas/recetas';
import { DetalleReceta } from './gestion-recetas/detalle-receta/detalle-receta';
import { CrearReceta } from './gestion-recetas/crear-receta/crear-receta';
import { EditarReceta } from './gestion-recetas/editar-receta/editar-receta';
import { Producciones } from './gestion-produccion/producciones/producciones';
import { PlanificarProduccion } from './gestion-produccion/planificar-produccion/planificar-produccion';
import { DetalleProduccion } from './gestion-produccion/detalle-produccion/detalle-produccion';
import { PortalProduccion } from './gestion-produccion/portal-produccion/portal-produccion';
import { ProduccionesPedido } from './gestion-produccion/producciones-pedido/producciones-pedido';
import { Puestos } from './gestion-puestos/puestos/puestos';
import { Abastecimientos } from './operaciones/abastecimientos/abastecimientos';
import { Despachos } from './operaciones/despachos/despachos';
import { MiRuta } from './operaciones/mi-ruta/mi-ruta';
import { Rutas } from './operaciones/rutas/rutas';
import { DetalleEjecucion } from './operaciones/detalle-ejecucion/detalle-ejecucion';
import { Reordenamientos } from './operaciones/reordenamientos/reordenamientos';
import { Cancelaciones } from './operaciones/cancelaciones/cancelaciones';
import { Bitacoras } from './operaciones/bitacoras/bitacoras';
import { GestionInventario } from './operaciones/gestion-inventario/gestion-inventario';
import { Productos } from './gestion-productos/productos/productos';
import { requerirPermiso, requerirSesion } from './compartidos/seguridad/guardias-rutas';

export const routes: Routes = [
  { path: 'ingresar', component: InicioSesion },
  { path: 'inicio', component: Inicio, canActivate: [requerirSesion] },
  { path: 'usuarios', component: Usuarios, canActivate: [requerirPermiso], data: { permisos: ['VER_USUARIOS'] } },
  { path: 'usuarios/nuevo', component: CrearUsuario, canActivate: [requerirPermiso], data: { permisos: ['CREAR_USUARIOS'] } },
  { path: 'usuarios/:id/editar', component: EditarUsuario, canActivate: [requerirPermiso], data: { permisos: ['EDITAR_USUARIOS'] } },
  { path: 'puestos', component: Puestos, canActivate: [requerirPermiso], data: { permisos: ['GESTIONAR_PUESTOS'] } },
  { path: 'productos', component: Productos, canActivate: [requerirPermiso], data: { permisos: ['GESTIONAR_PRODUCTOS'] } },
  { path: 'abastecimientos', component: Abastecimientos, canActivate: [requerirPermiso], data: { permisos: ['VER_INVENTARIO', 'REGISTRAR_ENTRADA_INVENTARIO'] } },
  { path: 'gestion-inventario', component: GestionInventario, canActivate: [requerirPermiso], data: { permisos: ['VER_INVENTARIO'] } },
  { path: 'despachos', component: Despachos, canActivate: [requerirPermiso], data: { permisos: ['PREPARAR_DESPACHOS'] } },
  { path: 'despachos/ejecuciones/:id', component: DetalleEjecucion, canActivate: [requerirPermiso], data: { permisos: ['PREPARAR_DESPACHOS'] } },
  { path: 'despachos/reordenamientos', component: Reordenamientos, canActivate: [requerirPermiso], data: { permisos: ['RESOLVER_REORDENAMIENTOS'] } },
  { path: 'cancelaciones', component: Cancelaciones, canActivate: [requerirPermiso], data: { permisos: ['RESOLVER_CANCELACIONES_PEDIDOS'] } },
  { path: 'bitacoras', component: Bitacoras, canActivate: [requerirPermiso], data: { permisos: ['VER_REPORTES'] } },
  { path: 'rutas', component: Rutas, canActivate: [requerirPermiso], data: { permisos: ['GESTIONAR_RUTAS'] } },
  { path: 'mi-ruta', component: MiRuta, canActivate: [requerirPermiso], data: { permisos: ['CONSULTAR_MI_RUTA'] } },
  { path: 'pedidos', component: Pedidos, canActivate: [requerirPermiso], data: { permisos: ['CREAR_PEDIDOS', 'SOLICITAR_CANCELACION_PEDIDOS', 'AUTORIZAR_PEDIDOS'] } },
  { path: 'pedidos/nuevo', component: CrearPedido, canActivate: [requerirPermiso], data: { permisos: ['CREAR_PEDIDOS'] } },
  { path: 'pedidos/:id', component: DetallePedido, canActivate: [requerirPermiso], data: { permisos: ['CREAR_PEDIDOS', 'SOLICITAR_CANCELACION_PEDIDOS', 'AUTORIZAR_PEDIDOS'] } },
  { path: 'recetas', component: Recetas, canActivate: [requerirPermiso], data: { permisos: ['GESTIONAR_RECETAS', 'AUTORIZAR_PEDIDOS'] } },
  { path: 'recetas/nueva', component: CrearReceta, canActivate: [requerirPermiso], data: { permisos: ['GESTIONAR_RECETAS'] } },
  { path: 'recetas/:id', component: DetalleReceta, canActivate: [requerirPermiso], data: { permisos: ['GESTIONAR_RECETAS', 'AUTORIZAR_PEDIDOS'] } },
  { path: 'recetas/:id/editar', component: EditarReceta, canActivate: [requerirPermiso], data: { permisos: ['GESTIONAR_RECETAS'] } },
  { path: 'gestion-produccion', component: PortalProduccion, canActivate: [requerirPermiso], data: { permisos: ['AUTORIZAR_PRODUCCION', 'INICIAR_PRODUCCION', 'CONFIRMAR_PRODUCCION'] } },
  { path: 'producciones', pathMatch: 'full', redirectTo: 'gestion-produccion' },
  { path: 'producciones/listado', component: Producciones, canActivate: [requerirPermiso], data: { permisos: ['AUTORIZAR_PRODUCCION', 'INICIAR_PRODUCCION', 'CONFIRMAR_PRODUCCION'] } },
  { path: 'producciones/planificar', component: PlanificarProduccion, canActivate: [requerirPermiso], data: { permisos: ['AUTORIZAR_PRODUCCION'] } },
  { path: 'producciones/pedidos/:id', component: ProduccionesPedido, canActivate: [requerirPermiso], data: { permisos: ['AUTORIZAR_PRODUCCION', 'INICIAR_PRODUCCION', 'CONFIRMAR_PRODUCCION'] } },
  { path: 'detalle-produccion/:id', component: DetalleProduccion, canActivate: [requerirPermiso], data: { permisos: ['AUTORIZAR_PRODUCCION', 'INICIAR_PRODUCCION', 'CONFIRMAR_PRODUCCION'] } },
  { path: '', pathMatch: 'full', redirectTo: 'ingresar' },
];
