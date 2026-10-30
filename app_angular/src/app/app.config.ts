import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

// Cuando Express invalida una sesión, elimina el estado local antes de que una
// ruta privada pueda seguir mostrando información de la sesión anterior.
const invalidarSesion: HttpInterceptorFn = (solicitud, siguiente) => {
  const router = inject(Router);
  return siguiente(solicitud).pipe(catchError(error => {
    if (error?.status === 401 && !solicitud.url.endsWith('/acceso/iniciar-sesion')) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('permisos');
      sessionStorage.removeItem('identidad');
      router.navigate(['/ingresar']);
    }
    return throwError(() => error);
  }));
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes), provideClientHydration(), provideHttpClient(withInterceptors([invalidarSesion]))
  ]
};
