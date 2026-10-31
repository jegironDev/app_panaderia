import { FechaGuatemalaPipe } from './fecha-guatemala.pipe';

describe('FechaGuatemalaPipe', () => {
  const pipe = new FechaGuatemalaPipe();

  it('convierte un timestamp UTC a la zona de Guatemala', () => {
    expect(pipe.transform('2026-10-31T15:42:03.042Z')).toBe('31-10-2026 09:42:03');
  });

  it('conserva una fecha Oracle sin hora como fecha de calendario', () => {
    expect(pipe.transform('2026-10-31')).toBe('31-10-2026');
  });
});
