// HU-09 rutas · HU-10 tarifas · HU-13 cliente del cotizador.
import { cotizar, formatearDecimal, formatearPesos } from '../cotizador';
import { RUTA_VACIA, formularioARuta, validarRuta } from '../rutas';
import {
  MENSAJE_SUPERPOSICION,
  TARIFA_VACIA,
  estadoVigencia,
  formularioATarifa,
  validarTarifa,
  vigenciasSeSuperponen,
  type Tarifa,
} from '../tarifas';

const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

beforeEach(() => jest.clearAllMocks());

describe('rutas (HU-09)', () => {
  const valida = { ...RUTA_VACIA, origen: 'La Hormiga', destino: 'Mocoa', distanciaKm: '132,5', peajes: '18.000' };

  it('acepta una ruta válida y normaliza decimales y pesos', () => {
    expect(validarRuta(valida)).toEqual({});
    expect(formularioARuta({ ...valida, duracionHoras: '3.5' })).toEqual({
      origen: 'La Hormiga',
      destino: 'Mocoa',
      distancia_km: 132.5,
      duracion_horas: 3.5,
      peajes: 18000,
      activo: true,
    });
  });

  it('rechaza origen igual a destino, distancia inválida y peajes vacíos', () => {
    expect(validarRuta({ ...valida, destino: ' la hormiga ' }).destino).toBe(
      'El destino debe ser distinto del origen',
    );
    expect(validarRuta({ ...valida, distanciaKm: '0' }).distanciaKm).toBeDefined();
    expect(validarRuta({ ...valida, distanciaKm: 'abc' }).distanciaKm).toBeDefined();
    expect(validarRuta({ ...valida, peajes: '' }).peajes).toBeDefined();
    expect(validarRuta({ ...valida, duracionHoras: '-1' }).duracionHoras).toBeDefined();
  });
});

describe('tarifas (HU-10)', () => {
  const tarifa = (desde: string, hasta: string | null, tipo = 'van', id = 'x'): Tarifa => ({
    id,
    tipo_vehiculo: tipo,
    tarifa_base: 1,
    valor_km: 1,
    valor_dia: 1,
    recargo_fin_semana_pct: 0,
    vigencia_desde: desde,
    vigencia_hasta: hasta,
    created_at: '',
    updated_at: '',
  });
  const valida = {
    ...TARIFA_VACIA,
    tarifaBase: '$ 150.000',
    valorKm: '2500',
    valorDia: '200.000',
    recargoFinSemana: '20',
    vigenciaDesde: '2026-01-01',
    vigenciaHasta: '2026-06-30',
  };

  it.each([
    [['2026-01-01', '2026-06-30'], ['2026-06-30', null], true],
    [['2026-01-01', '2026-06-30'], ['2026-07-01', null], false],
    [['2026-01-01', null], ['2030-01-01', '2030-12-31'], true],
    [['2026-03-01', '2026-03-31'], ['2026-01-01', '2026-12-31'], true],
    [['2026-03-01', '2026-03-31'], ['2026-04-01', '2026-04-30'], false],
  ] as const)('superposición de %j y %j = %s', ([ad, ah], [bd, bh], esperado) => {
    expect(vigenciasSeSuperponen({ desde: ad, hasta: ah }, { desde: bd, hasta: bh })).toBe(esperado);
    expect(vigenciasSeSuperponen({ desde: bd, hasta: bh }, { desde: ad, hasta: ah })).toBe(esperado);
  });

  it('acepta una tarifa válida y convierte los pesos', () => {
    expect(validarTarifa(valida)).toEqual({});
    expect(formularioATarifa(valida)).toEqual({
      tipo_vehiculo: 'van',
      tarifa_base: 150000,
      valor_km: 2500,
      valor_dia: 200000,
      recargo_fin_semana_pct: 20,
      vigencia_desde: '2026-01-01',
      vigencia_hasta: '2026-06-30',
    });
  });

  it('no permite vigencias superpuestas del mismo tipo de vehículo', () => {
    const existentes = [tarifa('2026-06-01', null, 'van', 'otra')];
    expect(validarTarifa(valida, existentes).vigenciaDesde).toBe(MENSAJE_SUPERPOSICION);
    // Otro tipo de vehículo, o la misma tarifa en edición, no cuentan.
    expect(validarTarifa(valida, [tarifa('2026-06-01', null, 'bus')])).toEqual({});
    expect(validarTarifa(valida, existentes, 'otra')).toEqual({});
  });

  it('rechaza "hasta" anterior a "desde" y valores fuera de rango', () => {
    expect(validarTarifa({ ...valida, vigenciaHasta: '2025-12-31' }).vigenciaHasta).toBeDefined();
    expect(validarTarifa({ ...valida, recargoFinSemana: '101' }).recargoFinSemana).toBeDefined();
    expect(validarTarifa({ ...valida, valorKm: '-5' }).valorKm).toBeDefined();
    expect(validarTarifa({ ...valida, vigenciaDesde: '' }).vigenciaDesde).toBeDefined();
  });

  it('clasifica la vigencia', () => {
    const hoy = '2026-10-14';
    expect(estadoVigencia(tarifa('2026-01-01', null), hoy)).toBe('vigente');
    expect(estadoVigencia(tarifa('2026-01-01', '2026-10-14'), hoy)).toBe('vigente');
    expect(estadoVigencia(tarifa('2026-11-01', null), hoy)).toBe('futura');
    expect(estadoVigencia(tarifa('2026-01-01', '2026-10-13'), hoy)).toBe('vencida');
  });
});

describe('cotizador (HU-13)', () => {
  it('formatea pesos colombianos y decimales', () => {
    expect(formatearPesos(1809750)).toBe('$ 1.809.750');
    expect(formatearPesos(0)).toBe('$ 0');
    expect(formatearPesos(999)).toBe('$ 999');
    expect(formatearDecimal(132.5)).toBe('132,5');
  });

  const peticion = {
    ruta_id: 'r',
    tipo_servicio: 'ida' as const,
    fecha_inicio: '2026-10-21',
    pasajeros: 3,
  };

  it('invoca calcular-tarifa y devuelve la cotización', async () => {
    mockInvoke.mockResolvedValue({ data: { codigo: 'COT-000001' }, error: null });
    const r = await cotizar(peticion);
    expect(mockInvoke).toHaveBeenCalledWith('calcular-tarifa', { body: peticion, region: 'us-west-2' });
    expect(r).toEqual({ ok: true, data: { codigo: 'COT-000001' } });
  });

  it('muestra el mensaje de negocio que envía la función', async () => {
    const { FunctionsHttpError } = jest.requireActual('@supabase/supabase-js');
    const respuesta = new Response(JSON.stringify({ error: 'La ruta no existe o no está disponible' }), {
      status: 404,
    });
    mockInvoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(respuesta) });
    expect(await cotizar(peticion)).toEqual({ ok: false, error: 'La ruta no existe o no está disponible' });
  });
});
