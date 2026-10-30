import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';
import { obtenerFiltroSucursal } from './aislamiento-sucursales-servicio.js';

const formato = { outFormat: oracledb.OUT_FORMAT_OBJECT };

export async function listarAbastecimientos(filtros = {}) {
  const conexion = await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      `SELECT di.ID_DETALLE_INVENTARIO, di.FECHA, di.ORIGEN, di.EXISTENCIA_ANTERIOR, di.EXISTENCIA_NUEVA,
              p.ID_PRODUCTO, p.NOMBRE AS PRODUCTO, um.ABREVIATURA, u.USUARIO AS RESPONSABLE
         FROM DETALLE_INVENTARIO di JOIN INVENTARIO i ON i.ID_INVENTARIO = di.ID_INVENTARIO
         JOIN PRODUCTO p ON p.ID_PRODUCTO = i.ID_PRODUCTO JOIN UNIDAD_MEDIDA um ON um.ID_UNIDAD_MEDIDA = p.ID_UNIDAD_MEDIDA
         JOIN USUARIO u ON u.ID_USUARIO = di.ID_USUARIO
        WHERE di.ORIGEN = 'ABASTECIMIENTO'
        ORDER BY di.FECHA DESC, di.ID_DETALLE_INVENTARIO DESC`, [], formato,
    );
    return resultado.rows;
  } finally { await conexion.close(); }
}

export async function registrarAbastecimiento(datos, identidad) {
  const identificadorProducto = validarId(datos.identificadorProducto, 'producto');
  const cantidad = Number(datos.cantidad);
  if (!Number.isFinite(cantidad) || cantidad <= 0) throw error('La cantidad recibida debe ser mayor que cero.', 400);
  const conexion = await obtenerConexion();
  try {
    const inventario = await conexion.execute(
      `SELECT i.ID_INVENTARIO, i.CANTIDAD, p.ID_UNIDAD_MEDIDA
         FROM INVENTARIO i JOIN PRODUCTO p ON p.ID_PRODUCTO = i.ID_PRODUCTO
        WHERE i.ID_PRODUCTO = :identificadorProducto AND i.ESTADO = 'A' AND p.ESTADO = 'A'
        FOR UPDATE`, { identificadorProducto }, formato,
    );
    if (!inventario.rows.length) throw error('El producto no existe, está inactivo o no tiene inventario activo.', 404);
    const fila = inventario.rows[0];
    if (datos.identificadorUnidadMedida && Number(datos.identificadorUnidadMedida) !== Number(fila.ID_UNIDAD_MEDIDA)) throw error('La unidad de medida no corresponde al producto.', 400);
    const anterior = Number(fila.CANTIDAD); const nueva = anterior + cantidad;
    await conexion.execute(`UPDATE INVENTARIO SET CANTIDAD = :nueva WHERE ID_INVENTARIO = :identificadorInventario`, { nueva, identificadorInventario: fila.ID_INVENTARIO });
    await conexion.execute(
      `INSERT INTO DETALLE_INVENTARIO (ID_INVENTARIO, ID_USUARIO, ORIGEN, TIPO_MOVIMIENTO, EXISTENCIA_ANTERIOR, EXISTENCIA_NUEVA)
       VALUES (:identificadorInventario, :identificadorUsuario, 'ABASTECIMIENTO', 'ENTRADA', :anterior, :nueva)`,
      { identificadorInventario: fila.ID_INVENTARIO, identificadorUsuario: identidad.identificadorUsuario, anterior, nueva },
    );
    await conexion.commit(); return { identificadorProducto, cantidad, existenciaAnterior: anterior, existenciaNueva: nueva };
  } catch (e) { await conexion.rollback(); throw e; } finally { await conexion.close(); }
}

export async function listarRutas(incluirInactivas = false) {
  const conexion = await obtenerConexion(); try {
    const r = await conexion.execute(`SELECT ID_RUTA, NOMBRE, DESCRIPCION, ESTADO FROM RUTA ${incluirInactivas ? '' : "WHERE ESTADO = 'A'"} ORDER BY NOMBRE`, [], formato); return r.rows;
  } finally { await conexion.close(); }
}
export async function guardarRuta(id, datos) {
  const nombre = String(datos.nombre || '').trim(); const descripcion = datos.descripcion ? String(datos.descripcion).trim() : null;
  if (!nombre || nombre.length > 100 || (descripcion && descripcion.length > 300)) throw error('Los datos de la ruta no son válidos.', 400);
  const conexion = await obtenerConexion(); try {
    if (id) {
      const r = await conexion.execute(`UPDATE RUTA SET NOMBRE=:nombre, DESCRIPCION=:descripcion WHERE ID_RUTA=:id`, { nombre, descripcion, id });
      if (!r.rowsAffected) throw error('Ruta no encontrada.', 404);
    } else await conexion.execute(`INSERT INTO RUTA (NOMBRE, DESCRIPCION, ESTADO) VALUES (:nombre,:descripcion,'A')`, { nombre, descripcion });
    await conexion.commit(); return { mensaje: 'Ruta guardada correctamente.' };
  } catch (e) { await conexion.rollback(); throw e; } finally { await conexion.close(); }
}
export async function cambiarEstadoRuta(id, estado) { const conexion=await obtenerConexion(); try { if(estado==='I'){const activa=await conexion.execute(`SELECT 1 FROM EJECUCION_RUTA e JOIN ENTREGA_RUTA er ON er.ID_EJECUCION_RUTA=e.ID_EJECUCION_RUTA WHERE e.ID_RUTA=:id AND (e.ESTADO IN ('PREPARADA','EN_RUTA') OR er.ESTADO='PENDIENTE') FETCH FIRST 1 ROWS ONLY`,{id},formato);if(activa.rows.length)throw error('No puede desactivar una ruta con ejecuciones activas o entregas pendientes.',409);} const r=await conexion.execute(`UPDATE RUTA SET ESTADO=:estado WHERE ID_RUTA=:id`,{id,estado}); if(!r.rowsAffected)throw error('Ruta no encontrada.',404); await conexion.commit(); return {id,estado}; } catch(e){await conexion.rollback();throw e;}finally{await conexion.close();} }

export async function listarDespachos(identidad, propios = false) {
  const conexion=await obtenerConexion(); try {
    const condicion=propios ? 'AND d.ID_USUARIO_PILOTO = :usuario' : '';
    const r=await conexion.execute(`SELECT d.ID_DESPACHO,d.ID_PEDIDO,d.ID_RUTA,d.ID_USUARIO_PILOTO,d.ESTADO,d.FECHA_PREPARACION,d.FECHA_SALIDA,d.FECHA_ENTREGA,d.OBSERVACIONES,r.NOMBRE RUTA,p.ID_SUCURSAL,s.NOMBRE SUCURSAL,u.USUARIO PILOTO
      FROM DESPACHO d JOIN PEDIDO p ON p.ID_PEDIDO=d.ID_PEDIDO JOIN SUCURSAL s ON s.ID_SUCURSAL=p.ID_SUCURSAL LEFT JOIN RUTA r ON r.ID_RUTA=d.ID_RUTA LEFT JOIN USUARIO u ON u.ID_USUARIO=d.ID_USUARIO_PILOTO
      WHERE 1=1 ${condicion} ORDER BY d.FECHA_PREPARACION DESC,d.ID_DESPACHO DESC`, propios?{usuario:identidad.identificadorUsuario}:{},formato); return r.rows;
  } finally{await conexion.close();} }
export async function prepararDespachos(datos, identidad) {
  const pedidos=[...new Set((datos.identificadoresPedidos||[]).map(Number))]; const ruta=validarId(datos.identificadorRuta,'ruta'); const piloto=validarId(datos.identificadorPiloto,'piloto'); if(!pedidos.length||pedidos.some(x=>!Number.isInteger(x)||x<=0))throw error('Seleccione uno o más pedidos válidos.',400);
  const c=await obtenerConexion(); try {
    const rutaActiva=await c.execute(`SELECT 1 FROM RUTA WHERE ID_RUTA=:ruta AND ESTADO='A'`,{ruta},formato); if(!rutaActiva.rows.length)throw error('Ruta no encontrada o inactiva.',404);
    const pilotoValido=await c.execute(`SELECT 1 FROM USUARIO_ROL ur JOIN ROL r ON r.ID_ROL=ur.ID_ROL JOIN USUARIO u ON u.ID_USUARIO=ur.ID_USUARIO WHERE ur.ID_USUARIO=:piloto AND r.NOMBRE='PILOTO' AND u.ESTADO='A'`,{piloto},formato);if(!pilotoValido.rows.length)throw error('El usuario seleccionado no es un piloto activo.',400);
    const idEstado=await estadoPedido(c,'DESPACHADO');
    for(const idPedido of pedidos){ const p=await c.execute(`SELECT p.ID_PEDIDO,e.NOMBRE ESTADO FROM PEDIDO p JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO=p.ID_ESTADO_PEDIDO WHERE p.ID_PEDIDO=:id FOR UPDATE`,{id:idPedido},formato); if(!p.rows.length)throw error('Pedido no encontrado.',404); if(p.rows[0].ESTADO!=='PRODUCIDO')throw error('Solo se pueden despachar pedidos producidos.',409);
      const activo=await c.execute(`SELECT 1 FROM DESPACHO WHERE ID_PEDIDO=:id AND ESTADO IN ('PREPARADO','EN_RUTA')`,{id:idPedido},formato);if(activo.rows.length)throw error('El pedido ya posee un despacho activo.',409);
      const d=await c.execute(`INSERT INTO DESPACHO (ID_PEDIDO,ID_RUTA,ID_USUARIO_DESPACHA,ID_USUARIO_PILOTO,ESTADO,OBSERVACIONES) VALUES (:pedido,:ruta,:responsable,:piloto,'PREPARADO',:observaciones) RETURNING ID_DESPACHO INTO :despacho`,{pedido:idPedido,ruta,responsable:identidad.identificadorUsuario,piloto,observaciones:datos.observaciones||null,despacho:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}}); const idDespacho=d.outBinds.despacho[0];
      await c.execute(`INSERT INTO DETALLE_DESPACHO (ID_DESPACHO,ID_PRODUCTO,CANTIDAD) SELECT :despacho,ID_PRODUCTO,CANTIDAD FROM DETALLE_PEDIDO WHERE ID_PEDIDO=:pedido`,{despacho:idDespacho,pedido:idPedido}); await c.execute(`UPDATE PEDIDO SET ID_ESTADO_PEDIDO=:estado WHERE ID_PEDIDO=:pedido`,{estado:idEstado,pedido:idPedido}); await bitacora(c,idPedido,identidad.identificadorUsuario,'DESPACHO_PREPARADO','Despacho preparado'); }
    await c.commit();return {cantidad:pedidos.length};
  }catch(e){await c.rollback();throw e;}finally{await c.close();}
}
export async function confirmarEntrega(idDespacho, identidad) { const c=await obtenerConexion();try{const d=await c.execute(`SELECT d.ID_DESPACHO,d.ID_PEDIDO,d.ESTADO FROM DESPACHO d WHERE d.ID_DESPACHO=:id AND d.ID_USUARIO_PILOTO=:piloto FOR UPDATE`,{id:idDespacho,piloto:identidad.identificadorUsuario},formato);if(!d.rows.length)throw error('Despacho no asignado al piloto.',404);if(d.rows[0].ESTADO==='ENTREGADO')throw error('La entrega ya fue confirmada.',409);if(!['PREPARADO','EN_RUTA'].includes(d.rows[0].ESTADO))throw error('El despacho no está disponible para entrega.',409);const estado=await estadoPedido(c,'ENTREGADO');await c.execute(`UPDATE DESPACHO SET ESTADO='ENTREGADO',FECHA_ENTREGA=SYSTIMESTAMP WHERE ID_DESPACHO=:id`,{id:idDespacho});await c.execute(`UPDATE PEDIDO SET ID_ESTADO_PEDIDO=:estado WHERE ID_PEDIDO=:pedido`,{estado,pedido:d.rows[0].ID_PEDIDO});await bitacora(c,d.rows[0].ID_PEDIDO,identidad.identificadorUsuario,'ENTREGA_CONFIRMADA','Entrega confirmada por piloto');await c.commit();return {idDespacho,estado:'ENTREGADO'};}catch(e){await c.rollback();throw e;}finally{await c.close();} }

export async function listarCancelaciones() { const c=await obtenerConexion();try{const r=await c.execute(`SELECT sc.*,p.ID_SUCURSAL,u.USUARIO SOLICITANTE FROM SOLICITUD_CANCELACION sc JOIN PEDIDO p ON p.ID_PEDIDO=sc.ID_PEDIDO JOIN USUARIO u ON u.ID_USUARIO=sc.ID_USUARIO_SOLICITA ORDER BY sc.FECHA_SOLICITUD DESC`,[],formato);return r.rows;}finally{await c.close();} }
export async function resolverCancelacion(idSolicitud, datos, identidad) { const decision=String(datos.decision||'').toUpperCase();if(!['APROBAR','RECHAZAR'].includes(decision))throw error('La decisión no es válida.',400);const c=await obtenerConexion();try{const s=await c.execute(`SELECT sc.ID_SOLICITUD,sc.ID_PEDIDO,sc.ESTADO,e.NOMBRE ESTADO_PEDIDO FROM SOLICITUD_CANCELACION sc JOIN PEDIDO p ON p.ID_PEDIDO=sc.ID_PEDIDO JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO=p.ID_ESTADO_PEDIDO WHERE sc.ID_SOLICITUD=:id FOR UPDATE`,{id:idSolicitud},formato);if(!s.rows.length)throw error('Solicitud no encontrada.',404);const sol=s.rows[0];if(sol.ESTADO!=='PENDIENTE')throw error('La solicitud ya fue resuelta.',409);let estadoSolicitud='RECHAZADA';if(decision==='APROBAR'){if(['DESPACHADO','ENTREGADO','EN_PRODUCCION'].includes(sol.ESTADO_PEDIDO))throw error('No es posible cancelar un pedido despachado, entregado o en producción.',409);const prod=await c.execute(`SELECT COUNT(*) CANTIDAD FROM PRODUCCION WHERE ID_PEDIDO=:pedido`,{pedido:sol.ID_PEDIDO},formato);if(Number(prod.rows[0].CANTIDAD)>0)throw error('No es posible cancelar automáticamente un pedido con producción asociada.',409);const cancelado=await estadoPedido(c,'CANCELADO');await c.execute(`UPDATE PEDIDO SET ID_ESTADO_PEDIDO=:estado,POSICION_COLA=NULL WHERE ID_PEDIDO=:pedido`,{estado:cancelado,pedido:sol.ID_PEDIDO});estadoSolicitud='APROBADA';await bitacora(c,sol.ID_PEDIDO,identidad.identificadorUsuario,'CANCELACION_APROBADA','Solicitud de cancelación aprobada');}else await bitacora(c,sol.ID_PEDIDO,identidad.identificadorUsuario,'CANCELACION_RECHAZADA',datos.observacion||'Solicitud de cancelación rechazada');await c.execute(`UPDATE SOLICITUD_CANCELACION SET ESTADO=:estado,ID_USUARIO_RESUELVE=:usuario,FECHA_RESOLUCION=SYSTIMESTAMP,OBSERVACION_RESOLUCION=:observacion WHERE ID_SOLICITUD=:id`,{estado:estadoSolicitud,usuario:identidad.identificadorUsuario,observacion:datos.observacion||null,id:idSolicitud});await c.commit();return {idSolicitud,estado:estadoSolicitud};}catch(e){await c.rollback();throw e;}finally{await c.close();}}

export async function consultarDashboard(limiteSemanal = 3, limiteMensual = 3) {const c=await obtenerConexion();try{const semanal=Math.max(1,Math.min(10,Number(limiteSemanal)||3)),mensual=Math.max(1,Math.min(10,Number(limiteMensual)||3));const indicadores=await c.execute(`SELECT (SELECT COUNT(*) FROM PEDIDO p JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO=p.ID_ESTADO_PEDIDO WHERE e.NOMBRE='PENDIENTE') PENDIENTES,(SELECT COUNT(*) FROM PEDIDO p JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO=p.ID_ESTADO_PEDIDO WHERE e.NOMBRE='EN_PRODUCCION') EN_PRODUCCION,(SELECT COUNT(*) FROM PEDIDO p JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO=p.ID_ESTADO_PEDIDO WHERE e.NOMBRE='PRODUCIDO') LISTOS_DESPACHO,(SELECT COUNT(*) FROM PEDIDO p JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO=p.ID_ESTADO_PEDIDO WHERE e.NOMBRE='ENTREGADO' AND TRUNC(p.FECHA_PEDIDO,'MM')=TRUNC(SYSDATE,'MM')) ENTREGADOS_MES FROM DUAL`,[],formato);const ranking=async(inicio,n)=>(await c.execute(`SELECT * FROM (SELECT pr.NOMBRE,SUM(dp.CANTIDAD) UNIDADES FROM PEDIDO p JOIN DETALLE_PEDIDO dp ON dp.ID_PEDIDO=p.ID_PEDIDO JOIN PRODUCTO pr ON pr.ID_PRODUCTO=dp.ID_PRODUCTO JOIN ESTADO_PEDIDO e ON e.ID_ESTADO_PEDIDO=p.ID_ESTADO_PEDIDO WHERE p.FECHA_PEDIDO>=:inicio AND e.NOMBRE<>'CANCELADO' GROUP BY pr.NOMBRE ORDER BY SUM(dp.CANTIDAD) DESC,pr.NOMBRE) WHERE ROWNUM<=:n`,{inicio,n},formato)).rows;const sucursales=(await c.execute(`SELECT s.NOMBRE,COUNT(p.ID_PEDIDO) PEDIDOS FROM SUCURSAL s LEFT JOIN PEDIDO p ON p.ID_SUCURSAL=s.ID_SUCURSAL AND TRUNC(p.FECHA_PEDIDO,'MM')=TRUNC(SYSDATE,'MM') WHERE s.ESTADO='A' GROUP BY s.NOMBRE ORDER BY COUNT(p.ID_PEDIDO),s.NOMBRE`,[],formato)).rows;return {...indicadores.rows[0],SEMANAL:await ranking(new Date(Date.now()-6*86400000),semanal),MENSUAL:await ranking(new Date(new Date().getFullYear(),new Date().getMonth(),1),mensual),SUCURSAL_MENOS:sucursales[0]||null,SUCURSAL_MAS:sucursales.at(-1)||null};}finally{await c.close();}}

async function estadoPedido(c,nombre){const r=await c.execute(`SELECT ID_ESTADO_PEDIDO FROM ESTADO_PEDIDO WHERE NOMBRE=:nombre AND ESTADO='A'`,{nombre},formato);if(!r.rows.length)throw error('Estado operativo no configurado.',409);return r.rows[0].ID_ESTADO_PEDIDO;}
async function bitacora(c,pedido,usuario,accion,comentario){await c.execute(`INSERT INTO BITACORA_PEDIDOS (ID_PEDIDO,ID_USUARIO,ACCION,COMENTARIO) VALUES (:pedido,:usuario,:accion,:comentario)`,{pedido,usuario,accion,comentario});}
function validarId(v,nombre){const id=Number(v);if(!Number.isInteger(id)||id<=0)throw error(`El identificador de ${nombre} no es válido.`,400);return id;} function error(mensaje,codigoEstado){const e=new Error(mensaje);e.codigoEstado=codigoEstado;e.mensajeCliente=mensaje;return e;}
