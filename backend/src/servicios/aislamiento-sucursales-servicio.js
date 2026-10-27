// Obtiene la sucursal exclusivamente de la identidad que validó el middleware.
export function obtenerSucursalAutenticada(identidad) {
  const identificadorSucursal = Number(identidad?.identificadorSucursal);

  if (!Number.isInteger(identificadorSucursal) || identificadorSucursal <= 0) {
    throw crearError('La cuenta no tiene una sucursal asignada para esta operación', 403);
  }

  return identificadorSucursal;
}

// Rechaza la consulta o modificación de recursos que pertenecen a otra sucursal.
export function verificarAccesoSucursal(identidad, identificadorSucursalRecurso, permitirAccesoGlobal = false) {
  if (permitirAccesoGlobal) return;

  const sucursalAutenticada = obtenerSucursalAutenticada(identidad);
  const sucursalRecurso = validarIdentificadorSucursal(identificadorSucursalRecurso);

  if (sucursalAutenticada !== sucursalRecurso) {
    throw crearError('No tiene acceso a información de otra sucursal', 403);
  }
}

// Construye el filtro y los parámetros para consultas de datos que sí pertenecen a sucursal.
export function obtenerFiltroSucursal(identidad, columnaSucursal = 'ID_SUCURSAL', permitirAccesoGlobal = false) {
  if (permitirAccesoGlobal) return { condicion: '', parametros: {} };

  if (!/^[A-Z_]+$/.test(columnaSucursal)) {
    throw new Error('La columna de sucursal no es válida');
  }

  return {
    condicion: `${columnaSucursal} = :identificadorSucursalAutenticada`,
    parametros: { identificadorSucursalAutenticada: obtenerSucursalAutenticada(identidad) },
  };
}

function validarIdentificadorSucursal(valor) {
  const identificadorSucursal = Number(valor);
  if (!Number.isInteger(identificadorSucursal) || identificadorSucursal <= 0) {
    throw crearError('El identificador de sucursal del recurso no es válido', 400);
  }
  return identificadorSucursal;
}

function crearError(mensaje, codigoEstado) {
  const error = new Error(mensaje);
  error.codigoEstado = codigoEstado;
  return error;
}
