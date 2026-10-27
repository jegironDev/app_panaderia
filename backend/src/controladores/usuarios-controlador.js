import { cambiarEstadoUsuario, consultarUsuarioPorIdentificador, consultarUsuarios, crearUsuario, editarUsuario } from '../servicios/usuarios-servicio.js';

// Lista usuarios sin hashes, tokens ni otros datos privados.
export async function listarUsuarios(solicitud, respuesta) {
  respuesta.json(await consultarUsuarios());
}

const camposCreacion = new Set(['primerNombre','segundoNombre','primerApellido','segundoApellido','puesto','tipo','identificadorSucursal','contrasena']);
const camposEdicion = new Set(['primerNombre','segundoNombre','primerApellido','segundoApellido','puesto','tipo','identificadorSucursal']);
const longitudes = { primerNombre: 50, segundoNombre: 50, primerApellido: 50, segundoApellido: 50, puesto: 60 };

export async function registrarUsuario(solicitud, respuesta) {
  const datos = validarDatosUsuario(solicitud.body, camposCreacion, true);
  respuesta.status(201).json(await crearUsuario(datos));
}

export async function modificarUsuario(solicitud, respuesta) {
  const id = validarIdentificador(solicitud.params.id);
  const datos = validarDatosUsuario(solicitud.body, camposEdicion, false);
  respuesta.json(await editarUsuario(id, datos));
}

export async function actualizarEstadoUsuario(solicitud, respuesta) {
  const id = validarIdentificador(solicitud.params.id);
  const estado = solicitud.body?.estado;
  if (!['A','I'].includes(estado)) return respuesta.status(400).json({error:'Identificador o estado no válido'});
  respuesta.json(await cambiarEstadoUsuario(id, estado, solicitud.identidad.identificadorUsuario));
}

function validarDatosUsuario(datos, camposPermitidos, incluirContrasena) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw crearError('Datos de usuario no válidos');
  for (const campo of Object.keys(datos)) if (!camposPermitidos.has(campo)) throw crearError(`El campo ${campo} no está permitido`);
  const usuario = {
    primerNombre: validarTexto(datos.primerNombre, 'primerNombre', true),
    segundoNombre: validarTexto(datos.segundoNombre, 'segundoNombre'),
    primerApellido: validarTexto(datos.primerApellido, 'primerApellido', true),
    segundoApellido: validarTexto(datos.segundoApellido, 'segundoApellido'),
    puesto: validarTexto(datos.puesto, 'puesto'),
    tipo: validarTipo(datos.tipo),
    identificadorSucursal: validarSucursal(datos.identificadorSucursal),
  };
  if (usuario.tipo === 'ESTANDAR' && usuario.identificadorSucursal === null) {
    throw crearError('ESTANDAR requiere una sucursal activa');
  }
  if (incluirContrasena) {
    if (typeof datos.contrasena !== 'string' || !datos.contrasena) throw crearError('La contraseña es obligatoria');
    usuario.contrasena = datos.contrasena;
  }
  return usuario;
}

function validarTexto(valor, campo, obligatorio = false) {
  if (valor === undefined || valor === null || valor === '') {
    if (obligatorio) throw crearError(`El campo ${campo} es obligatorio`);
    return null;
  }
  if (typeof valor !== 'string') throw crearError(`El campo ${campo} no es válido`);
  const texto = valor.trim();
  if ((!texto && obligatorio) || texto.length > longitudes[campo]) throw crearError(`El campo ${campo} no es válido`);
  return texto || null;
}

function validarTipo(valor) {
  const tipo = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
  if (!['ADMIN','OPERATIVO','ESTANDAR'].includes(tipo)) throw crearError('El tipo de usuario no es válido');
  return tipo;
}

function validarSucursal(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const identificadorSucursal = Number(valor);
  if (!Number.isInteger(identificadorSucursal) || identificadorSucursal <= 0) throw crearError('El identificador de sucursal no es válido');
  return identificadorSucursal;
}

function validarIdentificador(valor) {
  const identificador = Number(valor);
  if (!Number.isInteger(identificador) || identificador <= 0) throw crearError('El identificador de usuario no es válido');
  return identificador;
}

function crearError(mensaje) {
  const error = new Error(mensaje);
  error.codigoEstado = 400;
  return error;
}

// Valida el identificador antes de consultar una cuenta individual.
export async function consultarUsuario(solicitud, respuesta) {
  const identificadorUsuario = Number(solicitud.params.id);

  if (!Number.isInteger(identificadorUsuario) || identificadorUsuario <= 0) {
    return respuesta.status(400).json({ error: 'El identificador de usuario no es válido' });
  }

  const usuario = await consultarUsuarioPorIdentificador(identificadorUsuario);

  if (!usuario) {
    return respuesta.status(404).json({ error: 'Usuario no encontrado' });
  }

  return respuesta.json(usuario);
}
