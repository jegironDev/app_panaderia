import { describe, expect, it } from 'vitest';
import { nuevaSucursalEdicion, sucursalEditable } from './sucursales';

describe('Gestión de sucursales', () => {
  it('permite acciones únicamente sobre sucursales activas', () => {
    expect(sucursalEditable({ ID_SUCURSAL: 1, NOMBRE: 'Centro', ESTADO: 'A' })).toBe(true);
    expect(sucursalEditable({ ID_SUCURSAL: 2, NOMBRE: 'Norte', ESTADO: 'I' })).toBe(false);
  });

  it('inicia la creación como sucursal activa sin identificador técnico', () => {
    expect(nuevaSucursalEdicion()).toEqual({ ID_SUCURSAL: 0, NOMBRE: '', ESTADO: 'A' });
  });
});
