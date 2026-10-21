// HU-11 a HU-14 · Lógica del cotizador compartida con la Edge Function calcular-tarifa.
import {
  calcularCotizacion,
  diasEntre,
  diasFinDeSemana,
  elegirVehiculo,
  hoyEnColombia,
  sumarDias,
  validarSolicitud,
  type TarifaCalculo,
} from '../../../supabase/functions/_shared/calculo';

const van: TarifaCalculo = {
  id: 't-van',
  tipo_vehiculo: 'van',
  tarifa_base: 150_000,
  valor_km: 2_500,
  valor_dia: 200_000,
  recargo_fin_semana_pct: 20,
};
const ruta = { distancia_km: 132.5, peajes: 18_000 };
const RUTA_ID = '3f1c2a8e-4b5d-4c6e-8f70-1a2b3c4d5e6f';

describe('fechas', () => {
  it('usa la fecha de Colombia (UTC-5)', () => {
    expect(hoyEnColombia(new Date('2026-10-15T03:00:00Z'))).toBe('2026-10-14');
    expect(hoyEnColombia(new Date('2026-10-15T06:00:00Z'))).toBe('2026-10-15');
  });

  it('cuenta los días de servicio incluyendo el primero y el último', () => {
    expect(diasEntre('2026-10-21', '2026-10-21')).toBe(1);
    expect(diasEntre('2026-10-30', '2026-11-02')).toBe(4);
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('cuenta sábados y domingos', () => {
    expect(diasFinDeSemana('2026-10-21', '2026-10-21')).toBe(0); // miércoles
    expect(diasFinDeSemana('2026-10-16', '2026-10-19')).toBe(2); // vie → lun
    expect(diasFinDeSemana('2026-10-17', '2026-10-17')).toBe(1); // sábado
  });
});

describe('validarSolicitud (HU-11)', () => {
  const hoy = '2026-10-14';
  const base = {
    ruta_id: RUTA_ID,
    tipo_servicio: 'ida',
    fecha_inicio: '2026-10-21',
    pasajeros: 12,
  };

  it('acepta una solicitud válida y en "ida" ignora la fecha final', () => {
    const r = validarSolicitud({ ...base, fecha_fin: '2026-10-25' }, hoy);
    expect(r).toEqual({ ok: true, data: { ...base, fecha_fin: '2026-10-21' } });
  });

  it('ida y vuelta sin fecha de regreso = mismo día', () => {
    const r = validarSolicitud({ ...base, tipo_servicio: 'ida_vuelta', fecha_fin: null }, hoy);
    expect(r.ok && r.data.fecha_fin).toBe('2026-10-21');
  });

  it.each([
    [{ ruta_id: 'abc' }, 'Selecciona una ruta'],
    [{ tipo_servicio: 'charter' }, 'Selecciona el tipo de servicio'],
    [{ fecha_inicio: '2026-02-30' }, 'Fecha del servicio no válida'],
    [{ fecha_inicio: '2026-10-13' }, 'La fecha del servicio ya pasó'],
    [{ tipo_servicio: 'disponibilidad', fecha_fin: '2026-10-20' }, 'La fecha final debe ser igual o posterior al inicio'],
    [{ tipo_servicio: 'disponibilidad', fecha_fin: '2026-11-30' }, 'El servicio puede durar máximo 30 días'],
    [{ pasajeros: 0 }, 'Entre 1 y 80 pasajeros'],
    [{ pasajeros: 81 }, 'Entre 1 y 80 pasajeros'],
    [{ pasajeros: '12' }, 'Entre 1 y 80 pasajeros'],
    [{ pasajeros: 2.5 }, 'Entre 1 y 80 pasajeros'],
  ])('rechaza %j', (cambio, error) => {
    expect(validarSolicitud({ ...base, ...cambio }, hoy)).toEqual({ ok: false, error });
  });

  it('rechaza cuerpos que no son objetos', () => {
    expect(validarSolicitud(null, hoy)).toEqual({ ok: false, error: 'Solicitud inválida' });
    expect(validarSolicitud('hola', hoy)).toEqual({ ok: false, error: 'Solicitud inválida' });
  });
});

describe('elegirVehiculo (HU-12)', () => {
  const bus: TarifaCalculo = { ...van, id: 't-bus', tipo_vehiculo: 'bus' };
  const flota = [
    { tipo: 'bus', capacidad_pasajeros: 40 },
    { tipo: 'van', capacidad_pasajeros: 15 },
    { tipo: 'camioneta', capacidad_pasajeros: 4 },
  ];

  it('sugiere el vehículo más pequeño que lleva a todos', () => {
    expect(elegirVehiculo(flota, [van, bus], 12)?.vehiculo.tipo).toBe('van');
    expect(elegirVehiculo(flota, [van, bus], 16)?.vehiculo.tipo).toBe('bus');
  });

  it('omite tipos sin tarifa vigente', () => {
    // La camioneta alcanza para 3, pero no tiene tarifa: se sugiere la van.
    const r = elegirVehiculo(flota, [van, bus], 3);
    expect(r?.vehiculo.tipo).toBe('van');
    expect(r?.tarifa.id).toBe('t-van');
  });

  it('devuelve null si nadie tiene capacidad', () => {
    expect(elegirVehiculo(flota, [van, bus], 41)).toBeNull();
    expect(elegirVehiculo([], [van], 1)).toBeNull();
  });
});

describe('calcularCotizacion (HU-13 · HU-14)', () => {
  const subtotales = (r: ReturnType<typeof calcularCotizacion>) =>
    Object.fromEntries(r.desglose.map((l) => [l.concepto, l.subtotal]));

  it('solo ida entre semana: base + km + 1 día + peajes, sin recargo', () => {
    const r = calcularCotizacion({
      tipo_servicio: 'ida',
      fecha_inicio: '2026-10-21',
      fecha_fin: '2026-10-21',
      ruta,
      tarifa: van,
    });
    expect(r.trayectos).toBe(1);
    expect(r.distancia_km).toBe(132.5);
    expect(subtotales(r)).toEqual({
      tarifa_base: 150_000,
      kilometraje: 331_250,
      dias: 200_000,
      peajes: 18_000,
      recargo: 0,
    });
    expect(r.valor_total).toBe(699_250);
  });

  it('ida y vuelta vie → lun: distancia y peajes dobles, recargo por 2 días de fin de semana', () => {
    const r = calcularCotizacion({
      tipo_servicio: 'ida_vuelta',
      fecha_inicio: '2026-10-16',
      fecha_fin: '2026-10-19',
      ruta,
      tarifa: van,
    });
    expect(r.distancia_km).toBe(265);
    expect(r.dias).toBe(4);
    expect(r.dias_fin_semana).toBe(2);
    // (150.000 + 662.500 + 800.000) × 20 % / 4 días = 80.625 por día de fin de semana
    expect(subtotales(r)).toEqual({
      tarifa_base: 150_000,
      kilometraje: 662_500,
      dias: 800_000,
      peajes: 36_000,
      recargo: 161_250,
    });
    expect(r.valor_total).toBe(1_809_750);
  });

  it('servicio de un día en sábado lleva el recargo completo', () => {
    const r = calcularCotizacion({
      tipo_servicio: 'ida',
      fecha_inicio: '2026-10-17',
      fecha_fin: '2026-10-17',
      ruta,
      tarifa: van,
    });
    expect(subtotales(r).recargo).toBe(136_250);
    expect(r.valor_total).toBe(835_500);
  });

  it('el total siempre es la suma del desglose y cada subtotal cuadra con cantidad × unitario', () => {
    const r = calcularCotizacion({
      tipo_servicio: 'disponibilidad',
      fecha_inicio: '2026-10-14',
      fecha_fin: '2026-10-26',
      ruta: { distancia_km: 47.3, peajes: 9_700 },
      tarifa: { ...van, valor_km: 2_333, recargo_fin_semana_pct: 15 },
    });
    expect(r.valor_total).toBe(r.desglose.reduce((s, l) => s + l.subtotal, 0));
    for (const l of r.desglose.filter((x) => x.concepto !== 'kilometraje')) {
      expect(l.subtotal).toBe(l.cantidad * l.valor_unitario);
    }
    expect(r.desglose.map((l) => l.concepto)).toEqual([
      'tarifa_base',
      'kilometraje',
      'dias',
      'peajes',
      'recargo',
    ]);
  });
});
