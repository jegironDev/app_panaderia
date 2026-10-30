import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from '../../api.service';
import { catchError, map, of } from 'rxjs';

// La interfaz solo permite navegar cuando existe una sesión local; Express
// conserva la validación definitiva del token y de los permisos.
export const requerirSesion: CanActivateFn = () => {
  const api = inject(ApiService);
  const router = inject(Router);
  if (!sessionStorage.getItem('token')) return router.createUrlTree(['/ingresar']);
  return api.verificarSesion().pipe(
    map(resultado => { api.actualizarIdentidadSesion(resultado.usuario); return true; }),
    catchError(() => { api.limpiarSesion(); return of(router.createUrlTree(['/ingresar'])); }),
  );
};

export const requerirPermiso: CanActivateFn = (ruta) => {
  const api = inject(ApiService);
  const router = inject(Router);
  const permisos = ruta.data?.['permisos'] as string[] | undefined;

  if (!sessionStorage.getItem('token')) return router.createUrlTree(['/ingresar']);
  return api.verificarSesion().pipe(
    map(resultado => {
      api.actualizarIdentidadSesion(resultado.usuario);
      return !permisos?.length || api.tieneAlgunPermiso(permisos) ? true : router.createUrlTree(['/inicio']);
    }),
    catchError(() => { api.limpiarSesion(); return of(router.createUrlTree(['/ingresar'])); }),
  );
};
