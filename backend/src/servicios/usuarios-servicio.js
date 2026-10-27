import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';
import { crearHashContrasena } from './contrasenas-servicio.js';

// Consulta información administrativa segura de las cuentas registradas.
export async function consultarUsuarios() {
  const conexion = await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      `SELECT ID_USUARIO, ID_SUCURSAL, USUARIO, PRIMER_NOMBRE, PRIMER_APELLIDO,
              PUESTO, TIPO, ESTADO, BLOQUEADO, INICIOS_FALLIDOS
         FROM USUARIO
        ORDER BY USUARIO`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return resultado.rows;
  } finally {
    await conexion.close();
  }
}

export async function crearUsuario(datos) {
  const conexion = await obtenerConexion();
  try {
    const resultado = await conexion.execute(`INSERT INTO USUARIO (ID_SUCURSAL,USUARIO,PRIMER_NOMBRE,PRIMER_APELLIDO,PSWD,TIPO,REQUIERE_CAMBIO_PSWD,INICIOS_FALLIDOS,BLOQUEADO,ESTADO) VALUES (:identificadorSucursal,:usuario,:primerNombre,:primerApellido,:contrasena,:tipo,'N',0,'N','A') RETURNING ID_USUARIO INTO :id`,{identificadorSucursal:datos.identificadorSucursal||null,usuario:datos.usuario,primerNombre:datos.primerNombre,primerApellido:datos.primerApellido,contrasena:await crearHashContrasena(datos.contrasena),tipo:datos.tipo,id:{dir:oracledb.BIND_OUT,type:oracledb.NUMBER}});
    await conexion.commit();
    return consultarUsuarioPorIdentificador(resultado.outBinds.id[0]);
  } catch(error) { await conexion.rollback(); if(error.errorNum===1) error.codigoEstado=409; throw error; } finally { await conexion.close(); }
}

export async function editarUsuario(id, datos) {
  const conexion=await obtenerConexion();
  try { const r=await conexion.execute(`UPDATE USUARIO SET ID_SUCURSAL=:identificadorSucursal,PRIMER_NOMBRE=:primerNombre,PRIMER_APELLIDO=:primerApellido,PUESTO=:puesto,TIPO=:tipo WHERE ID_USUARIO=:id`,{id,identificadorSucursal:datos.identificadorSucursal||null,primerNombre:datos.primerNombre,primerApellido:datos.primerApellido,puesto:datos.puesto||null,tipo:datos.tipo}); if(!r.rowsAffected){const e=new Error('Usuario no encontrado');e.codigoEstado=404;throw e;} await conexion.commit(); return consultarUsuarioPorIdentificador(id); } catch(error){await conexion.rollback();throw error;} finally{await conexion.close();}
}

// Cambia el estado lógico de una cuenta sin eliminar su historial.
export async function cambiarEstadoUsuario(id, estado, identificadorSolicitante) {
  if (id === identificadorSolicitante) {
    const error = new Error('No puede cambiar su propio estado');
    error.codigoEstado = 400;
    throw error;
  }
  const conexion = await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      'UPDATE USUARIO SET ESTADO = :estado WHERE ID_USUARIO = :id',
      { id, estado },
    );
    if (!resultado.rowsAffected) {
      const error = new Error('Usuario no encontrado');
      error.codigoEstado = 404;
      throw error;
    }
    await conexion.commit();
    return consultarUsuarioPorIdentificador(id);
  } catch (error) { await conexion.rollback(); throw error; } finally { await conexion.close(); }
}

// Consulta una cuenta por identificador sin exponer su hash de contraseña.
export async function consultarUsuarioPorIdentificador(identificadorUsuario) {
  const conexion = await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      `SELECT ID_USUARIO, ID_SUCURSAL, USUARIO, PRIMER_NOMBRE, SEGUNDO_NOMBRE,
              PRIMER_APELLIDO, SEGUNDO_APELLIDO, PUESTO, TIPO, ESTADO,
              BLOQUEADO, INICIOS_FALLIDOS, REQUIERE_CAMBIO_PSWD
         FROM USUARIO
        WHERE ID_USUARIO = :identificadorUsuario`,
      { identificadorUsuario },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return resultado.rows[0] || null;
  } finally {
    await conexion.close();
  }
}
