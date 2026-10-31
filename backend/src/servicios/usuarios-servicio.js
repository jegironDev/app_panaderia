import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';
import { crearHashContrasena } from './contrasenas-servicio.js';
import { generarCandidatosUsuario } from './nombres-usuario-servicio.js';
import { verificarSucursalActiva } from './sucursales-servicio.js';
import { obtenerPuestoActivo } from './puestos-servicio.js';

const formatoFilas = { outFormat: oracledb.OUT_FORMAT_OBJECT };
const maximosIntentosUsuario = 40;

// Verifica la unicidad funcional sin distinguir capitalización antes del INSERT.
export async function existeNombreUsuarioSinDistinguirMayusculas(conexion, usuario) {
  const resultado = await conexion.execute(
    `SELECT 1
       FROM USUARIO
      WHERE UPPER(TRIM(USUARIO)) = :usuarioNormalizado
        FETCH FIRST 1 ROW ONLY`,
    { usuarioNormalizado: String(usuario).trim().toUpperCase() },
    formatoFilas,
  );
  return Boolean(resultado.rows[0]);
}

// Consulta información administrativa segura de las cuentas registradas.
export async function consultarUsuarios() {
  const conexion = await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      `SELECT u.ID_USUARIO, u.ID_SUCURSAL, u.USUARIO, u.PRIMER_NOMBRE, u.PRIMER_APELLIDO,
              COALESCE((SELECT r.NOMBRE FROM USUARIO_ROL ur JOIN ROL r ON r.ID_ROL = ur.ID_ROL
                         WHERE ur.ID_USUARIO = u.ID_USUARIO FETCH FIRST 1 ROW ONLY), u.PUESTO) AS PUESTO,
              u.TIPO, u.ESTADO, u.FECHA_BAJA, u.ID_USUARIO_BAJA, u.BLOQUEADO, u.INICIOS_FALLIDOS
         FROM USUARIO u
        ORDER BY u.USUARIO`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return resultado.rows;
  } finally {
    await conexion.close();
  }
}

export async function crearUsuario(datos, identificadorResponsable) {
  const conexion = await obtenerConexion();
  const hashContrasena = await crearHashContrasena(datos.contrasena);
  const candidatos = generarCandidatosUsuario(datos.primerNombre, datos.primerApellido);
  try {
    const puesto = datos.identificadorPuesto ? await obtenerPuestoActivo(conexion, datos.identificadorPuesto) : null;
    const datosNormalizados = { ...datos, tipo: puesto ? obtenerTipoPorPuesto(puesto.NOMBRE) : datos.tipo };
    await verificarReglaSucursal(conexion, datosNormalizados);
    for (let intento = 0; intento < maximosIntentosUsuario; intento += 1) {
      const usuario = candidatos.next().value;
      try {
        if (await existeNombreUsuarioSinDistinguirMayusculas(conexion, usuario)) {
          continue;
        }
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
            identificadorSucursal: datosNormalizados.identificadorSucursal,
            usuario,
            primerNombre: datos.primerNombre,
            segundoNombre: datos.segundoNombre,
            primerApellido: datos.primerApellido,
            segundoApellido: datos.segundoApellido,
            hashContrasena,
            puesto: puesto?.NOMBRE || datos.puesto,
            tipo: datosNormalizados.tipo,
            identificadorUsuario: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          },
        );
        const identificadorUsuario = resultado.outBinds.identificadorUsuario[0];
        if (puesto) {
          await conexion.execute('INSERT INTO USUARIO_ROL (ID_USUARIO, ID_ROL) VALUES (:identificadorUsuario, :identificadorPuesto)', { identificadorUsuario, identificadorPuesto: puesto.ID_ROL });
        }
        await registrarBitacoraUsuario(conexion, identificadorResponsable, identificadorUsuario, 'CREADO', 'Usuario creado.');
        await conexion.commit();
        return consultarUsuarioPorIdentificador(identificadorUsuario);
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

export async function editarUsuario(id, datos, identificadorResponsable) {
  const conexion=await obtenerConexion();
  try {
    const puesto = datos.identificadorPuesto ? await obtenerPuestoActivo(conexion, datos.identificadorPuesto) : null;
    const datosNormalizados = { ...datos, tipo: puesto ? obtenerTipoPorPuesto(puesto.NOMBRE) : datos.tipo };
    await verificarReglaSucursal(conexion, datosNormalizados);
    const r=await conexion.execute(`UPDATE USUARIO SET ID_SUCURSAL=:identificadorSucursal,PRIMER_NOMBRE=:primerNombre,SEGUNDO_NOMBRE=:segundoNombre,PRIMER_APELLIDO=:primerApellido,SEGUNDO_APELLIDO=:segundoApellido,PUESTO=:puesto,TIPO=:tipo WHERE ID_USUARIO=:id`,{id,identificadorSucursal:datosNormalizados.identificadorSucursal,primerNombre:datos.primerNombre,segundoNombre:datos.segundoNombre,primerApellido:datos.primerApellido,segundoApellido:datos.segundoApellido,puesto:puesto?.NOMBRE || datos.puesto,tipo:datosNormalizados.tipo});
    if(!r.rowsAffected){const e=new Error('Usuario no encontrado');e.codigoEstado=404;throw e;}
    if (puesto) await actualizarPuestoPrincipal(conexion, id, puesto.ID_ROL);
    await registrarBitacoraUsuario(conexion, identificadorResponsable, id, 'EDITADO', 'Datos administrativos actualizados.');
    await conexion.commit(); return consultarUsuarioPorIdentificador(id);
  } catch(error){await conexion.rollback();throw error;} finally{await conexion.close();}
}

async function actualizarPuestoPrincipal(conexion, identificadorUsuario, identificadorPuesto) {
  const existentes = await conexion.execute('SELECT ID_ROL FROM USUARIO_ROL WHERE ID_USUARIO = :identificadorUsuario', { identificadorUsuario }, formatoFilas);
  if (existentes.rows.length > 1 && !existentes.rows.some(fila => Number(fila.ID_ROL) === Number(identificadorPuesto))) {
    const error = new Error('El usuario conserva varias asignaciones históricas; adminístrelas antes de cambiar su puesto principal.');
    error.codigoEstado = 409;
    throw error;
  }
  if (existentes.rows.length === 1 && Number(existentes.rows[0].ID_ROL) !== Number(identificadorPuesto)) {
    await conexion.execute('DELETE FROM USUARIO_ROL WHERE ID_USUARIO = :identificadorUsuario AND ID_ROL = :identificadorRol', { identificadorUsuario, identificadorRol: existentes.rows[0].ID_ROL });
  }
  const asignado = existentes.rows.some(fila => Number(fila.ID_ROL) === Number(identificadorPuesto));
  if (!asignado) await conexion.execute('INSERT INTO USUARIO_ROL (ID_USUARIO, ID_ROL) VALUES (:identificadorUsuario, :identificadorPuesto)', { identificadorUsuario, identificadorPuesto });
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
  if (estado !== 'I') {
    const error = new Error('La baja de un usuario es irreversible.');
    error.codigoEstado = 409;
    throw error;
  }
  if (id === identificadorSolicitante) {
    const error = new Error('No puede cambiar su propio estado');
    error.codigoEstado = 400;
    throw error;
  }
  const conexion = await obtenerConexion();
  try {
    const usuario = await conexion.execute(`SELECT u.ID_USUARIO, r.NOMBRE ROL FROM USUARIO u LEFT JOIN USUARIO_ROL ur ON ur.ID_USUARIO=u.ID_USUARIO LEFT JOIN ROL r ON r.ID_ROL=ur.ID_ROL WHERE u.ID_USUARIO=:id FOR UPDATE`, { id }, formatoFilas);
    if (!usuario.rows.length) { const error = new Error('Usuario no encontrado'); error.codigoEstado = 404; throw error; }
    if (estado === 'I' && usuario.rows.some(fila => fila.ROL === 'ADMINISTRADOR')) {
      const administradores = await conexion.execute(`SELECT COUNT(*) CANTIDAD FROM USUARIO u JOIN USUARIO_ROL ur ON ur.ID_USUARIO=u.ID_USUARIO JOIN ROL r ON r.ID_ROL=ur.ID_ROL WHERE r.NOMBRE='ADMINISTRADOR' AND u.ESTADO='A' AND u.BLOQUEADO='N'`, [], formatoFilas);
      if (Number(administradores.rows[0].CANTIDAD) <= 1) { const error = new Error('No puede dar de baja al último administrador activo.'); error.codigoEstado = 409; throw error; }
    }
    const resultado = await conexion.execute(
      `UPDATE USUARIO SET ESTADO = :estado,
       FECHA_BAJA = CASE WHEN :estado = 'I' THEN SYSTIMESTAMP ELSE NULL END,
       ID_USUARIO_BAJA = CASE WHEN :estado = 'I' THEN :solicitante ELSE NULL END
       WHERE ID_USUARIO = :id`,
      { id, estado, solicitante: identificadorSolicitante },
    );
    if (!resultado.rowsAffected) {
      const error = new Error('Usuario no encontrado');
      error.codigoEstado = 404;
      throw error;
    }
    await registrarBitacoraUsuario(conexion, identificadorSolicitante, id, 'BAJA', 'Usuario dado de baja.');
    await conexion.commit();
    return consultarUsuarioPorIdentificador(id);
  } catch (error) { await conexion.rollback(); throw error; } finally { await conexion.close(); }
}

async function registrarBitacoraUsuario(conexion, identificadorResponsable, identificadorAfectado, accion, comentario) {
  await conexion.execute(
    `INSERT INTO BITACORA_USUARIOS (ID_USUARIO, ID_USUARIO_AFECTADO, ACCION, COMENTARIO)
     VALUES (:identificadorResponsable, :identificadorAfectado, :accion, :comentario)`,
    { identificadorResponsable, identificadorAfectado, accion, comentario },
  );
}

// La clasificación técnica se mantiene corta para respetar la columna TIPO;
// el nombre legible del puesto se presenta desde ROL.
function obtenerTipoPorPuesto(nombrePuesto) {
  if (nombrePuesto === 'ADMINISTRADOR') return 'ADMIN';
  if (nombrePuesto === 'USUARIO_SUCURSAL') return 'ESTANDAR';
  return 'OPERATIVO';
}

// Consulta una cuenta por identificador sin exponer su hash de contraseña.
export async function consultarUsuarioPorIdentificador(identificadorUsuario) {
  const conexion = await obtenerConexion();
  try {
    const resultado = await conexion.execute(
      `SELECT u.ID_USUARIO, u.ID_SUCURSAL, u.USUARIO, u.PRIMER_NOMBRE, u.SEGUNDO_NOMBRE,
              u.PRIMER_APELLIDO, u.SEGUNDO_APELLIDO,
              COALESCE((SELECT r.NOMBRE FROM USUARIO_ROL ur JOIN ROL r ON r.ID_ROL = ur.ID_ROL
                         WHERE ur.ID_USUARIO = u.ID_USUARIO FETCH FIRST 1 ROW ONLY), u.PUESTO) AS PUESTO,
              u.TIPO, u.ESTADO,
              BLOQUEADO, INICIOS_FALLIDOS, REQUIERE_CAMBIO_PSWD
         FROM USUARIO u
        WHERE u.ID_USUARIO = :identificadorUsuario`,
      { identificadorUsuario },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return resultado.rows[0] || null;
  } finally {
    await conexion.close();
  }
}
