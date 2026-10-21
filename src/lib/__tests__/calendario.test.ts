import { aTexto, fechaCorta, fechaLarga, fueraDeRango, leerFecha, moverMes, semanasDelMes } from '@/lib/calendario';

describe('calendario', () => {
  test('lee solo fechas AAAA-MM-DD reales', () => {
    expect(leerFecha('2026-10-21')).toEqual({ anio: 2026, mes: 9, dia: 21 });
    expect(leerFecha('2026-02-29')).toBeNull();
    expect(leerFecha('2028-02-29')).toEqual({ anio: 2028, mes: 1, dia: 29 });
    expect(leerFecha('21/10/2026')).toBeNull();
    expect(leerFecha('')).toBeNull();
  });

  test('aTexto rellena con ceros', () => {
    expect(aTexto(2026, 0, 5)).toBe('2026-01-05');
  });

  test('moverMes cruza años en ambos sentidos', () => {
    expect(moverMes({ anio: 2026, mes: 11 }, 1)).toEqual({ anio: 2027, mes: 0 });
    expect(moverMes({ anio: 2026, mes: 0 }, -1)).toEqual({ anio: 2025, mes: 11 });
    expect(moverMes({ anio: 2026, mes: 5 }, -18)).toEqual({ anio: 2024, mes: 11 });
  });

  test('semanas empiezan en lunes y completan filas de 7', () => {
    // Octubre de 2026 empieza en jueves y tiene 31 días
    const semanas = semanasDelMes({ anio: 2026, mes: 9 });
    expect(semanas[0]).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(semanas.every((s) => s.length === 7)).toBe(true);
    expect(semanas.flat().filter(Boolean)).toHaveLength(31);
    // Febrero de 2027 empieza en lunes: sin huecos al inicio
    expect(semanasDelMes({ anio: 2027, mes: 1 })[0][0]).toBe(1);
  });

  test('formatos legibles en español', () => {
    expect(fechaLarga('2026-10-21')).toBe('mié. 21 de octubre de 2026');
    expect(fechaCorta('2026-01-05')).toBe('5 ene. 2026');
    expect(fechaCorta('texto')).toBe('texto');
  });

  test('rango inclusivo con límites opcionales', () => {
    expect(fueraDeRango('2026-10-20', '2026-10-21')).toBe(true);
    expect(fueraDeRango('2026-10-21', '2026-10-21', '2026-10-21')).toBe(false);
    expect(fueraDeRango('2026-10-22', undefined, '2026-10-21')).toBe(true);
    expect(fueraDeRango('1990-01-01')).toBe(false);
  });
});
