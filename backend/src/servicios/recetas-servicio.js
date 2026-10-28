import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';

const formatoFilas = { outFormat: oracledb.OUT_FORMAT_OBJECT };

// Las consultas admiten una conexión externa únicamente para pruebas aisladas y transacciones internas.
export async function consultarRecetas(conexionExterna = null) {
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      `SELECT r.ID_RECETA, r.NOMBRE, r.UNIDADES_PRODUCIDAS, r.ESTADO,
              p.ID_PRODUCTO, p.NOMBRE AS NOMBRE_PRODUCTO, p.TIPO AS TIPO_PRODUCTO,
              COUNT(dr.ID_DETALLE_RECETA) AS INGREDIENTES
         FROM RECETA r
         JOIN PRODUCTO p ON p.ID_PRODUCTO = r.ID_PRODUCTO
         LEFT JOIN DETALLE_RECETA dr ON dr.ID_RECETA = r.ID_RECETA
        GROUP BY r.ID_RECETA, r.NOMBRE, r.UNIDADES_PRODUCIDAS, r.ESTADO,
                 p.ID_PRODUCTO, p.NOMBRE, p.TIPO
        ORDER BY r.ESTADO DESC, r.NOMBRE, r.ID_RECETA`,
      [],
      formatoFilas,
    );
    return resultado.rows;
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

export async function consultarRecetaPorIdentificador(identificadorReceta, conexionExterna = null) {
  const conexion = conexionExterna || await obtenerConexion();
  try {
    return await obtenerRecetaConConexion(conexion, identificadorReceta);
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

export function validarDatosReceta(datos) {
  const identificadorProducto = convertirIdentificador(datos?.identificadorProducto, 'producto terminado');
  const nombre = typeof datos?.nombre === 'string' ? datos.nombre.trim() : '';
  if (!nombre || nombre.length > 100) throw crearError('El nombre de la receta es obligatorio y debe tener hasta 100 caracteres', 400, true);

  const unidadesProducidas = Number(datos?.unidadesProducidas);
  if (!Number.isFinite(unidadesProducidas) || unidadesProducidas <= 0 || !tieneHastaTresDecimales(unidadesProducidas)) {
    throw crearError('El rendimiento debe ser positivo y tener hasta tres decimales', 400, true);
  }
  if (!Array.isArray(datos?.ingredientes) || !datos.ingredientes.length) {
    throw crearError('Debe incluir al menos un ingrediente', 400, true);
  }

  const productos = new Set();
  const ingredientes = datos.ingredientes.map((ingrediente) => {
    const identificadorIngrediente = convertirIdentificador(ingrediente?.identificadorProducto, 'ingrediente');
    const identificadorUnidadMedida = convertirIdentificador(ingrediente?.identificadorUnidadMedida, 'unidad de medida');
    const cantidad = Number(ingrediente?.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0 || !tieneHastaTresDecimales(cantidad)) {
      throw crearError('La cantidad de cada ingrediente debe ser positiva y tener hasta tres decimales', 400, true);
    }
    if (productos.has(identificadorIngrediente)) throw crearError('No se permiten ingredientes repetidos', 400, true);
    productos.add(identificadorIngrediente);
    return { identificadorProducto: identificadorIngrediente, identificadorUnidadMedida, cantidad };
  });
  return { identificadorProducto, nombre, unidadesProducidas, ingredientes };
}

export async function crearReceta(datosRecibidos, conexionExterna = null) {
  const datos = validarDatosReceta(datosRecibidos);
  const conexion = conexionExterna || await obtenerConexion();
  try {
    await verificarProductoTerminadoActivo(conexion, datos.identificadorProducto);
    await verificarIngredientes(conexion, datos.ingredientes);
    const cabecera = await conexion.execute(
      `INSERT INTO RECETA (ID_PRODUCTO, NOMBRE, UNIDADES_PRODUCIDAS, ESTADO)
       VALUES (:identificadorProducto, :nombre, :unidadesProducidas, 'A')
       RETURNING ID_RECETA INTO :identificadorReceta`,
      {
        identificadorProducto: datos.identificadorProducto,
        nombre: datos.nombre,
        unidadesProducidas: datos.unidadesProducidas,
        identificadorReceta: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );
    const identificadorReceta = cabecera.outBinds.identificadorReceta[0];
    await guardarIngredientes(conexion, identificadorReceta, datos.ingredientes);
    const receta = await obtenerRecetaConConexion(conexion, identificadorReceta);
    await conexion.commit();
    return receta;
  } catch (error) {
    await conexion.rollback();
    if (error.errorNum === 1) error.codigoEstado = 409;
    throw error;
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

export async function modificarReceta(identificadorReceta, datosRecibidos, conexionExterna = null) {
  const datos = validarDatosReceta(datosRecibidos);
  const conexion = conexionExterna || await obtenerConexion();
  try {
    await verificarRecetaEditable(conexion, identificadorReceta);
    await verificarProductoTerminadoActivo(conexion, datos.identificadorProducto);
    await verificarIngredientes(conexion, datos.ingredientes);
    await conexion.execute(
      `UPDATE RECETA
          SET ID_PRODUCTO = :identificadorProducto,
              NOMBRE = :nombre,
              UNIDADES_PRODUCIDAS = :unidadesProducidas
        WHERE ID_RECETA = :identificadorReceta`,
      { ...datos, identificadorReceta },
    );
    await conexion.execute('DELETE FROM DETALLE_RECETA WHERE ID_RECETA = :identificadorReceta', { identificadorReceta });
    await guardarIngredientes(conexion, identificadorReceta, datos.ingredientes);
    const receta = await obtenerRecetaConConexion(conexion, identificadorReceta);
    await conexion.commit();
    return receta;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

// Desactivar conserva la receta y sus detalles para proteger el historial operativo.
export async function desactivarReceta(identificadorReceta, conexionExterna = null) {
  const conexion = conexionExterna || await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      "UPDATE RECETA SET ESTADO = 'I' WHERE ID_RECETA = :identificadorReceta",
      { identificadorReceta },
      { autoCommit: false },
    );
    if (!resultado.rowsAffected) throw crearError('Receta no encontrada', 404, true);
    const receta = await obtenerRecetaConConexion(conexion, identificadorReceta);
    await conexion.commit();
    return receta;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    if (!conexionExterna) await conexion.close();
  }
}

async function verificarRecetaEditable(conexion, identificadorReceta) {
  const receta = await conexion.execute(
    `SELECT r.ID_RECETA,
            (SELECT COUNT(*) FROM PRODUCCION pr WHERE pr.ID_RECETA = r.ID_RECETA) AS PRODUCCIONES
       FROM RECETA r
      WHERE r.ID_RECETA = :identificadorReceta
      FOR UPDATE`,
    { identificadorReceta },
    formatoFilas,
  );
  if (!receta.rows.length) throw crearError('Receta no encontrada', 404, true);
  if (receta.rows[0].PRODUCCIONES > 0) {
    throw crearError('No se puede editar una receta con producciones asociadas', 409, true);
  }
}

// Esta función no administra el ciclo de vida de la conexión recibida.
async function obtenerRecetaConConexion(conexion, identificadorReceta) {
  const cabecera = await conexion.execute(
    `SELECT r.ID_RECETA, r.NOMBRE, r.UNIDADES_PRODUCIDAS, r.ESTADO,
            p.ID_PRODUCTO, p.NOMBRE AS NOMBRE_PRODUCTO, p.TIPO AS TIPO_PRODUCTO
       FROM RECETA r
       JOIN PRODUCTO p ON p.ID_PRODUCTO = r.ID_PRODUCTO
      WHERE r.ID_RECETA = :identificadorReceta`,
    { identificadorReceta },
    formatoFilas,
  );
  if (!cabecera.rows.length) return null;

  const ingredientes = await conexion.execute(
    `SELECT dr.ID_DETALLE_RECETA, dr.ID_PRODUCTO, p.NOMBRE AS NOMBRE_PRODUCTO,
            p.TIPO AS TIPO_PRODUCTO, dr.ID_UNIDAD_MEDIDA,
            um.NOMBRE AS NOMBRE_UNIDAD_MEDIDA, um.ABREVIATURA, dr.CANTIDAD
       FROM DETALLE_RECETA dr
       JOIN PRODUCTO p ON p.ID_PRODUCTO = dr.ID_PRODUCTO
       JOIN UNIDAD_MEDIDA um ON um.ID_UNIDAD_MEDIDA = dr.ID_UNIDAD_MEDIDA
      WHERE dr.ID_RECETA = :identificadorReceta
      ORDER BY dr.ID_DETALLE_RECETA`,
    { identificadorReceta },
    formatoFilas,
  );
  return { ...cabecera.rows[0], INGREDIENTES: ingredientes.rows };
}

async function verificarProductoTerminadoActivo(conexion, identificadorProducto) {
  const resultado = await conexion.execute(
    "SELECT ID_PRODUCTO FROM PRODUCTO WHERE ID_PRODUCTO = :identificadorProducto AND TIPO = 'PFI' AND ESTADO = 'A'",
    { identificadorProducto },
    formatoFilas,
  );
  if (!resultado.rows.length) throw crearError('El producto terminado no existe, no es PFI o está inactivo', 404, true);
}

async function verificarIngredientes(conexion, ingredientes) {
  for (const ingrediente of ingredientes) {
    const producto = await conexion.execute(
      "SELECT ID_PRODUCTO FROM PRODUCTO WHERE ID_PRODUCTO = :identificadorProducto AND TIPO IN ('MAT', 'INS') AND ESTADO = 'A'",
      { identificadorProducto: ingrediente.identificadorProducto },
      formatoFilas,
    );
    if (!producto.rows.length) throw crearError('Un ingrediente no existe, no es MAT o INS, o está inactivo', 404, true);
    const unidad = await conexion.execute(
      "SELECT ID_UNIDAD_MEDIDA FROM UNIDAD_MEDIDA WHERE ID_UNIDAD_MEDIDA = :identificadorUnidadMedida AND ESTADO = 'A'",
      { identificadorUnidadMedida: ingrediente.identificadorUnidadMedida },
      formatoFilas,
    );
    if (!unidad.rows.length) throw crearError('La unidad de medida de un ingrediente no existe o está inactiva', 404, true);
  }
}

async function guardarIngredientes(conexion, identificadorReceta, ingredientes) {
  for (const ingrediente of ingredientes) {
    await conexion.execute(
      `INSERT INTO DETALLE_RECETA (ID_RECETA, ID_PRODUCTO, ID_UNIDAD_MEDIDA, CANTIDAD)
       VALUES (:identificadorReceta, :identificadorProducto, :identificadorUnidadMedida, :cantidad)`,
      { identificadorReceta, ...ingrediente },
    );
  }
}

function convertirIdentificador(valor, entidad) {
  const identificador = Number(valor);
  if (!Number.isInteger(identificador) || identificador <= 0) throw crearError(`El identificador de ${entidad} no es válido`, 400, true);
  return identificador;
}

function tieneHastaTresDecimales(valor) {
  return Math.abs((valor * 1000) - Math.round(valor * 1000)) < 0.0000001;
}

function crearError(mensaje, codigoEstado, exponerAlCliente = false) {
  const error = new Error(mensaje);
  error.codigoEstado = codigoEstado;
  if (exponerAlCliente) error.mensajeCliente = mensaje;
  return error;
}
