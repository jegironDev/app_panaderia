import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { InicioSesion } from './inicio-sesion';

function crearComponente(respuesta: any) {
  const api = { iniciarSesion: vi.fn(() => respuesta), guardarSesion: vi.fn() };
  const router = { navigateByUrl: vi.fn() };
  const detectorCambios = { markForCheck: vi.fn() };
  return { componente: new InicioSesion(api as any, router as any, detectorCambios as any), api, router, detectorCambios };
}

describe('InicioSesion', () => {
  it('valida usuario y contraseña antes de solicitar el acceso', () => {
    const { componente, api } = crearComponente(of({}));
    componente.ingresar();
    expect(componente.error).toBe('Ingresa tu usuario y contraseña.');
    expect(api.iniciarSesion).not.toHaveBeenCalled();
  });

  it('muestra credenciales inválidas después del primer intento', () => {
    const { componente } = crearComponente(throwError(() => ({ status: 401 })));
    componente.usuario = 'usuario';
    componente.contrasena = 'incorrecta';
    componente.ingresar();
    expect(componente.error).toBe('Usuario o contraseña incorrectos.');
    expect(componente.procesando).toBe(false);
  });

  it('muestra un mensaje seguro si no puede conectar con el servidor', () => {
    const { componente } = crearComponente(throwError(() => ({ status: 0 })));
    componente.usuario = 'usuario';
    componente.contrasena = 'clave';
    componente.ingresar();
    expect(componente.error).toBe('No fue posible conectar con el servidor. Inténtalo nuevamente.');
  });

  it('presenta el mismo mensaje seguro si Express no puede conectar con Oracle', () => {
    const { componente } = crearComponente(throwError(() => ({ status: 500 })));
    componente.usuario = 'usuario';
    componente.contrasena = 'clave';
    componente.ingresar();
    expect(componente.error).toBe('No fue posible conectar con el servidor. Inténtalo nuevamente.');
  });

  it('mantiene el botón bloqueado y evita solicitudes duplicadas mientras procesa', () => {
    const respuesta = new Subject<any>();
    const { componente, api } = crearComponente(respuesta);
    componente.usuario = 'usuario';
    componente.contrasena = 'clave';
    componente.ingresar();
    componente.ingresar();
    expect(componente.procesando).toBe(true);
    expect(api.iniciarSesion).toHaveBeenCalledTimes(1);
    respuesta.error({ status: 0 });
  });

  it('guarda la sesión y navega al inicio cuando el acceso es correcto', () => {
    const respuesta = { usuario: { permisos: [] } };
    const { componente, api, router } = crearComponente(of(respuesta));
    componente.usuario = ' usuario ';
    componente.contrasena = 'ClaveExacta';
    componente.ingresar();
    expect(api.iniciarSesion).toHaveBeenCalledWith({ usuario: 'usuario', contrasena: 'ClaveExacta' });
    expect(api.guardarSesion).toHaveBeenCalledWith(respuesta);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/inicio');
  });
});
