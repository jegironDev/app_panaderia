import { cambiarEstadoUsuario, consultarUsuarioPorIdentificador, consultarUsuarios, crearUsuario, editarUsuario } from '../servicios/usuarios-servicio.js';

// Lista usuarios sin hashes, tokens ni otros datos privados.
export async function listarUsuarios(solicitud, respuesta) {
  respuesta.json(await consultarUsuarios());
}

function validar(datos, incluirContrasena) { const obligatorios=['primerNombre','primerApellido','tipo']; if(incluirContrasena)obligatorios.push('usuario','contrasena'); if(!datos || typeof datos !== 'object' || obligatorios.some(campo=>!datos[campo])||!['ADMIN','OPERATIVO','ESTANDAR'].includes(datos.tipo)){const e=new Error('Datos de usuario no válidos');e.codigoEstado=400;throw e;} }
export async function registrarUsuario(s,r){validar(s.body,true);r.status(201).json(await crearUsuario(s.body));}
export async function modificarUsuario(s,r){const id=Number(s.params.id);if(!Number.isInteger(id)||id<=0)return r.status(400).json({error:'El identificador de usuario no es válido'});validar(s.body,false);r.json(await editarUsuario(id,s.body));}
export async function actualizarEstadoUsuario(s,r){const id=Number(s.params.id);const estado=s.body.estado;if(!Number.isInteger(id)||id<=0||!['A','I'].includes(estado))return r.status(400).json({error:'Identificador o estado no válido'});r.json(await cambiarEstadoUsuario(id,estado,s.identidad.identificadorUsuario));}

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
