import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

// Interfaces para tipado de datos de usuarios
export interface Sucursal {
  ID_SUCURSAL: number;
  NOMBRE: string;
}

export type TipoUsuario = 'ADMIN' | 'OPERATIVO' | 'ESTANDAR';

export interface Usuario {
  ID_USUARIO: number;
  USUARIO: string;
  PRIMER_NOMBRE: string;
  SEGUNDO_NOMBRE: string | null;
  PRIMER_APELLIDO: string;
  SEGUNDO_APELLIDO: string | null;
  PUESTO: string | null;
  TIPO: TipoUsuario;
  ESTADO: string;
  ID_SUCURSAL: number | null;
}

export interface CrearUsuarioRequest {
  contrasena: string;
  primerNombre: string;
  segundoNombre?: string | null;
  primerApellido: string;
  segundoApellido?: string | null;
  puesto?: string | null;
  tipo: TipoUsuario;
  identificadorSucursal?: number | null;
}

export interface EditarUsuarioRequest {
  primerNombre: string;
  segundoNombre?: string | null;
  primerApellido: string;
  segundoApellido?: string | null;
  puesto?: string | null;
  tipo: TipoUsuario;
  identificadorSucursal?: number | null;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = '/api';
  constructor(private readonly http: HttpClient) {}
  private encabezados() { return { headers: new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` }) }; }
  iniciarSesion(datos: unknown) { return this.http.post<any>(`${this.baseUrl}/acceso/iniciar-sesion`, datos); }
  cerrarSesion() { return this.http.post(`${this.baseUrl}/acceso/cerrar-sesion`, null, this.encabezados()); }
  usuarios() { return this.http.get<Usuario[]>(`${this.baseUrl}/usuarios`, this.encabezados()); }
  usuarioPorId(id: number) { return this.http.get<Usuario>(`${this.baseUrl}/usuarios/${id}`, this.encabezados()); }
  crearUsuario(datos: CrearUsuarioRequest) { return this.http.post<Usuario>(`${this.baseUrl}/usuarios`, datos, this.encabezados()); }
  editarUsuario(id: number, datos: EditarUsuarioRequest) { return this.http.put<Usuario>(`${this.baseUrl}/usuarios/${id}`, datos, this.encabezados()); }
  sucursales() { return this.http.get<Sucursal[]>(`${this.baseUrl}/sucursales`, this.encabezados()); }
}
