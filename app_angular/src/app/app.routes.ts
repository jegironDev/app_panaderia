import { Routes } from '@angular/router';
import { InicioSesion } from './autenticacion/inicio-sesion/inicio-sesion';
import { Usuarios } from './gestion-usuarios/usuarios/usuarios';
import { CrearUsuario } from './gestion-usuarios/crear-usuario/crear-usuario';
import { EditarUsuario } from './gestion-usuarios/editar-usuario/editar-usuario';

export const routes: Routes = [
  { path: 'ingresar', component: InicioSesion },
  { path: 'usuarios', component: Usuarios },
  { path: 'usuarios/nuevo', component: CrearUsuario },
  { path: 'usuarios/:id/editar', component: EditarUsuario },
  { path: '', pathMatch: 'full', redirectTo: 'ingresar' },
];
