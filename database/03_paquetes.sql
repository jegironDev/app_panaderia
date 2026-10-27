-- Paquetes de demostración para Oracle 21c XE.
-- El backend decide cuándo hacer COMMIT o ROLLBACK de una operación completa.
-- Los errores se elevan a Express (no se ocultan con WHEN OTHERS).
CREATE OR REPLACE PACKAGE PKG_CONSULTAS AS
 PROCEDURE OBTENER_PRODUCTOS(p_cursor OUT SYS_REFCURSOR);
 PROCEDURE OBTENER_STOCK(p_cursor OUT SYS_REFCURSOR);
END PKG_CONSULTAS;
/
CREATE OR REPLACE PACKAGE BODY PKG_CONSULTAS AS
 PROCEDURE OBTENER_PRODUCTOS(p_cursor OUT SYS_REFCURSOR) IS
 BEGIN
  OPEN p_cursor FOR SELECT ID_PRODUCTO,NOMBRE,TIPO,PRECIO
    FROM PRODUCTO WHERE ESTADO='A' ORDER BY NOMBRE;
 END OBTENER_PRODUCTOS;
 PROCEDURE OBTENER_STOCK(p_cursor OUT SYS_REFCURSOR) IS
 BEGIN
  OPEN p_cursor FOR SELECT * FROM VW_STOCK_DISPONIBLE ORDER BY NOMBRE;
 END OBTENER_STOCK;
END PKG_CONSULTAS;
/

CREATE OR REPLACE PACKAGE PKG_INVENTARIO AS
 -- Cambia existencias con bloqueo para impedir operaciones simultáneas incorrectas.
 -- p_delta positivo: ingreso; negativo: salida.
 PROCEDURE AJUSTAR_EXISTENCIA(p_id_producto IN NUMBER,
                              p_delta IN NUMBER,
                              p_id_usuario IN NUMBER);
END PKG_INVENTARIO;
/
CREATE OR REPLACE PACKAGE BODY PKG_INVENTARIO AS
 PROCEDURE AJUSTAR_EXISTENCIA(p_id_producto IN NUMBER,
                              p_delta IN NUMBER,
                              p_id_usuario IN NUMBER) IS
  v_id_inventario INVENTARIO.ID_INVENTARIO%TYPE;
  v_anterior INVENTARIO.CANTIDAD%TYPE;
  v_reservada INVENTARIO.CANTIDAD_RESERVADA%TYPE;
  v_nueva INVENTARIO.CANTIDAD%TYPE;
 BEGIN
  IF p_delta IS NULL OR p_delta = 0 THEN
   RAISE_APPLICATION_ERROR(-20001,'La cantidad de ajuste debe ser distinta de cero');
  END IF;
  SELECT ID_INVENTARIO,CANTIDAD,CANTIDAD_RESERVADA
   INTO v_id_inventario,v_anterior,v_reservada
   FROM INVENTARIO WHERE ID_PRODUCTO=p_id_producto AND ESTADO='A'
   FOR UPDATE;
  v_nueva := v_anterior+p_delta;
  IF v_nueva < 0 OR v_nueva < v_reservada THEN
   RAISE_APPLICATION_ERROR(-20002,'Existencias insuficientes o reservadas');
  END IF;
  UPDATE INVENTARIO SET CANTIDAD=v_nueva WHERE ID_INVENTARIO=v_id_inventario;
  INSERT INTO DETALLE_INVENTARIO
   (ID_INVENTARIO,ID_USUARIO,ORIGEN,ID_REFERENCIA,TIPO_MOVIMIENTO,EXISTENCIA_ANTERIOR,EXISTENCIA_NUEVA)
  VALUES(v_id_inventario,p_id_usuario,'AJUSTE',NULL,
         CASE WHEN p_delta>0 THEN 'ENTRADA' ELSE 'SALIDA' END,v_anterior,v_nueva);
 EXCEPTION
  WHEN NO_DATA_FOUND THEN
   RAISE_APPLICATION_ERROR(-20003,'Inventario activo no encontrado');
  WHEN OTHERS THEN RAISE; -- Propaga el error; Express ejecuta ROLLBACK.
 END AJUSTAR_EXISTENCIA;
END PKG_INVENTARIO;
/


