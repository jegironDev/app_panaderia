import dotenv from 'dotenv';
import oracledb from 'oracledb';
import { crearHashContrasena } from '../src/servicios/contrasenas-servicio.js';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const cadenaConexion = process.env.BD_CADENA_CONEXION;
const contrasenaInicial = process.env.CONTRASENA_INICIAL_USUARIOS;
const usuariosEsperados = new Map([
  [106, { usuario: 'JGIRON', identificadorRol: 21, identificadorSucursal: null }],
  [107, { usuario: 'cmendez', identificadorRol: 22, identificadorSucursal: null }],
  [108, { usuario: 'amorales', identificadorRol: 23, identificadorSucursal: null }],
  [109, { usuario: 'lramirez', identificadorRol: 24, identificadorSucursal: null }],
  [110, { usuario: 'plopez', identificadorRol: 25, identificadorSucursal: null }],
  [111, { usuario: 'rcastillo', identificadorRol: 26, identificadorSucursal: null }],
  [112, { usuario: 'dherrera', identificadorRol: 27, identificadorSucursal: 3 }],
  [113, { usuario: 'svargas', identificadorRol: 27, identificadorSucursal: 4 }],
]);

const formatoFilas = { outFormat: oracledb.OUT_FORMAT_OBJECT };

function crearConexion(configuracion) {
  if (!configuracion.usuario || !configuracion.contrasena || !cadenaConexion) {
    throw new Error('Falta configuración privada para conectar con Oracle.');
  }
  return oracledb.getConnection({
    user: configuracion.usuario,
    password: configuracion.contrasena,
    connectString: cadenaConexion,
  });
}

async function confirmarDestino(conexion) {
  const resultado = await conexion.execute(
    `SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') AS ESQUEMA,
            SYS_CONTEXT('USERENV', 'CON_NAME') AS PDB
       FROM DUAL`, [], formatoFilas,
  );
  const { ESQUEMA: esquema, PDB: pdb } = resultado.rows[0];
  if (esquema !== 'DB_PANADERIA' || pdb !== 'XEPDB1') {
    throw new Error('La conexión destino no corresponde a DB_PANADERIA en XEPDB1.');
  }
}

async function obtenerUsuariosOrigen(conexion) {
  const resultado = await conexion.execute(
    `SELECT ID_USUARIO, ID_SUCURSAL, USUARIO, PRIMER_NOMBRE, SEGUNDO_NOMBRE,
            PRIMER_APELLIDO, SEGUNDO_APELLIDO, PUESTO, TIPO,
            REQUIERE_CAMBIO_PSWD, INICIOS_FALLIDOS, BLOQUEADO, ESTADO
       FROM USUARIO
      WHERE ID_USUARIO BETWEEN 106 AND 113
      ORDER BY ID_USUARIO`, [], formatoFilas,
  );
  if (resultado.rows.length !== usuariosEsperados.size) {
    throw new Error('PANADERIA no contiene exactamente los ocho usuarios requeridos.');
  }
  for (const fila of resultado.rows) {
    const esperado = usuariosEsperados.get(Number(fila.ID_USUARIO));
    if (!esperado || fila.USUARIO.toUpperCase() !== esperado.usuario.toUpperCase()
      || Number(fila.ID_SUCURSAL ?? 0) !== Number(esperado.identificadorSucursal ?? 0)) {
      throw new Error('Los usuarios de origen no coinciden con la asignación autorizada.');
    }
  }
  return resultado.rows;
}

async function asegurarPrerequisitos(conexion) {
  const roles = await conexion.execute(
    `SELECT ID_ROL FROM ROL WHERE ID_ROL BETWEEN 21 AND 27 ORDER BY ID_ROL`, [], formatoFilas,
  );
  if (roles.rows.length !== 7) throw new Error('Faltan roles requeridos en DB_PANADERIA.');
}

async function asegurarSucursales(conexion, conexionOrigen) {
  const origen = await conexionOrigen.execute(
    `SELECT ID_SUCURSAL, NOMBRE, DIRECCION, TELEFONO, ESTADO
       FROM SUCURSAL
      WHERE ID_SUCURSAL IN (3, 4)
      ORDER BY ID_SUCURSAL`, [], formatoFilas,
  );
  if (origen.rows.length !== 2) throw new Error('Faltan las sucursales de origen requeridas.');

  for (const sucursal of origen.rows) {
    const existente = await conexion.execute(
      `SELECT NOMBRE, DIRECCION, TELEFONO, ESTADO
         FROM SUCURSAL WHERE ID_SUCURSAL = :identificadorSucursal`,
      { identificadorSucursal: sucursal.ID_SUCURSAL }, formatoFilas,
    );
    if (existente.rows.length) {
      if (existente.rows[0].NOMBRE !== sucursal.NOMBRE || existente.rows[0].ESTADO !== sucursal.ESTADO) {
        throw new Error('Una sucursal destino existente no coincide con el origen autorizado.');
      }
      continue;
    }
    await conexion.execute(
      `INSERT INTO SUCURSAL (ID_SUCURSAL, NOMBRE, DIRECCION, TELEFONO, ESTADO)
       VALUES (:identificadorSucursal, :nombre, :direccion, :telefono, :estado)`,
      {
        identificadorSucursal: sucursal.ID_SUCURSAL,
        nombre: sucursal.NOMBRE,
        direccion: sucursal.DIRECCION,
        telefono: sucursal.TELEFONO,
        estado: sucursal.ESTADO,
      },
    );
  }
}

async function insertarUsuarios(conexion, usuariosOrigen) {
  if (!contrasenaInicial) {
    throw new Error('Falta la variable local CONTRASENA_INICIAL_USUARIOS.');
  }
  for (const usuario of usuariosOrigen) {
    const esperado = usuariosEsperados.get(Number(usuario.ID_USUARIO));
    const existente = await conexion.execute(
      `SELECT ID_USUARIO, USUARIO
         FROM USUARIO
        WHERE ID_USUARIO = :identificadorUsuario
           OR UPPER(USUARIO) = UPPER(:usuario)`,
      { identificadorUsuario: usuario.ID_USUARIO, usuario: usuario.USUARIO }, formatoFilas,
    );
    if (existente.rows.length) {
      if (existente.rows.length !== 1 || Number(existente.rows[0].ID_USUARIO) !== Number(usuario.ID_USUARIO)
        || existente.rows[0].USUARIO.toUpperCase() !== usuario.USUARIO.toUpperCase()) {
        throw new Error('Existe un usuario destino que impediría una inicialización segura.');
      }
    } else {
      const hashContrasena = await crearHashContrasena(contrasenaInicial);
      await conexion.execute(
        `INSERT INTO USUARIO
          (ID_USUARIO, ID_SUCURSAL, USUARIO, PRIMER_NOMBRE, SEGUNDO_NOMBRE,
           PRIMER_APELLIDO, SEGUNDO_APELLIDO, PSWD, PUESTO, TIPO,
           REQUIERE_CAMBIO_PSWD, INICIOS_FALLIDOS, BLOQUEADO, ESTADO)
         VALUES
          (:identificadorUsuario, :identificadorSucursal, :usuario, :primerNombre, :segundoNombre,
           :primerApellido, :segundoApellido, :hashContrasena, :puesto, :tipo,
           :requiereCambio, 0, :bloqueado, :estado)`,
        {
          identificadorUsuario: usuario.ID_USUARIO,
          identificadorSucursal: esperado.identificadorSucursal,
          usuario: usuario.USUARIO,
          primerNombre: usuario.PRIMER_NOMBRE,
          segundoNombre: usuario.SEGUNDO_NOMBRE,
          primerApellido: usuario.PRIMER_APELLIDO,
          segundoApellido: usuario.SEGUNDO_APELLIDO,
          hashContrasena,
          puesto: usuario.PUESTO,
          tipo: usuario.TIPO,
          requiereCambio: usuario.REQUIERE_CAMBIO_PSWD,
          bloqueado: usuario.BLOQUEADO,
          estado: usuario.ESTADO,
        },
      );
    }

    const relacion = await conexion.execute(
      `SELECT ID_ROL FROM USUARIO_ROL
        WHERE ID_USUARIO = :identificadorUsuario AND ID_ROL = :identificadorRol`,
      { identificadorUsuario: usuario.ID_USUARIO, identificadorRol: esperado.identificadorRol }, formatoFilas,
    );
    if (!relacion.rows.length) {
      await conexion.execute(
        `INSERT INTO USUARIO_ROL (ID_USUARIO, ID_ROL)
         VALUES (:identificadorUsuario, :identificadorRol)`,
        { identificadorUsuario: usuario.ID_USUARIO, identificadorRol: esperado.identificadorRol },
      );
    }
  }
}

async function sincronizarIdentidades(conexion) {
  await conexion.execute('ALTER TABLE SUCURSAL MODIFY (ID_SUCURSAL GENERATED BY DEFAULT AS IDENTITY (START WITH LIMIT VALUE))');
  await conexion.execute('ALTER TABLE USUARIO MODIFY (ID_USUARIO GENERATED BY DEFAULT AS IDENTITY (START WITH LIMIT VALUE))');
}

async function verificarResultado(conexion) {
  const resultado = await conexion.execute(
    `SELECT u.ID_USUARIO, u.USUARIO, u.ID_SUCURSAL, ur.ID_ROL
       FROM USUARIO u
       JOIN USUARIO_ROL ur ON ur.ID_USUARIO = u.ID_USUARIO
      WHERE u.ID_USUARIO BETWEEN 106 AND 113
      ORDER BY u.ID_USUARIO`, [], formatoFilas,
  );
  if (resultado.rows.length !== usuariosEsperados.size) throw new Error('La verificación final no encontró las ocho asignaciones.');
  for (const fila of resultado.rows) {
    const esperado = usuariosEsperados.get(Number(fila.ID_USUARIO));
    if (!esperado || Number(fila.ID_ROL) !== esperado.identificadorRol
      || Number(fila.ID_SUCURSAL ?? 0) !== Number(esperado.identificadorSucursal ?? 0)) {
      throw new Error('Una asignación final no coincide con el plan autorizado.');
    }
  }
  return resultado.rows.length;
}

const conexionOrigen = await crearConexion({
  usuario: process.env.BD_USUARIO,
  contrasena: process.env.BD_CONTRASENA,
});
const conexionDestino = await crearConexion({
  usuario: process.env.BD_USUARIO_NUEVO,
  contrasena: process.env.BD_CONTRASENA_NUEVO,
});

try {
  await confirmarDestino(conexionDestino);
  const usuariosOrigen = await obtenerUsuariosOrigen(conexionOrigen);
  await asegurarPrerequisitos(conexionDestino);
  await asegurarSucursales(conexionDestino, conexionOrigen);
  await insertarUsuarios(conexionDestino, usuariosOrigen);
  await conexionDestino.commit();
  await sincronizarIdentidades(conexionDestino);
  const cantidad = await verificarResultado(conexionDestino);
  console.log(`Inicialización completada: ${cantidad} usuarios y relaciones verificados en DB_PANADERIA.`);
} catch (error) {
  await conexionDestino.rollback();
  throw error;
} finally {
  await conexionOrigen.close();
  await conexionDestino.close();
}
