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

export const routes: Routes = [
  { path: 'ingresar', component: InicioSesion },
  { path: 'inicio', component: Inicio },
  { path: 'usuarios', component: Usuarios },
  { path: 'usuarios/nuevo', component: CrearUsuario },
  { path: 'usuarios/:id/editar', component: EditarUsuario },
  { path: 'pedidos', component: Pedidos },
  { path: 'pedidos/nuevo', component: CrearPedido },
  { path: 'pedidos/:id', component: DetallePedido },
  { path: 'recetas', component: Recetas },
  { path: 'recetas/nueva', component: CrearReceta },
  { path: 'recetas/:id', component: DetalleReceta },
  { path: 'recetas/:id/editar', component: EditarReceta },
  { path: '', pathMatch: 'full', redirectTo: 'ingresar' },
];
