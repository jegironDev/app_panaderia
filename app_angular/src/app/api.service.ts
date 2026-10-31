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
  FECHA_BAJA?: string | null;
}

export interface CrearUsuarioRequest {
  contrasena: string;
  primerNombre: string;
  segundoNombre?: string | null;
  primerApellido: string;
  segundoApellido?: string | null;
  puesto?: string | null;
  identificadorPuesto?: number | null;
  tipo: TipoUsuario;
  identificadorSucursal?: number | null;
}

export interface EditarUsuarioRequest {
  primerNombre: string;
  segundoNombre?: string | null;
  primerApellido: string;
  segundoApellido?: string | null;
  puesto?: string | null;
  identificadorPuesto?: number | null;
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
export interface ProductoDetallado {
  ID_PRODUCTO: number;
  NOMBRE: string;
  TIPO: string;
  PRECIO: number;
  ID_UNIDAD_MEDIDA: number;
  NOMBRE_UNIDAD_MEDIDA: string;
  ABREVIATURA: string;
}
export interface ProductoAdministracion extends ProductoDetallado { ESTADO: string; }
type ProductoRespuestaOracle = Producto | [number, string, string, number];
export interface CrearPedidoRequest {
  identificadorJornada: number;
  observaciones?: string | null;
  detalles: Array<{ identificadorProducto: number; cantidad: number }>;
}
export interface SolicitudCancelacion { identificadorSolicitud: number; estado: string; motivo: string; }
export interface Puesto { ID_ROL: number; NOMBRE: string; DESCRIPCION: string | null; ESTADO: string; USUARIOS_ACTIVOS?: number; USUARIOS_ASIGNADOS?: number; PERMISOS?: Array<{ ID_PERMISO: number; CODIGO: string; DESCRIPCION: string }>; }
export interface ResumenDashboard { PENDIENTES: number; EN_PRODUCCION: number; LISTOS_DESPACHO: number; ENTREGADOS_MES: number; SEMANAL:Array<{NOMBRE:string;UNIDADES:number}>; MENSUAL:Array<{NOMBRE:string;UNIDADES:number}>; SUCURSAL_MAS:{NOMBRE:string;PEDIDOS:number}|null; SUCURSAL_MENOS:{NOMBRE:string;PEDIDOS:number}|null; }
export interface Abastecimiento { ID_DETALLE_INVENTARIO: number; FECHA: string; PRODUCTO: string; ABREVIATURA: string; RESPONSABLE: string; ORIGEN?:string; TIPO_MOVIMIENTO?:string; EXISTENCIA_ANTERIOR: number; EXISTENCIA_NUEVA: number; }
export interface Ruta { ID_RUTA: number; NOMBRE: string; DESCRIPCION: string | null; ESTADO: string; }
export interface Despacho { ID_DESPACHO: number; ID_PEDIDO: number; ID_RUTA: number | null; ID_USUARIO_PILOTO: number | null; ESTADO: string; RUTA: string | null; SUCURSAL: string; PILOTO: string | null; }
export interface EntregaRuta { ID_ENTREGA_RUTA:number; ID_PEDIDO:number; POSICION:number; ESTADO:string; ID_EJECUCION_RUTA:number; RUTA:string; SUCURSAL:string; }
export interface ExistenciaInventario { ID_PRODUCTO:number; NOMBRE:string; TIPO:string; ABREVIATURA:string; CANTIDAD:number; CANTIDAD_RESERVADA:number; DISPONIBLE:number; EXISTENCIA_MINIMA:number; }

export interface OpcionRecetaProduccion {
  ID_RECETA: number;
  NOMBRE: string;
  UNIDADES_PRODUCIDAS: number;
}
export interface DetallePlanificable {
  identificadorDetallePedido: number;
  identificadorProducto: number;
  producto: string;
  cantidadSolicitada: number;
  recetas: OpcionRecetaProduccion[];
}
export interface OpcionPlanificacionProduccion {
  identificadorPedido: number;
  posicionCola: number;
  detalles: DetallePlanificable[];
}
export interface IngredientePlanificacion {
  identificadorProducto: number;
  identificadorUnidadMedida: number;
  cantidadRequerida: number;
}
export interface ProduccionPlanificada {
  identificadorDetallePedido: number;
  identificadorReceta: number;
  producto: string;
  cantidadSolicitada: number;
  rendimiento: number;
  cantidadPlanificada: number;
  cantidadExcedente: number;
  ingredientes: IngredientePlanificacion[];
}
export interface PlanificacionProduccion {
  identificadorPedido: number;
  posicionCola: number;
  producciones: ProduccionPlanificada[];
  ingredientesRequeridos: Array<{ identificadorProducto: number; cantidadRequerida: number }>;
  disponibilidad: Array<{ identificadorProducto: number; cantidadRequerida: number; disponible: number; faltante: number }>;
  cobertura: Array<{ identificadorDetallePedido: number; producto: string; cantidadSolicitada: number; cantidadPlanificada: number; faltante: number }>;
}
export interface ProduccionResumen {
  ID_PRODUCCION: number;
  ID_PEDIDO: number | null;
  ID_RECETA: number;
  RECETA: string;
  ID_PRODUCTO: number;
  PRODUCTO: string;
  ESTADO: string;
  CANTIDAD_PLANIFICADA: number;
  CANTIDAD_PRODUCIDA: number;
  FECHA: string | null;
  FECHA_CONFIRMACION: string | null;
  SUCURSAL?: string | null;
  ESTADO_PEDIDO?: string | null;
}
export interface ProduccionDetalle extends ProduccionResumen {
  ORIGEN: string;
  RENDIMIENTO_RECETA_APLICADO: number | null;
  FECHA_CONGELACION: string | null;
  DETALLES: Array<{
    ID_DETALLE_PRODUCCION: number;
    ID_PRODUCTO: number;
    NOMBRE_PRODUCTO: string;
    ID_UNIDAD_MEDIDA: number;
    ABREVIATURA: string;
    CANTIDAD_REQUERIDA: number;
  }>;
}
export interface ProduccionesPedido {
  ID_PEDIDO: number;
  SUCURSAL: string;
  ESTADO_PEDIDO: string;
  PRODUCCIONES: Array<{
    ID_PRODUCCION: number;
    ID_RECETA: number;
    RECETA: string;
    PRODUCTO: string;
    ESTADO: string;
    CANTIDAD_PLANIFICADA: number;
    CANTIDAD_PRODUCIDA: number;
    CANTIDAD_DESTINADA_PEDIDO: number | null;
    CANTIDAD_EXCEDENTE: number | null;
    INGREDIENTES: Array<{ INGREDIENTE: string; CANTIDAD_REQUERIDA: number; ABREVIATURA: string }>;
  }>;
}

// Interfaces para recetas
export interface RecetaResumen {
  ID_RECETA: number;
  NOMBRE: string;
  ID_PRODUCTO: number;
  NOMBRE_PRODUCTO: string;
  UNIDADES_PRODUCIDAS: number;
  ESTADO: string;
  INGREDIENTES: number;
}

export interface RecetaDetalle {
  ID_RECETA: number;
  NOMBRE: string;
  ID_PRODUCTO: number;
  NOMBRE_PRODUCTO: string;
  UNIDADES_PRODUCIDAS: number;
  ESTADO: string;
  INGREDIENTES: IngredienteReceta[];
}

export interface IngredienteReceta {
  ID_DETALLE_RECETA: number;
  ID_PRODUCTO: number;
  NOMBRE_PRODUCTO: string;
  TIPO_PRODUCTO: string;
  ID_UNIDAD_MEDIDA: number;
  NOMBRE_UNIDAD_MEDIDA: string;
  ABREVIATURA: string;
  CANTIDAD: number;
}

export interface UnidadMedida {
  ID_UNIDAD_MEDIDA: number;
  NOMBRE: string;
  ABREVIATURA: string;
}

export interface CrearRecetaRequest {
  identificadorProducto: number;
  nombre: string;
  unidadesProducidas: number;
  ingredientes: IngredienteRequest[];
}

export interface EditarRecetaRequest {
  identificadorProducto: number;
  nombre: string;
  unidadesProducidas: number;
  ingredientes: IngredienteRequest[];
}

export interface IngredienteRequest {
  identificadorProducto: number;
  identificadorUnidadMedida: number;
  cantidad: number;
}

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
    case 409: return 'La operación entra en conflicto con el estado actual. Actualice la información e inténtelo nuevamente.';
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
      nombre: typeof datos.usuario?.nombre === 'string' ? datos.usuario.nombre.trim() : null,
      esPiloto: datos.usuario?.esPiloto === true,
    }));
  }
  limpiarSesion() { sessionStorage.removeItem('token'); sessionStorage.removeItem('permisos'); sessionStorage.removeItem('identidad'); }
  actualizarIdentidadSesion(usuario: any) {
    sessionStorage.setItem('permisos', JSON.stringify(Array.isArray(usuario?.permisos) ? usuario.permisos : []));
    sessionStorage.setItem('identidad', JSON.stringify({ identificadorUsuario: usuario?.identificadorUsuario, identificadorSucursal: usuario?.identificadorSucursal ?? null, nombre: usuario?.nombre || null, esPiloto: usuario?.esPiloto === true }));
  }
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
  obtenerNombreSesion(): string | null {
    try {
      const nombre = JSON.parse(sessionStorage.getItem('identidad') || '{}').nombre;
      return typeof nombre === 'string' && nombre.trim() ? nombre.trim() : null;
    } catch { return null; }
  }
  esPilotoSesion(): boolean { try { return JSON.parse(sessionStorage.getItem('identidad') || '{}').esPiloto === true; } catch { return false; } }
  iniciarSesion(datos: unknown) { return this.http.post<any>(`${this.baseUrl}/acceso/iniciar-sesion`, datos); }
  verificarSesion() { return this.http.get<{ usuario: any }>(`${this.baseUrl}/acceso/sesion`, this.encabezados()); }
  cerrarSesion() { return this.http.post(`${this.baseUrl}/acceso/cerrar-sesion`, null, this.encabezados()); }
  usuarios() { return this.http.get<Usuario[]>(`${this.baseUrl}/usuarios`, this.encabezados()); }
  usuarioPorId(id: number) { return this.http.get<Usuario>(`${this.baseUrl}/usuarios/${id}`, this.encabezados()); }
  crearUsuario(datos: CrearUsuarioRequest) { return this.http.post<Usuario>(`${this.baseUrl}/usuarios`, datos, this.encabezados()); }
  editarUsuario(id: number, datos: EditarUsuarioRequest) { return this.http.put<Usuario>(`${this.baseUrl}/usuarios/${id}`, datos, this.encabezados()); }
  cambiarEstadoUsuario(id: number, estado: 'A' | 'I') { return this.http.patch<Usuario>(`${this.baseUrl}/usuarios/${id}/estado`, { estado }, this.encabezados()); }
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
  productosDetallados() {
    return this.http.get<ProductoDetallado[]>(`${this.baseUrl}/productos?formato=detallado`, this.encabezados());
  }
  productosAdministracion(filtros: { nombre?: string; tipo?: string; estado?: string } = {}) { const parametros = new URLSearchParams(); Object.entries(filtros).forEach(([clave, valor]) => { if (valor) parametros.set(clave, valor); }); return this.http.get<ProductoAdministracion[]>(`${this.baseUrl}/productos/administracion?${parametros}`, this.encabezados()); }
  productoAdministracion(id: number) { return this.http.get<ProductoAdministracion>(`${this.baseUrl}/productos/administracion/${id}`, this.encabezados()); }
  crearProducto(datos: { nombre: string; tipo: string; identificadorUnidadMedida: number; precio: number }) { return this.http.post<ProductoAdministracion>(`${this.baseUrl}/productos`, datos, this.encabezados()); }
  editarProducto(id: number, datos: { nombre: string; tipo: string; identificadorUnidadMedida: number; precio: number }) { return this.http.put<ProductoAdministracion>(`${this.baseUrl}/productos/${id}`, datos, this.encabezados()); }
  cambiarEstadoProducto(id: number, estado: 'A' | 'I') { return this.http.patch<ProductoAdministracion>(`${this.baseUrl}/productos/${id}/estado`, { estado }, this.encabezados()); }
  productosTerminadosDetallados() {
    return this.http.get<ProductoDetallado[]>(`${this.baseUrl}/productos?tipo=PFI&formato=detallado`, this.encabezados());
  }
  crearPedido(datos: CrearPedidoRequest) { return this.http.post<DetallePedido>(`${this.baseUrl}/pedidos`, datos, this.encabezados()); }
  autorizarPedido(id: number) { return this.http.post<DetallePedido>(`${this.baseUrl}/pedidos/${id}/autorizar`, {}, this.encabezados()); }
  solicitarCancelacion(id: number, motivo: string) { return this.http.post<SolicitudCancelacion>(`${this.baseUrl}/pedidos/${id}/solicitudes-cancelacion`, { motivo }, this.encabezados()); }
  pedidosEnCola() { return this.http.get<PedidoResumen[]>(`${this.baseUrl}/pedidos/cola`, this.encabezados()); }
  opcionesPlanificacionProduccion(idPedido: number) { return this.http.get<OpcionPlanificacionProduccion>(`${this.baseUrl}/producciones/pedidos/${idPedido}/opciones-planificacion`, this.encabezados()); }
  planificarProduccion(datos: { identificadorPedido: number; recetas: Array<{ identificadorDetallePedido: number; identificadorReceta: number }> }) {
    return this.http.post<PlanificacionProduccion>(`${this.baseUrl}/producciones/planificar`, datos, this.encabezados());
  }
  autorizarProduccion(datos: { identificadorPedido: number; recetas: Array<{ identificadorDetallePedido: number; identificadorReceta: number }> }) {
    return this.http.post<{ identificadorPedido: number; estadoPedido: string; producciones: number[] }>(`${this.baseUrl}/producciones/autorizar`, datos, this.encabezados());
  }
  producciones(filtros?: { estado?: string; identificadorPedido?: number }) {
    const parametros = new URLSearchParams();
    if (filtros?.estado) parametros.set('estado', filtros.estado);
    if (filtros?.identificadorPedido) parametros.set('identificadorPedido', String(filtros.identificadorPedido));
    const consulta = parametros.toString();
    return this.http.get<ProduccionResumen[]>(`${this.baseUrl}/producciones${consulta ? `?${consulta}` : ''}`, this.encabezados());
  }
  produccionPorId(id: number) { return this.http.get<ProduccionDetalle>(`${this.baseUrl}/producciones/${id}`, this.encabezados()); }
  produccionesPorPedido(id: number) { return this.http.get<ProduccionesPedido>(`${this.baseUrl}/producciones/pedidos/${id}`, this.encabezados()); }
  iniciarProduccion(id: number) { return this.http.post<{ identificadorProduccion: number; estado: string }>(`${this.baseUrl}/producciones/${id}/iniciar`, {}, this.encabezados()); }
  finalizarProduccion(id: number) { return this.http.post<{ identificadorProduccion: number; estado: string; cantidadProducida: number }>(`${this.baseUrl}/producciones/${id}/finalizar`, {}, this.encabezados()); }
  recetas() { return this.http.get<RecetaResumen[]>(`${this.baseUrl}/recetas`, this.encabezados()); }
  recetaPorId(id: number) { return this.http.get<RecetaDetalle>(`${this.baseUrl}/recetas/${id}`, this.encabezados()); }
  crearReceta(datos: CrearRecetaRequest) { return this.http.post<RecetaDetalle>(`${this.baseUrl}/recetas`, datos, this.encabezados()); }
  editarReceta(id: number, datos: EditarRecetaRequest) { return this.http.put<RecetaDetalle>(`${this.baseUrl}/recetas/${id}`, datos, this.encabezados()); }
  cambiarEstadoReceta(id: number, estado: string) { return this.http.patch(`${this.baseUrl}/recetas/${id}/estado`, { estado }, this.encabezados()); }
  unidadesMedida() { return this.http.get<UnidadMedida[]>(`${this.baseUrl}/unidades-medida`, this.encabezados()); }
  dashboard(limiteSemanal=3,limiteMensual=3) { return this.http.get<ResumenDashboard>(`${this.baseUrl}/dashboard?limiteSemanal=${limiteSemanal}&limiteMensual=${limiteMensual}`, this.encabezados()); }
  puestos() { return this.http.get<Puesto[]>(`${this.baseUrl}/puestos?incluirInactivos=true`, this.encabezados()); }
  puestosAsignables() { return this.http.get<Puesto[]>(`${this.baseUrl}/puestos/asignables`, this.encabezados()); }
  permisos() { return this.http.get<Array<{ ID_PERMISO: number; CODIGO: string; DESCRIPCION: string }>>(`${this.baseUrl}/permisos`, this.encabezados()); }
  puestoPorId(id: number) { return this.http.get<Puesto>(`${this.baseUrl}/puestos/${id}`, this.encabezados()); }
  crearPuesto(datos: { nombre: string; descripcion?: string | null; identificadoresPermisos: number[] }) { return this.http.post<Puesto>(`${this.baseUrl}/puestos`, datos, this.encabezados()); }
  editarPuesto(id: number, datos: { nombre: string; descripcion?: string | null; identificadoresPermisos: number[] }) { return this.http.put<Puesto>(`${this.baseUrl}/puestos/${id}`, datos, this.encabezados()); }
  estadoPuesto(id: number, estado: string) { return this.http.patch<Puesto>(`${this.baseUrl}/puestos/${id}/estado`, { estado }, this.encabezados()); }
  abastecimientos() { return this.http.get<Abastecimiento[]>(`${this.baseUrl}/abastecimientos`, this.encabezados()); }
  registrarAbastecimiento(datos: { identificadorProducto: number; identificadorUnidadMedida?: number; cantidad: number }) { return this.http.post(`${this.baseUrl}/abastecimientos`, datos, this.encabezados()); }
  actualizarMinimoInventario(id:number, existenciaMinima:number) { return this.http.patch(`${this.baseUrl}/inventario/${id}/minimo`, { existenciaMinima }, this.encabezados()); }
  rutas(incluirInactivas = false) { return this.http.get<Ruta[]>(`${this.baseUrl}/rutas${incluirInactivas ? '?incluirInactivas=true' : ''}`, this.encabezados()); }
  crearRuta(datos: { nombre: string; descripcion?: string | null }) { return this.http.post(`${this.baseUrl}/rutas`, datos, this.encabezados()); }
  editarRuta(id: number, datos: { nombre: string; descripcion?: string | null }) { return this.http.put(`${this.baseUrl}/rutas/${id}`, datos, this.encabezados()); }
  cambiarEstadoRuta(id:number, estado:'A'|'I') { return this.http.patch(`${this.baseUrl}/rutas/${id}/estado`,{estado},this.encabezados()); }
  ejecucionRutaPorId(id:number) { return this.http.get<any>(`${this.baseUrl}/ejecuciones-ruta/${id}`,this.encabezados()); }
  despachos() { return this.http.get<Despacho[]>(`${this.baseUrl}/despachos`, this.encabezados()); }
  prepararDespachos(datos: { identificadoresPedidos: number[]; identificadorRuta: number; identificadorPiloto: number; observaciones?: string | null }) { return this.http.post(`${this.baseUrl}/despachos`, datos, this.encabezados()); }
  miRuta() { return this.http.get<Despacho[]>(`${this.baseUrl}/mi-ruta`, this.encabezados()); }
  confirmarEntrega(id: number) { return this.http.post(`${this.baseUrl}/despachos/${id}/entregar`, {}, this.encabezados()); }
  pedidosDisponiblesDespacho() { return this.http.get<Array<{ID_PEDIDO:number;SUCURSAL:string;FECHA_PEDIDO:string}>>(`${this.baseUrl}/despachos/pedidos-disponibles`,this.encabezados()); }
  pilotosDespacho() { return this.http.get<Array<{ID_USUARIO:number;USUARIO:string;PRIMER_NOMBRE:string;PRIMER_APELLIDO:string}>>(`${this.baseUrl}/despachos/pilotos`,this.encabezados()); }
  ejecucionesRuta() { return this.http.get<any[]>(`${this.baseUrl}/ejecuciones-ruta`,this.encabezados()); }
  crearEjecucionRuta(datos:{identificadorRuta:number;identificadorJornada:number;identificadorPiloto:number;identificadoresPedidos:number[];observaciones?:string}) { return this.http.post(`${this.baseUrl}/ejecuciones-ruta`,datos,this.encabezados()); }
  entregasPiloto() { return this.http.get<EntregaRuta[]>(`${this.baseUrl}/piloto/entregas`,this.encabezados()); }
  confirmarEntregaRuta(id:number) { return this.http.post(`${this.baseUrl}/piloto/entregas/${id}/confirmar`,{},this.encabezados()); }
  solicitarReordenamiento(id:number, posicionSolicitada:number, justificacion:string) { return this.http.post(`${this.baseUrl}/piloto/entregas/${id}/solicitudes-reordenamiento`,{posicionSolicitada,justificacion},this.encabezados()); }
  misReordenamientos() { return this.http.get<any[]>(`${this.baseUrl}/piloto/solicitudes-reordenamiento`,this.encabezados()); }
  reordenamientos() { return this.http.get<any[]>(`${this.baseUrl}/reordenamientos`,this.encabezados()); }
  resolverReordenamiento(id:number, decision:'AUTORIZAR'|'RECHAZAR', observacion?:string) { return this.http.post(`${this.baseUrl}/reordenamientos/${id}/resolver`,{decision,observacion},this.encabezados()); }
  bitacoras(filtros:{pagina:number;tamano:number;modulo?:string;usuario?:string;accion?:string;resultado?:string;desde?:string;hasta?:string}) { const p=new URLSearchParams();Object.entries(filtros).forEach(([k,v])=>{if(v!==undefined&&v!=='')p.set(k,String(v));});return this.http.get<any>(`${this.baseUrl}/bitacoras?${p}`,this.encabezados()); }
  fuentesBitacora() { return this.http.get<Array<{codigo:string;titulo:string;descripcion:string}>>(`${this.baseUrl}/bitacoras/fuentes`, this.encabezados()); }
  usuariosBitacora() { return this.http.get<Array<{ID_USUARIO:number;USUARIO:string}>>(`${this.baseUrl}/bitacoras/usuarios`, this.encabezados()); }
  bitacoraPorTipo(tipo:string,filtros:{pagina:number;tamano:number;usuario?:number;desde?:string;hasta?:string}) { const parametros=new URLSearchParams(); Object.entries(filtros).forEach(([clave,valor])=>{if(valor!==undefined&&valor!=='')parametros.set(clave,String(valor));}); return this.http.get<any>(`${this.baseUrl}/bitacoras/${encodeURIComponent(tipo)}?${parametros}`,this.encabezados()); }
  existenciasInventario() { return this.http.get<ExistenciaInventario[]>(`${this.baseUrl}/inventario/stock`, this.encabezados()); }
  cancelaciones() { return this.http.get<any[]>(`${this.baseUrl}/cancelaciones`, this.encabezados()); }
  resolverCancelacion(id: number, decision: string, observacion?: string) { return this.http.post(`${this.baseUrl}/cancelaciones/${id}/resolver`, { decision, observacion }, this.encabezados()); }
}
