import { Routes } from '@angular/router';
import { InicioSesion } from './autenticacion/inicio-sesion/inicio-sesion';
import { Usuarios } from './gestion-usuarios/usuarios/usuarios';
import { CrearUsuario } from './gestion-usuarios/crear-usuario/crear-usuario';
import { EditarUsuario } from './gestion-usuarios/editar-usuario/editar-usuario';
import { Pedidos } from './gestion-pedidos/pedidos/pedidos';
import { CrearPedido } from './gestion-pedidos/crear-pedido/crear-pedido';
import { DetallePedido } from './gestion-pedidos/detalle-pedido/detalle-pedido';

export const routes: Routes = [
  { path: 'ingresar', component: InicioSesion },
  { path: 'usuarios', component: Usuarios },
  { path: 'usuarios/nuevo', component: CrearUsuario },
  { path: 'usuarios/:id/editar', component: EditarUsuario },
  { path: 'pedidos', component: Pedidos },
  { path: 'pedidos/nuevo', component: CrearPedido },
  { path: 'pedidos/:id', component: DetallePedido },
  { path: '', pathMatch: 'full', redirectTo: 'ingresar' },
];
