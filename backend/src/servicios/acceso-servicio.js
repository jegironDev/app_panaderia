import oracledb from 'oracledb';
import { obtenerConexion } from '../configuracion/base-datos.js';
import { crearHashContrasena, verificarContrasena } from './contrasenas-servicio.js';
import { crearSesion } from './sesiones-servicio.js';

const formatoFilas = { outFormat: oracledb.OUT_FORMAT_OBJECT };

// Normaliza solo el nombre de acceso; la contraseña nunca se transforma.
export function normalizarNombreAcceso(nombreUsuario) {
  return String(nombreUsuario ?? '').trim().toUpperCase();
}

// Busca información no sensible para validar el acceso de una cuenta.
export async function obtenerUsuarioPorNombre(conexion, nombreUsuario) {
  const nombreUsuarioNormalizado = normalizarNombreAcceso(nombreUsuario);
  if (!nombreUsuarioNormalizado) return null;

  const resultado = await conexion.execute(
    `SELECT ID_USUARIO, ID_SUCURSAL, USUARIO, PRIMER_NOMBRE, PRIMER_APELLIDO,
            PSWD, ESTADO, BLOQUEADO, INICIOS_FALLIDOS
       FROM USUARIO
      WHERE UPPER(TRIM(USUARIO)) = :nombreUsuarioNormalizado`,
    { nombreUsuarioNormalizado },
    formatoFilas,
  );

  return resultado.rows[0] || null;
}

// Obtiene permisos desde las relaciones reales de usuario, rol y permiso.
async function obtenerPermisosUsuario(conexion, identificadorUsuario) {
  const resultado = await conexion.execute(
    `SELECT DISTINCT p.CODIGO
       FROM USUARIO_ROL ur
       JOIN ROL r ON r.ID_ROL = ur.ID_ROL AND r.ESTADO = 'A'
       JOIN ROL_PERMISO rp ON rp.ID_ROL = r.ID_ROL
       JOIN PERMISO p ON p.ID_PERMISO = rp.ID_PERMISO
      WHERE ur.ID_USUARIO = :identificadorUsuario
      ORDER BY p.CODIGO`,
    { identificadorUsuario },
    formatoFilas,
  );

  return resultado.rows.map(fila => fila.CODIGO);
}

// Recupera la identidad actual desde Oracle para no confiar en permisos guardados en el cliente.
export async function obtenerIdentidadActual(identificadorUsuario) {
  const conexion = await obtenerConexion();

  try {
    const resultado = await conexion.execute(
      `SELECT ID_USUARIO, ID_SUCURSAL, USUARIO, PRIMER_NOMBRE, PRIMER_APELLIDO,
              ESTADO, BLOQUEADO
         FROM USUARIO
        WHERE ID_USUARIO = :identificadorUsuario`,
      { identificadorUsuario },
      formatoFilas,
    );
    const usuario = resultado.rows[0];

    if (!usuario || usuario.ESTADO !== 'A' || usuario.BLOQUEADO !== 'N') {
      return null;
    }

    return {
      identificadorUsuario: usuario.ID_USUARIO,
      identificadorSucursal: usuario.ID_SUCURSAL,
      usuario: usuario.USUARIO,
      nombre: `${usuario.PRIMER_NOMBRE} ${usuario.PRIMER_APELLIDO}`,
      permisos: await obtenerPermisosUsuario(conexion, usuario.ID_USUARIO),
    };
  } finally {
    await conexion.close();
  }
}

// Registra un intento fallido sin revelar si el usuario existe.
async function registrarIntentoFallido(conexion, identificadorUsuario) {
  if (!identificadorUsuario) {
    return;
  }

  await conexion.execute(
    `UPDATE USUARIO
        SET INICIOS_FALLIDOS = INICIOS_FALLIDOS + 1
      WHERE ID_USUARIO = :identificadorUsuario`,
    { identificadorUsuario },
  );
}

// Restablece el contador cuando la autenticación se completa correctamente.
async function restablecerIntentos(conexion, identificadorUsuario) {
  await conexion.execute(
    `UPDATE USUARIO
        SET INICIOS_FALLIDOS = 0
      WHERE ID_USUARIO = :identificadorUsuario`,
    { identificadorUsuario },
  );
}

// Valida credenciales, estado de cuenta y permisos antes de emitir una sesión.
export async function iniciarSesion(nombreUsuario, contrasena) {
  const conexion = await obtenerConexion();

  try {
    const usuario = await obtenerUsuarioPorNombre(conexion, nombreUsuario);
    const accesoValido = usuario
      && usuario.ESTADO === 'A'
      && usuario.BLOQUEADO === 'N'
      && await verificarContrasena(contrasena, usuario.PSWD);

    if (!accesoValido) {
      await registrarIntentoFallido(conexion, usuario?.ID_USUARIO);
      await conexion.commit();
      const error = new Error('Credenciales no válidas');
      error.codigoEstado = 401;
      throw error;
    }

    await restablecerIntentos(conexion, usuario.ID_USUARIO);
    const permisos = await obtenerPermisosUsuario(conexion, usuario.ID_USUARIO);
    await conexion.commit();

    const datosUsuario = {
      identificadorUsuario: usuario.ID_USUARIO,
      identificadorSucursal: usuario.ID_SUCURSAL,
      usuario: usuario.USUARIO,
      nombre: `${usuario.PRIMER_NOMBRE} ${usuario.PRIMER_APELLIDO}`,
      permisos,
    };
    const sesion = crearSesion(datosUsuario);

    return {
      token: sesion.token,
      venceEn: sesion.venceEn,
      usuario: datosUsuario,
    };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    await conexion.close();
  }
}

// Crea la primera configuración solo cuando no existen usuarios ni roles y la clave local coincide.
export async function inicializarAcceso(claveInicial, configuracion) {
  if (!process.env.CLAVE_INICIAL_USUARIOS || claveInicial !== process.env.CLAVE_INICIAL_USUARIOS) {
    const error = new Error('No se autorizó la inicialización');
    error.codigoEstado = 403;
    throw error;
  }

  const conexion = await obtenerConexion();

  try {
    const validacion = await conexion.execute(
      `SELECT (SELECT COUNT(*) FROM USUARIO) USUARIOS,
              (SELECT COUNT(*) FROM ROL) ROLES
         FROM DUAL`,
      [],
      formatoFilas,
    );
    const conteos = validacion.rows[0];

    if (conteos.USUARIOS > 0 || conteos.ROLES > 0) {
      const error = new Error('La configuración inicial ya fue creada');
      error.codigoEstado = 409;
      throw error;
    }

    for (const rol of configuracion.roles) {
      const resultadoRol = await conexion.execute(
        `INSERT INTO ROL (NOMBRE, DESCRIPCION, ESTADO)
         VALUES (:nombre, :descripcion, 'A')
         RETURNING ID_ROL INTO :identificadorRol`,
        {
          nombre: rol.nombre,
          descripcion: rol.descripcion || null,
          identificadorRol: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );
      const identificadorRol = resultadoRol.outBinds.identificadorRol[0];

      for (const codigoPermiso of rol.permisos) {
        const permiso = await conexion.execute(
          'SELECT ID_PERMISO FROM PERMISO WHERE CODIGO = :codigoPermiso',
          { codigoPermiso },
          formatoFilas,
        );

        if (!permiso.rows[0]) {
          const error = new Error('Se recibió un permiso inexistente');
          error.codigoEstado = 400;
          throw error;
        }

        await conexion.execute(
          'INSERT INTO ROL_PERMISO (ID_ROL, ID_PERMISO) VALUES (:identificadorRol, :identificadorPermiso)',
          { identificadorRol, identificadorPermiso: permiso.rows[0].ID_PERMISO },
        );
      }
    }

    for (const usuario of configuracion.usuarios) {
      const resultadoUsuario = await conexion.execute(
        `INSERT INTO USUARIO
          (ID_SUCURSAL, USUARIO, PRIMER_NOMBRE, PRIMER_APELLIDO, PSWD, TIPO,
           REQUIERE_CAMBIO_PSWD, INICIOS_FALLIDOS, BLOQUEADO, ESTADO)
         VALUES
          (:identificadorSucursal, :usuario, :primerNombre, :primerApellido, :hashContrasena, :tipo,
           'N', 0, 'N', 'A')
         RETURNING ID_USUARIO INTO :identificadorUsuario`,
        {
          identificadorSucursal: usuario.identificadorSucursal || null,
          usuario: usuario.usuario,
          primerNombre: usuario.primerNombre,
          primerApellido: usuario.primerApellido,
          hashContrasena: await crearHashContrasena(usuario.contrasena),
          tipo: usuario.tipo,
          identificadorUsuario: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );
      const identificadorUsuario = resultadoUsuario.outBinds.identificadorUsuario[0];

      for (const nombreRol of usuario.roles) {
        const rol = await conexion.execute(
          'SELECT ID_ROL FROM ROL WHERE NOMBRE = :nombreRol AND ESTADO = \'A\'',
          { nombreRol },
          formatoFilas,
        );

        if (!rol.rows[0]) {
          const error = new Error('Se recibió un rol inexistente');
          error.codigoEstado = 400;
          throw error;
        }

        await conexion.execute(
          'INSERT INTO USUARIO_ROL (ID_USUARIO, ID_ROL) VALUES (:identificadorUsuario, :identificadorRol)',
          { identificadorUsuario, identificadorRol: rol.rows[0].ID_ROL },
        );
      }
    }

    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    await conexion.close();
  }
}
