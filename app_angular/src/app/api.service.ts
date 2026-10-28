import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map } from 'rxjs';

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
  TOTAL: number;
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
  PRECIO_UNITARIO: number;
  SUBTOTAL: number;
  CANTIDAD: number;
}

export interface Jornada { ID_JORNADA: number; NOMBRE: string; }
export interface EstadoPedido { ID_ESTADO_PEDIDO: number; NOMBRE: string; DESCRIPCION?: string | null; }
export interface Producto { ID_PRODUCTO: number; NOMBRE: string; TIPO: string; PRECIO: number; }
type ProductoRespuestaOracle = Producto | [number, string, string, number];
export interface CrearPedidoRequest {
  identificadorJornada: number;
  observaciones?: string | null;
  detalles: Array<{ identificadorProducto: number; cantidad: number }>;
}
export interface SolicitudCancelacion { identificadorSolicitud: number; estado: string; motivo: string; }

// El cursor Oracle de productos devuelve arreglos en el orden definido por PKG_CONSULTAS.
export function convertirProductoRespuesta(fila: ProductoRespuestaOracle): Producto {
  if (Array.isArray(fila)) {
    const [ID_PRODUCTO, NOMBRE, TIPO, PRECIO] = fila;
    return { ID_PRODUCTO, NOMBRE, TIPO, PRECIO };
  }
  return fila;
}

// Evita exponer mensajes técnicos; usa información segura basada en el código HTTP.
export function obtenerMensajeErrorHttp(error: any, alternativa: string): string {
  switch (error?.status) {
    case 400: return 'Revise los datos ingresados e inténtelo nuevamente.';
    case 401: return 'La sesión ya no es válida. Ingrese nuevamente.';
    case 403: return 'No tiene permiso para realizar esta operación.';
    case 404: return 'No se encontró el recurso solicitado o no tiene acceso a él.';
    case 409: return 'La operación entra en conflicto con el estado actual del pedido.';
    default: return alternativa;
  }
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = '/api';
  constructor(private readonly http: HttpClient) {}
  private encabezados() { return { headers: new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem('token') || ''}` }) }; }
  guardarSesion(datos: any) {
    sessionStorage.setItem('token', datos.token);
    sessionStorage.setItem('permisos', JSON.stringify(Array.isArray(datos.usuario?.permisos) ? datos.usuario.permisos : []));
    // La identidad se conserva solo para presentar acciones; Express sigue validando todo.
    sessionStorage.setItem('identidad', JSON.stringify({
      identificadorUsuario: datos.usuario?.identificadorUsuario,
      identificadorSucursal: datos.usuario?.identificadorSucursal ?? null,
    }));
  }
  limpiarSesion() { sessionStorage.removeItem('token'); sessionStorage.removeItem('permisos'); sessionStorage.removeItem('identidad'); }
  tieneAlgunPermiso(permisos: string[]): boolean {
    try {
      const actuales = JSON.parse(sessionStorage.getItem('permisos') || '[]');
      return Array.isArray(actuales) && permisos.some(permiso => actuales.includes(permiso));
    } catch { return false; }
  }
  tienePermiso(permiso: string): boolean { return this.tieneAlgunPermiso([permiso]); }
  obtenerIdentificadorSucursalSesion(): number | null {
    try {
      const identificador = Number(JSON.parse(sessionStorage.getItem('identidad') || '{}').identificadorSucursal);
      return Number.isInteger(identificador) && identificador > 0 ? identificador : null;
    } catch { return null; }
  }
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
  productos() {
    return this.http.get<ProductoRespuestaOracle[]>(`${this.baseUrl}/productos`, this.encabezados())
      .pipe(map(productos => productos.map(convertirProductoRespuesta)));
  }
  productosTerminados() {
    return this.http.get<Producto[]>(`${this.baseUrl}/productos?tipo=PFI`, this.encabezados());
  }
  crearPedido(datos: CrearPedidoRequest) { return this.http.post<DetallePedido>(`${this.baseUrl}/pedidos`, datos, this.encabezados()); }
  autorizarPedido(id: number) { return this.http.post<DetallePedido>(`${this.baseUrl}/pedidos/${id}/autorizar`, {}, this.encabezados()); }
  solicitarCancelacion(id: number, motivo: string) { return this.http.post<SolicitudCancelacion>(`${this.baseUrl}/pedidos/${id}/solicitudes-cancelacion`, { motivo }, this.encabezados()); }
}
