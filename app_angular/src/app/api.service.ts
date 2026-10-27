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

export interface PedidoResumen {
  ID_PEDIDO: number;
  ID_SUCURSAL: number;
  SUCURSAL: string;
  ID_JORNADA: number;
  JORNADA: string;
  ID_ESTADO_PEDIDO: number;
  ESTADO: string;
  FECHA_PEDIDO: string;
  FECHA_DESPACHO: string | null;
  OBSERVACIONES: string | null;
  LINEAS: number;
  UNIDADES_PEDIDAS: number;
}

export interface DetallePedido extends PedidoResumen {
  ID_USUARIO: number;
  ID_RUTA: number | null;
  DETALLES: ProductoPedido[];
}

export interface ProductoPedido {
  ID_DETALLE_PEDIDO: number;
  ID_PRODUCTO: number;
  NOMBRE_PRODUCTO: string;
  TIPO_PRODUCTO: string;
  PRECIO: number;
  CANTIDAD: number;
}

export interface Jornada { ID_JORNADA: number; NOMBRE: string; }
export interface EstadoPedido { ID_ESTADO_PEDIDO: number; NOMBRE: string; DESCRIPCION?: string | null; }
export interface Producto { ID_PRODUCTO: number; NOMBRE: string; TIPO: string; PRECIO: number; }
export interface CrearPedidoRequest {
  identificadorJornada: number;
  observaciones?: string | null;
  detalles: Array<{ identificadorProducto: number; cantidad: number }>;
}
export interface SolicitudCancelacion { identificadorSolicitud: number; estado: string; motivo: string; }

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
  pedidos() { return this.http.get<PedidoResumen[]>(`${this.baseUrl}/pedidos`, this.encabezados()); }
  pedidoPorId(id: number) { return this.http.get<DetallePedido>(`${this.baseUrl}/pedidos/${id}`, this.encabezados()); }
  jornadasPedido() { return this.http.get<Jornada[]>(`${this.baseUrl}/pedidos/jornadas`, this.encabezados()); }
  estadosPedido() { return this.http.get<EstadoPedido[]>(`${this.baseUrl}/pedidos/estados`, this.encabezados()); }
  productos() { return this.http.get<Producto[]>(`${this.baseUrl}/productos`, this.encabezados()); }
  crearPedido(datos: CrearPedidoRequest) { return this.http.post<DetallePedido>(`${this.baseUrl}/pedidos`, datos, this.encabezados()); }
  autorizarPedido(id: number) { return this.http.post<DetallePedido>(`${this.baseUrl}/pedidos/${id}/autorizar`, {}, this.encabezados()); }
  solicitarCancelacion(id: number, motivo: string) { return this.http.post<SolicitudCancelacion>(`${this.baseUrl}/pedidos/${id}/solicitudes-cancelacion`, { motivo }, this.encabezados()); }
}
