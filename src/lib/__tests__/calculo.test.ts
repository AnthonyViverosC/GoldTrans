// HU-11 a HU-14 · Lógica del cotizador compartida con la Edge Function calcular-tarifa.
import {
  calcularCotizacion,
  diasEntre,
  diasFinDeSemana,
  elegirVehiculo,
  hoyEnColombia,
  sumarDias,
  tarifasAplicables,
  validarSolicitud,
  type TarifaCalculo,
} from '../../../supabase/functions/_shared/calculo';

// Valores de la cotización oficial a COOTRANSERP (docs/Ejemplos): camioneta 4x4 jornada 12 horas
// $580.000, 150 km diarios y $1.500 por km adicional.
const camioneta: TarifaCalculo = {
  id: 't-camioneta',
  tipo_vehiculo: 'camioneta',
  jornada_horas: 12,
  valor_jornada: 580_000,
  km_incluidos_dia: 150,
  valor_km_adicional: 1_500,
  recargo_fin_semana_pct: 0,
  ruta_id: null,
};
const van: TarifaCalculo = { ...camioneta, id: 't-van', tipo_vehiculo: 'van', valor_jornada: 700_000 };
const RUTA_ID = '3f1c2a8e-4b5d-4c6e-8f70-1a2b3c4d5e6f';
const OTRA_RUTA = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

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
    const r = validarSolicitud({ ...base, fecha_fin: '2026-10-25', jornada_horas: 8 }, hoy);
    expect(r).toEqual({ ok: true, data: { ...base, fecha_fin: '2026-10-21', jornada_horas: 8 } });
  });

  it('sin jornada usa 12 horas (versiones anteriores de la app)', () => {
    const r = validarSolicitud(base, hoy);
    expect(r.ok && r.data.jornada_horas).toBe(12);
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
    [{ jornada_horas: 6 }, 'La jornada debe ser de 4, 8 o 12 horas'],
    [{ jornada_horas: '12' }, 'La jornada debe ser de 4, 8 o 12 horas'],
  ])('rechaza %j', (cambio, error) => {
    expect(validarSolicitud({ ...base, ...cambio }, hoy)).toEqual({ ok: false, error });
  });

  it('rechaza cuerpos que no son objetos', () => {
    expect(validarSolicitud(null, hoy)).toEqual({ ok: false, error: 'Solicitud inválida' });
    expect(validarSolicitud('hola', hoy)).toEqual({ ok: false, error: 'Solicitud inválida' });
  });
});

describe('tarifasAplicables', () => {
  const especial: TarifaCalculo = { ...camioneta, id: 't-especial', valor_jornada: 780_000, ruta_id: RUTA_ID };
  const otraRuta: TarifaCalculo = { ...camioneta, id: 't-otra', valor_jornada: 850_000, ruta_id: OTRA_RUTA };
  const ocho: TarifaCalculo = { ...camioneta, id: 't-8h', jornada_horas: 8, valor_jornada: 450_000 };

  it('el precio especial de la ruta prevalece sobre la tarifa general', () => {
    const ids = (r: TarifaCalculo[]) => r.map((t) => t.id).sort();
    expect(ids(tarifasAplicables([camioneta, especial, van], RUTA_ID, 12))).toEqual(['t-especial', 't-van']);
    // El orden de llegada no cambia el resultado.
    expect(ids(tarifasAplicables([especial, camioneta], RUTA_ID, 12))).toEqual(['t-especial']);
  });

  it('ignora precios de otras rutas y de otras jornadas', () => {
    expect(tarifasAplicables([camioneta, otraRuta, ocho], RUTA_ID, 12).map((t) => t.id)).toEqual(['t-camioneta']);
    expect(tarifasAplicables([camioneta, ocho], RUTA_ID, 8).map((t) => t.id)).toEqual(['t-8h']);
    expect(tarifasAplicables([camioneta], RUTA_ID, 4)).toEqual([]);
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
    expect(elegirVehiculo(flota, [van, bus, camioneta], 3)?.vehiculo.tipo).toBe('camioneta');
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

  it('jornada de 12 horas dentro de los 150 km: solo el valor de la jornada (COOTRANSERP)', () => {
    const r = calcularCotizacion({
      tipo_servicio: 'ida_vuelta',
      fecha_inicio: '2026-10-21',
      fecha_fin: '2026-10-21',
      ruta: { distancia_km: 62 }, // Puerto Asís – La Hormiga
      tarifa: camioneta,
    });
    expect(r.distancia_km).toBe(124);
    expect(r.km_adicionales).toBe(0);
    expect(subtotales(r)).toEqual({ jornada: 580_000, km_adicional: 0, peajes: 0, recargo: 0 });
    expect(r.valor_total).toBe(580_000);
  });

  it('cobra solo los km que pasan de los incluidos', () => {
    const r = calcularCotizacion({
      tipo_servicio: 'ida_vuelta',
      fecha_inicio: '2026-10-21',
      fecha_fin: '2026-10-21',
      ruta: { distancia_km: 120.5 },
      tarifa: camioneta,
    });
    // 241 km recorridos − 150 incluidos = 91 km × $1.500
    expect(r.km_adicionales).toBe(91);
    expect(subtotales(r).km_adicional).toBe(136_500);
    expect(r.valor_total).toBe(716_500);
  });

  it('por días: los km incluidos se suman por cada día (FUNDESAC, $550.000 y $1.200)', () => {
    const r = calcularCotizacion({
      tipo_servicio: 'disponibilidad',
      fecha_inicio: '2026-10-19',
      fecha_fin: '2026-10-21',
      ruta: { distancia_km: 250 },
      tarifa: { ...camioneta, valor_jornada: 550_000, valor_km_adicional: 1_200 },
    });
    expect(r.dias).toBe(3);
    expect(r.km_incluidos).toBe(450);
    // 500 km − 450 incluidos = 50 km × $1.200
    expect(subtotales(r)).toEqual({ jornada: 1_650_000, km_adicional: 60_000, peajes: 0, recargo: 0 });
  });

  it('el recargo se cobra por los días de fin de semana', () => {
    const r = calcularCotizacion({
      tipo_servicio: 'disponibilidad',
      fecha_inicio: '2026-10-16',
      fecha_fin: '2026-10-19',
      ruta: { distancia_km: 50 },
      tarifa: { ...camioneta, recargo_fin_semana_pct: 20 },
    });
    // 4 jornadas × 580.000 × 20 % / 4 días = 116.000 por día; vie → lun tiene 2 de fin de semana
    expect(r.dias_fin_semana).toBe(2);
    expect(subtotales(r).recargo).toBe(232_000);
    expect(r.valor_total).toBe(2_552_000);
  });

  it('los peajes van incluidos: la línea existe pero no suma', () => {
    const r = calcularCotizacion({
      tipo_servicio: 'ida',
      fecha_inicio: '2026-10-21',
      fecha_fin: '2026-10-21',
      ruta: { distancia_km: 30 },
      tarifa: camioneta,
    });
    const peajes = r.desglose.find((l) => l.concepto === 'peajes');
    expect(peajes).toMatchObject({ cantidad: 1, valor_unitario: 0, subtotal: 0 });
  });

  it('el total siempre es la suma del desglose y cada subtotal cuadra con cantidad × unitario', () => {
    const r = calcularCotizacion({
      tipo_servicio: 'disponibilidad',
      fecha_inicio: '2026-10-14',
      fecha_fin: '2026-10-26',
      ruta: { distancia_km: 1_047.3 },
      tarifa: { ...van, valor_km_adicional: 1_333, recargo_fin_semana_pct: 15 },
    });
    expect(r.valor_total).toBe(r.desglose.reduce((s, l) => s + l.subtotal, 0));
    for (const l of r.desglose.filter((x) => x.concepto !== 'km_adicional')) {
      expect(l.subtotal).toBe(l.cantidad * l.valor_unitario);
    }
    expect(r.desglose.map((l) => l.concepto)).toEqual(['jornada', 'km_adicional', 'peajes', 'recargo']);
    expect(r.desglose[1].descripcion).toBe('Kilómetros adicionales (1.950 km incluidos)');
  });
});
