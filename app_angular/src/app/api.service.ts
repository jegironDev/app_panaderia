import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = '/api';
  constructor(private readonly http: HttpClient) {}
  private encabezados() { return { headers: new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` }) }; }
  iniciarSesion(datos: unknown) { return this.http.post<any>(`${this.baseUrl}/acceso/iniciar-sesion`, datos); }
  usuarios() { return this.http.get<any[]>(`${this.baseUrl}/usuarios`, this.encabezados()); }
}
