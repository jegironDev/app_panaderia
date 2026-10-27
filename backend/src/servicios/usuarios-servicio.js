import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';
import { crearHashContrasena } from './contrasenas-servicio.js';
import { generarCandidatosUsuario } from './nombres-usuario-servicio.js';
import { verificarSucursalActiva } from './sucursales-servicio.js';

const formatoFilas = { outFormat: oracledb.OUT_FORMAT_OBJECT };
const maximosIntentosUsuario = 40;

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
  const hashContrasena = await crearHashContrasena(datos.contrasena);
  const candidatos = generarCandidatosUsuario(datos.primerNombre, datos.primerApellido);
  try {
    await verificarReglaSucursal(conexion, datos);
    for (let intento = 0; intento < maximosIntentosUsuario; intento += 1) {
      const usuario = candidatos.next().value;
      try {
        const resultado = await conexion.execute(
          `INSERT INTO USUARIO
            (ID_SUCURSAL, USUARIO, PRIMER_NOMBRE, SEGUNDO_NOMBRE, PRIMER_APELLIDO,
             SEGUNDO_APELLIDO, PSWD, PUESTO, TIPO, REQUIERE_CAMBIO_PSWD,
             INICIOS_FALLIDOS, BLOQUEADO, ESTADO)
           VALUES
            (:identificadorSucursal, :usuario, :primerNombre, :segundoNombre, :primerApellido,
             :segundoApellido, :hashContrasena, :puesto, :tipo, 'N', 0, 'N', 'A')
           RETURNING ID_USUARIO INTO :identificadorUsuario`,
          {
            identificadorSucursal: datos.identificadorSucursal,
            usuario,
            primerNombre: datos.primerNombre,
            segundoNombre: datos.segundoNombre,
            primerApellido: datos.primerApellido,
            segundoApellido: datos.segundoApellido,
            hashContrasena,
            puesto: datos.puesto,
            tipo: datos.tipo,
            identificadorUsuario: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          },
        );
        await conexion.commit();
        return consultarUsuarioPorIdentificador(resultado.outBinds.identificadorUsuario[0]);
      } catch (error) {
        await conexion.rollback();
        if (error.errorNum !== 1) throw error;
      }
    }
    const error = new Error('No fue posible generar un nombre de usuario único');
    error.codigoEstado = 409;
    throw error;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally { await conexion.close(); }
}

export async function editarUsuario(id, datos) {
  const conexion=await obtenerConexion();
  try {
    await verificarReglaSucursal(conexion, datos);
    const r=await conexion.execute(`UPDATE USUARIO SET ID_SUCURSAL=:identificadorSucursal,PRIMER_NOMBRE=:primerNombre,SEGUNDO_NOMBRE=:segundoNombre,PRIMER_APELLIDO=:primerApellido,SEGUNDO_APELLIDO=:segundoApellido,PUESTO=:puesto,TIPO=:tipo WHERE ID_USUARIO=:id`,{id,identificadorSucursal:datos.identificadorSucursal,primerNombre:datos.primerNombre,segundoNombre:datos.segundoNombre,primerApellido:datos.primerApellido,segundoApellido:datos.segundoApellido,puesto:datos.puesto,tipo:datos.tipo});
    if(!r.rowsAffected){const e=new Error('Usuario no encontrado');e.codigoEstado=404;throw e;}
    await conexion.commit(); return consultarUsuarioPorIdentificador(id);
  } catch(error){await conexion.rollback();throw error;} finally{await conexion.close();}
}

async function verificarReglaSucursal(conexion, datos) {
  if (datos.tipo === 'ESTANDAR') return verificarSucursalActiva(conexion, datos.identificadorSucursal);
  if (datos.identificadorSucursal !== null) {
    const error = new Error('ADMIN y OPERATIVO no pueden tener una sucursal asignada');
    error.codigoEstado = 400;
    throw error;
  }
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
