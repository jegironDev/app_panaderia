import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { CrearReceta } from './crear-receta/crear-receta';
import { Recetas } from './recetas/recetas';
import { Inicio } from '../inicio/inicio';

const detectorCambios = { markForCheck: vi.fn() };

describe('gestión de recetas', () => {
  it('asigna la unidad real del ingrediente seleccionado', () => {
    const api = {};
    const componente = new CrearReceta(api as any, {} as any, detectorCambios as any);
    componente.productosIngredientes = [{
      ID_PRODUCTO: 6, NOMBRE: 'Harina de trigo', TIPO: 'MAT', PRECIO: 1,
      ID_UNIDAD_MEDIDA: 5, NOMBRE_UNIDAD_MEDIDA: 'Kilogramo', ABREVIATURA: 'kg',
    }];
    componente.agregarIngrediente();
    componente.ingredientes[0].identificadorProducto = '6' as unknown as number;

    componente.onProductoIngredienteChange(0);

    expect(componente.ingredientes[0]).toMatchObject({
      identificadorProducto: 6, identificadorUnidadMedida: 5, abreviaturaUnidad: 'kg',
    });
  });

  it('no envía PATCH al cancelar el diálogo de estado', () => {
    const api = { cambiarEstadoReceta: vi.fn(() => of({})) };
    const componente = new Recetas(api as any, {} as any, detectorCambios as any);

    componente.confirmarCambioEstado(3, 'A');
    componente.cancelarConfirmacion();

    expect(api.cambiarEstadoReceta).not.toHaveBeenCalled();
    expect(componente.mostrarDialogoConfirmacion).toBe(false);
  });

  it('confirma la desactivación con el estado inactivo', () => {
    const api = { cambiarEstadoReceta: vi.fn(() => of({})), recetas: vi.fn(() => of([])) };
    const componente = new Recetas(api as any, {} as any, detectorCambios as any);

    componente.confirmarCambioEstado(3, 'A');
    componente.ejecutarAccionPendiente();

    expect(api.cambiarEstadoReceta).toHaveBeenCalledWith(3, 'I');
  });

  it('muestra el nombre disponible en la sesión, sin derivarlo del usuario', () => {
    const inicio = new Inicio({ obtenerNombreSesion: () => 'Jonathan' } as any);
    expect(inicio.obtenerSaludo()).toBe('Bienvenido/a Jonathan');
  });
});
