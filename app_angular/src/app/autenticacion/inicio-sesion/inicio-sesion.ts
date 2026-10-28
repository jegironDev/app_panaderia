import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../api.service';

// Presenta mensajes seguros sin revelar si falló el usuario o la contraseña.
export function obtenerMensajeErrorInicioSesion(error: { status?: number } | null | undefined): string {
  if (error?.status === 401) return 'Usuario o contraseña incorrectos.';
  if (error?.status === 0 || (error?.status ?? 0) >= 500) {
    return 'No fue posible conectar con el servidor. Inténtalo nuevamente.';
  }
  return 'No fue posible iniciar sesión. Inténtalo nuevamente.';
}

@Component({
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './inicio-sesion.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioSesion {
  usuario = '';
  contrasena = '';
  error = '';
  procesando = false;

  constructor(private readonly api: ApiService, private readonly router: Router, private readonly cdr: ChangeDetectorRef) {}

  ingresar() {
    const usuario = this.usuario.trim();
    if (!usuario || !this.contrasena) {
      this.error = 'Ingresa tu usuario y contraseña.';
      this.cdr.markForCheck();
      return;
    }
    if (this.procesando) return;

    this.procesando = true;
    this.error = '';
    this.cdr.markForCheck();
    this.api.iniciarSesion({ usuario, contrasena: this.contrasena }).subscribe({
      next: (r) => {
        this.api.guardarSesion(r);
        this.procesando = false;
        this.cdr.markForCheck();
        this.router.navigateByUrl('/inicio');
      },
      error: (e) => {
        this.procesando = false;
        this.error = obtenerMensajeErrorInicioSesion(e);
        this.cdr.markForCheck();
      }
    });
  }
}
