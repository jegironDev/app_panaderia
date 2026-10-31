import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';

const formato = { outFormat: oracledb.OUT_FORMAT_OBJECT };
const crearError = (mensaje, codigoEstado = 400) => Object.assign(new Error(mensaje), { codigoEstado, mensajeCliente: mensaje });

export async function listarProductosAdministracion(filtros = {}) {
  const conexion = await obtenerConexion();
  try {
    const condiciones = ['1=1']; const binds = {};
    if (filtros.nombre) { condiciones.push('UPPER(p.NOMBRE) LIKE UPPER(:nombre)'); binds.nombre = `%${String(filtros.nombre).trim()}%`; }
    if (filtros.tipo) { if (!['PFI', 'MAT', 'INS'].includes(String(filtros.tipo).toUpperCase())) throw crearError('El tipo de producto no es válido.'); condiciones.push('p.TIPO=:tipo'); binds.tipo = String(filtros.tipo).toUpperCase(); }
    if (filtros.estado) { if (!['A', 'I'].includes(String(filtros.estado).toUpperCase())) throw crearError('El estado no es válido.'); condiciones.push('p.ESTADO=:estado'); binds.estado = String(filtros.estado).toUpperCase(); }
    const resultado = await conexion.execute(`SELECT p.ID_PRODUCTO,p.NOMBRE,p.TIPO,p.ID_UNIDAD_MEDIDA,um.NOMBRE NOMBRE_UNIDAD_MEDIDA,um.ABREVIATURA,p.PRECIO,p.ESTADO
      FROM PRODUCTO p JOIN UNIDAD_MEDIDA um ON um.ID_UNIDAD_MEDIDA=p.ID_UNIDAD_MEDIDA
      WHERE ${condiciones.join(' AND ')} ORDER BY p.ESTADO DESC,p.NOMBRE,p.ID_PRODUCTO`, binds, formato);
    return resultado.rows;
  } finally { await conexion.close(); }
}

export async function consultarProductoAdministracion(identificadorProducto) {
  const filas = await consultarProductoConConexion(await obtenerConexion(), identificadorProducto, true);
  return filas;
}

export async function crearProducto(datos) {
  const producto = validarProducto(datos);
  const conexion = await obtenerConexion();
  try {
    await validarUnidad(conexion, producto.identificadorUnidadMedida);
    await validarDuplicado(conexion, producto);
    const resultado = await conexion.execute(`INSERT INTO PRODUCTO (ID_UNIDAD_MEDIDA,NOMBRE,TIPO,PRECIO,ESTADO)
      VALUES (:identificadorUnidadMedida,:nombre,:tipo,:precio,'A') RETURNING ID_PRODUCTO INTO :salida`, { ...producto, salida: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } });
    await conexion.commit();
    return await consultarProductoConConexion(conexion, resultado.outBinds.salida[0]);
  } catch (error) { await conexion.rollback(); throw error; } finally { await conexion.close(); }
}

export async function editarProducto(identificadorProducto, datos) {
  const producto = validarProducto(datos);
  const conexion = await obtenerConexion();
  try {
    const actual = await consultarProductoConConexion(conexion, identificadorProducto, false, true);
    if (!actual) throw crearError('Producto no encontrado.', 404);
    await validarUnidad(conexion, producto.identificadorUnidadMedida);
    await validarDuplicado(conexion, producto, identificadorProducto);
    if ((Number(actual.ID_UNIDAD_MEDIDA) !== producto.identificadorUnidadMedida || actual.TIPO !== producto.tipo) && await tieneDependencias(conexion, identificadorProducto)) {
      throw crearError('No puede cambiar el tipo o la unidad de un producto con recetas, inventario o movimientos relacionados.', 409);
    }
    await conexion.execute(`UPDATE PRODUCTO SET ID_UNIDAD_MEDIDA=:identificadorUnidadMedida,NOMBRE=:nombre,TIPO=:tipo,PRECIO=:precio WHERE ID_PRODUCTO=:identificadorProducto`, { ...producto, identificadorProducto });
    await conexion.commit(); return await consultarProductoConConexion(conexion, identificadorProducto);
  } catch (error) { await conexion.rollback(); throw error; } finally { await conexion.close(); }
}

export async function cambiarEstadoProducto(identificadorProducto, estado) {
  if (!['A', 'I'].includes(estado)) throw crearError('El estado no es válido.');
  const conexion = await obtenerConexion();
  try {
    const actual = await consultarProductoConConexion(conexion, identificadorProducto, false, true);
    if (!actual) throw crearError('Producto no encontrado.', 404);
    if (estado === 'I') await validarDesactivacionProducto(conexion, identificadorProducto);
    await conexion.execute('UPDATE PRODUCTO SET ESTADO=:estado WHERE ID_PRODUCTO=:identificadorProducto', { estado, identificadorProducto });
    if (estado === 'I') {
      await conexion.execute(`UPDATE RECETA SET ESTADO='I' WHERE ID_PRODUCTO=:identificadorProducto AND ESTADO='A'`, { identificadorProducto });
    }
    await conexion.commit(); return await consultarProductoConConexion(conexion, identificadorProducto);
  } catch (error) { await conexion.rollback(); throw error; } finally { await conexion.close(); }
}

async function consultarProductoConConexion(conexion, identificadorProducto, cerrar = false, bloquear = false) {
  try { const resultado = await conexion.execute(`SELECT p.ID_PRODUCTO,p.NOMBRE,p.TIPO,p.ID_UNIDAD_MEDIDA,um.NOMBRE NOMBRE_UNIDAD_MEDIDA,um.ABREVIATURA,p.PRECIO,p.ESTADO FROM PRODUCTO p JOIN UNIDAD_MEDIDA um ON um.ID_UNIDAD_MEDIDA=p.ID_UNIDAD_MEDIDA WHERE p.ID_PRODUCTO=:identificadorProducto${bloquear ? ' FOR UPDATE' : ''}`, { identificadorProducto }, formato); return resultado.rows[0] || null; } finally { if (cerrar) await conexion.close(); }
}
export function validarProducto(datos) {
  const nombre = typeof datos?.nombre === 'string' ? datos.nombre.trim() : '';
  const tipo = String(datos?.tipo || '').trim().toUpperCase(); const identificadorUnidadMedida = Number(datos?.identificadorUnidadMedida); const precio = Number(datos?.precio);
  if (!nombre || nombre.length > 100) throw crearError('El nombre del producto es obligatorio y debe tener hasta 100 caracteres.');
  if (!['PFI', 'MAT', 'INS'].includes(tipo)) throw crearError('El tipo de producto no es válido.');
  if (!Number.isInteger(identificadorUnidadMedida) || identificadorUnidadMedida <= 0) throw crearError('La unidad de medida no es válida.');
  if (!Number.isFinite(precio) || precio < 0 || (tipo === 'PFI' && precio <= 0)) throw crearError(tipo === 'PFI' ? 'Los productos terminados requieren un precio de venta mayor que cero.' : 'El precio no es válido.');
  return { nombre, tipo, identificadorUnidadMedida, precio };
}
async function validarUnidad(conexion, identificadorUnidadMedida) { const r = await conexion.execute(`SELECT 1 FROM UNIDAD_MEDIDA WHERE ID_UNIDAD_MEDIDA=:identificadorUnidadMedida AND ESTADO='A'`, { identificadorUnidadMedida }, formato); if (!r.rows.length) throw crearError('La unidad de medida no existe o está inactiva.', 404); }
async function validarDuplicado(conexion, producto, excluir = null) { const binds = { nombre: producto.nombre, tipo: producto.tipo, identificadorUnidadMedida: producto.identificadorUnidadMedida, ...(excluir ? { excluir } : {}) }; const r = await conexion.execute(`SELECT 1 FROM PRODUCTO WHERE UPPER(NOMBRE)=UPPER(:nombre) AND TIPO=:tipo AND ID_UNIDAD_MEDIDA=:identificadorUnidadMedida ${excluir ? 'AND ID_PRODUCTO<>:excluir' : ''}`, binds, formato); if (r.rows.length) throw crearError('Ya existe un producto con el mismo nombre, tipo y unidad de medida.', 409); }
async function tieneDependencias(conexion, identificadorProducto) { const r = await conexion.execute(`SELECT (SELECT COUNT(*) FROM INVENTARIO WHERE ID_PRODUCTO=:id) + (SELECT COUNT(*) FROM DETALLE_RECETA WHERE ID_PRODUCTO=:id) + (SELECT COUNT(*) FROM RECETA WHERE ID_PRODUCTO=:id) + (SELECT COUNT(*) FROM DETALLE_PEDIDO WHERE ID_PRODUCTO=:id) CANTIDAD FROM DUAL`, { id: identificadorProducto }, formato); return Number(r.rows[0].CANTIDAD) > 0; }
export async function validarDesactivacionProducto(conexion, identificadorProducto) {
  const inventarios = await conexion.execute(`SELECT ID_INVENTARIO,CANTIDAD,CANTIDAD_RESERVADA FROM INVENTARIO WHERE ID_PRODUCTO=:id FOR UPDATE`, { id: identificadorProducto }, formato);
  if (inventarios.rows.some(inventario => Number(inventario.CANTIDAD) !== 0 || Number(inventario.CANTIDAD_RESERVADA) !== 0)) {
    throw crearError('No puede desactivar un producto con existencia física o reservada.', 409);
  }
  const producciones = await conexion.execute(`SELECT 1 FROM PRODUCCION pr
    LEFT JOIN RECETA r ON r.ID_RECETA=pr.ID_RECETA
    LEFT JOIN DETALLE_PRODUCCION dp ON dp.ID_PRODUCCION=pr.ID_PRODUCCION
    WHERE pr.ESTADO IN ('PLANIFICADA','AUTORIZADA','EN_PRODUCCION')
      AND (r.ID_PRODUCTO=:id OR dp.ID_PRODUCTO=:id) FETCH FIRST 1 ROW ONLY`, { id: identificadorProducto }, formato);
  if (producciones.rows.length) throw crearError('No puede desactivar un producto vinculado a una producción activa.', 409);
  const recetasComoIngrediente = await conexion.execute(`SELECT 1 FROM DETALLE_RECETA dr JOIN RECETA r ON r.ID_RECETA=dr.ID_RECETA
    WHERE dr.ID_PRODUCTO=:id AND r.ESTADO='A' FETCH FIRST 1 ROW ONLY`, { id: identificadorProducto }, formato);
  if (recetasComoIngrediente.rows.length) throw crearError('No puede desactivar un ingrediente usado por una receta activa.', 409);
  const pedidos = await conexion.execute(`SELECT 1 FROM DETALLE_PEDIDO dp JOIN PEDIDO p ON p.ID_PEDIDO=dp.ID_PEDIDO
    JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO=p.ID_ESTADO_PEDIDO
    WHERE dp.ID_PRODUCTO=:id AND e.NOMBRE NOT IN ('ENTREGADO','CANCELADO') FETCH FIRST 1 ROW ONLY`, { id: identificadorProducto }, formato);
  if (pedidos.rows.length) throw crearError('No puede desactivar un producto con pedidos operativos pendientes.', 409);
}
