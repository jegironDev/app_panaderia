import { Routes } from '@angular/router';
import { InicioSesionComponent } from './inicio-sesion.component';
import { UsuariosComponent } from './usuarios.component';

export const routes: Routes = [
  { path: 'ingresar', component: InicioSesionComponent },
  { path: 'usuarios', component: UsuariosComponent },
  { path: 'usuarios/nuevo', component: UsuariosComponent },
  { path: 'usuarios/:id/editar', component: UsuariosComponent },
  { path: '', pathMatch: 'full', redirectTo: 'ingresar' },
];
