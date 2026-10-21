// Sprint 2 · Lógica pura del cotizador: HU-11 validación de la solicitud, HU-12 sugerencia de
// vehículo, HU-13 cálculo y HU-14 desglose.
// La usan la Edge Function calcular-tarifa (Deno) y la app (validación y pruebas con Jest),
// por eso no tiene imports: debe compilar igual en ambos entornos.
//
// valor_total = tarifa_base + (distancia × valor_km) + (dias × valor_dia) + peajes + recargos

export const TIPOS_SERVICIO = ['ida', 'ida_vuelta', 'disponibilidad'] as const;
export type TipoServicio = (typeof TIPOS_SERVICIO)[number];

export const MAX_DIAS = 30;
export const MAX_PASAJEROS = 80;

export type Concepto = 'tarifa_base' | 'kilometraje' | 'dias' | 'peajes' | 'recargo';

export type LineaDesglose = {
  concepto: Concepto;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  subtotal: number;
};

export type TarifaCalculo = {
  id: string;
  tipo_vehiculo: string;
  tarifa_base: number;
  valor_km: number;
  valor_dia: number;
  recargo_fin_semana_pct: number;
};

export type RutaCalculo = { distancia_km: number; peajes: number };

export type VehiculoCalculo = { tipo: string; capacidad_pasajeros: number };

/** Cuerpo de la petición a calcular-tarifa (snake_case, igual que la base de datos). */
export type SolicitudCotizacion = {
  ruta_id: string;
  tipo_servicio: TipoServicio;
  fecha_inicio: string;
  /** Último día de servicio. En "ida" siempre es igual a fecha_inicio. */
  fecha_fin: string;
  pasajeros: number;
};

// ─── Fechas (AAAA-MM-DD, sin zona horaria) ────────────────────

const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_DIA = 86_400_000;

function aUTC(fecha: string): number | null {
  const m = FECHA_RE.exec(fecha);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return t;
}

export function esFechaValida(fecha: string): boolean {
  return aUTC(fecha) !== null;
}

/** Fecha actual en Colombia (UTC-5 todo el año, sin horario de verano). */
export function hoyEnColombia(ahora = new Date()): string {
  return new Date(ahora.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  return new Date((aUTC(fecha) as number) + dias * MS_DIA).toISOString().slice(0, 10);
}

/** Días de servicio contando el primero y el último. */
export function diasEntre(inicio: string, fin: string): number {
  return Math.round(((aUTC(fin) as number) - (aUTC(inicio) as number)) / MS_DIA) + 1;
}

/** Cuántos de los días de servicio caen en sábado o domingo. */
export function diasFinDeSemana(inicio: string, fin: string): number {
  const desde = aUTC(inicio) as number;
  let total = 0;
  for (let i = 0; i < diasEntre(inicio, fin); i++) {
    const dia = new Date(desde + i * MS_DIA).getUTCDay();
    if (dia === 0 || dia === 6) total++;
  }
  return total;
}

// ─── Validación de la solicitud (HU-11) ───────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Validacion<T> = { ok: true; data: T } | { ok: false; error: string };

export function validarSolicitud(body: unknown, hoy: string): Validacion<SolicitudCotizacion> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Solicitud inválida' };
  const b = body as Record<string, unknown>;

  if (typeof b.ruta_id !== 'string' || !UUID_RE.test(b.ruta_id)) {
    return { ok: false, error: 'Selecciona una ruta' };
  }
  const tipo = b.tipo_servicio;
  if (typeof tipo !== 'string' || !(TIPOS_SERVICIO as readonly string[]).includes(tipo)) {
    return { ok: false, error: 'Selecciona el tipo de servicio' };
  }
  const inicio = b.fecha_inicio;
  if (typeof inicio !== 'string' || !esFechaValida(inicio)) {
    return { ok: false, error: 'Fecha del servicio no válida' };
  }
  if (inicio < hoy) return { ok: false, error: 'La fecha del servicio ya pasó' };

  let fin = inicio;
  if (tipo !== 'ida' && b.fecha_fin != null && b.fecha_fin !== '') {
    if (typeof b.fecha_fin !== 'string' || !esFechaValida(b.fecha_fin)) {
      return { ok: false, error: 'Fecha final no válida' };
    }
    fin = b.fecha_fin;
  }
  if (fin < inicio) return { ok: false, error: 'La fecha final debe ser igual o posterior al inicio' };
  if (diasEntre(inicio, fin) > MAX_DIAS) {
    return { ok: false, error: `El servicio puede durar máximo ${MAX_DIAS} días` };
  }

  const pasajeros = b.pasajeros;
  if (
    typeof pasajeros !== 'number' ||
    !Number.isInteger(pasajeros) ||
    pasajeros < 1 ||
    pasajeros > MAX_PASAJEROS
  ) {
    return { ok: false, error: `Entre 1 y ${MAX_PASAJEROS} pasajeros` };
  }

  return {
    ok: true,
    data: {
      ruta_id: b.ruta_id,
      tipo_servicio: tipo as TipoServicio,
      fecha_inicio: inicio,
      fecha_fin: fin,
      pasajeros,
    },
  };
}

// ─── Sugerencia de vehículo (HU-12) ───────────────────────────

/**
 * Elige el vehículo disponible más pequeño que lleve a todos los pasajeros
 * y cuyo tipo tenga una tarifa vigente.
 */
export function elegirVehiculo<V extends VehiculoCalculo, T extends TarifaCalculo>(
  vehiculos: readonly V[],
  tarifasVigentes: readonly T[],
  pasajeros: number,
): { vehiculo: V; tarifa: T } | null {
  const candidatos = vehiculos
    .filter((v) => v.capacidad_pasajeros >= pasajeros)
    .sort((a, b) => a.capacidad_pasajeros - b.capacidad_pasajeros);
  for (const vehiculo of candidatos) {
    const tarifa = tarifasVigentes.find((t) => t.tipo_vehiculo === vehiculo.tipo);
    if (tarifa) return { vehiculo, tarifa };
  }
  return null;
}

// ─── Cálculo y desglose (HU-13 · HU-14) ───────────────────────

export type ResultadoCalculo = {
  /** 1 en "ida"; 2 cuando el vehículo vuelve al origen. */
  trayectos: number;
  distancia_km: number;
  dias: number;
  dias_fin_semana: number;
  desglose: LineaDesglose[];
  valor_total: number;
};

export function calcularCotizacion(p: {
  tipo_servicio: TipoServicio;
  fecha_inicio: string;
  fecha_fin: string;
  ruta: RutaCalculo;
  tarifa: TarifaCalculo;
}): ResultadoCalculo {
  const { tarifa } = p;
  const trayectos = p.tipo_servicio === 'ida' ? 1 : 2;
  const distancia = Math.round(p.ruta.distancia_km * trayectos * 10) / 10;
  const fin = p.tipo_servicio === 'ida' ? p.fecha_inicio : p.fecha_fin;
  const dias = diasEntre(p.fecha_inicio, fin);
  const finSemana = diasFinDeSemana(p.fecha_inicio, fin);

  const base = tarifa.tarifa_base;
  const km = Math.round(distancia * tarifa.valor_km);
  const valorDias = dias * tarifa.valor_dia;
  // El recargo se aplica sobre la parte del servicio que cae en fin de semana;
  // los peajes se cobran al costo y no llevan recargo.
  const recargoPorDia = Math.round(
    ((base + km + valorDias) * tarifa.recargo_fin_semana_pct) / 100 / dias,
  );

  const desglose: LineaDesglose[] = [
    { concepto: 'tarifa_base', descripcion: 'Tarifa base', cantidad: 1, valor_unitario: base, subtotal: base },
    {
      concepto: 'kilometraje',
      descripcion: 'Recorrido (km)',
      cantidad: distancia,
      valor_unitario: tarifa.valor_km,
      subtotal: km,
    },
    {
      concepto: 'dias',
      descripcion: 'Días de servicio',
      cantidad: dias,
      valor_unitario: tarifa.valor_dia,
      subtotal: valorDias,
    },
    {
      concepto: 'peajes',
      descripcion: trayectos === 1 ? 'Peajes (un trayecto)' : 'Peajes (ida y regreso)',
      cantidad: trayectos,
      valor_unitario: p.ruta.peajes,
      subtotal: trayectos * p.ruta.peajes,
    },
    {
      concepto: 'recargo',
      descripcion: `Recargo fin de semana (${tarifa.recargo_fin_semana_pct} %)`,
      cantidad: finSemana,
      valor_unitario: recargoPorDia,
      subtotal: finSemana * recargoPorDia,
    },
  ];

  return {
    trayectos,
    distancia_km: distancia,
    dias,
    dias_fin_semana: finSemana,
    desglose,
    valor_total: desglose.reduce((total, l) => total + l.subtotal, 0),
  };
}
