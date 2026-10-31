import 'dotenv/config';
import oracledb from 'oracledb';
import { crearGrupoConexiones, obtenerConexion } from '../src/configuracion/base-datos.js';

async function ejecutar() {
  await crearGrupoConexiones();
  const conexion = await obtenerConexion();
  try {
    const columna = await conexion.execute(`SELECT 1 FROM USER_TAB_COLUMNS WHERE TABLE_NAME='EJECUCION_RUTA' AND COLUMN_NAME='ID_JORNADA'`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const condicionJornada = columna.rows.length ? 'e.ID_JORNADA IS NULL AND ' : '';
    const sinReferencia = await conexion.execute(`SELECT e.ID_EJECUCION_RUTA FROM EJECUCION_RUTA e
      WHERE ${condicionJornada}NOT EXISTS (SELECT 1 FROM ENTREGA_RUTA er JOIN PEDIDO p ON p.ID_PEDIDO=er.ID_PEDIDO WHERE er.ID_EJECUCION_RUTA=e.ID_EJECUCION_RUTA AND p.ID_JORNADA IS NOT NULL)
      FETCH FIRST 1 ROW ONLY`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (sinReferencia.rows.length) throw new Error(`La ejecución ${sinReferencia.rows[0].ID_EJECUCION_RUTA} no tiene una entrega con jornada para completar la migración.`);
    if (!columna.rows.length) await conexion.execute('ALTER TABLE EJECUCION_RUTA ADD (ID_JORNADA NUMBER)');
    const sinJornada = await conexion.execute(`SELECT e.ID_EJECUCION_RUTA FROM EJECUCION_RUTA e WHERE e.ID_JORNADA IS NULL`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    for (const ejecucion of sinJornada.rows) {
      const jornada = await conexion.execute(`SELECT p.ID_JORNADA FROM ENTREGA_RUTA er JOIN PEDIDO p ON p.ID_PEDIDO=er.ID_PEDIDO
        WHERE er.ID_EJECUCION_RUTA=:ejecucion ORDER BY er.POSICION FETCH FIRST 1 ROW ONLY`, { ejecucion: ejecucion.ID_EJECUCION_RUTA }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (!jornada.rows[0]) throw new Error(`La ejecución ${ejecucion.ID_EJECUCION_RUTA} no tiene entregas para determinar la jornada.`);
      await conexion.execute(`UPDATE EJECUCION_RUTA SET ID_JORNADA=:jornada WHERE ID_EJECUCION_RUTA=:ejecucion`, { jornada: jornada.rows[0].ID_JORNADA, ejecucion: ejecucion.ID_EJECUCION_RUTA });
    }
    const invalida = await conexion.execute(`SELECT 1 FROM EJECUCION_RUTA e LEFT JOIN JORNADA j ON j.ID_JORNADA=e.ID_JORNADA WHERE e.ID_JORNADA IS NULL OR j.ID_JORNADA IS NULL FETCH FIRST 1 ROW ONLY`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    if (invalida.rows.length) throw new Error('No fue posible asociar una jornada válida a todas las ejecuciones existentes.');
    const restricciones = await conexion.execute(`SELECT CONSTRAINT_NAME FROM USER_CONSTRAINTS WHERE TABLE_NAME='EJECUCION_RUTA' AND CONSTRAINT_NAME IN ('FK_EJEC_RUTA_JORNADA','NN_EJEC_RUTA_JORNADA')`, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    const existentes = new Set(restricciones.rows.map(fila => fila.CONSTRAINT_NAME));
    if (!existentes.has('NN_EJEC_RUTA_JORNADA')) await conexion.execute('ALTER TABLE EJECUCION_RUTA MODIFY (ID_JORNADA NOT NULL)');
    if (!existentes.has('FK_EJEC_RUTA_JORNADA')) await conexion.execute('ALTER TABLE EJECUCION_RUTA ADD CONSTRAINT FK_EJEC_RUTA_JORNADA FOREIGN KEY (ID_JORNADA) REFERENCES JORNADA(ID_JORNADA)');
    await conexion.commit();
    console.log('Jornada incorporada a las ejecuciones de ruta.');
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    await conexion.close();
    await oracledb.getPool().close(0);
  }
}

ejecutar().catch(error => { console.error(error.message); process.exitCode = 1; });
