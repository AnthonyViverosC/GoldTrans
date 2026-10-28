// Utilidades del selector de fecha. Fechas como texto AAAA-MM-DD (comparables como texto), sin zona horaria.

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

/** Semana empezando en lunes, como en Colombia. */
export const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;

export type Mes = { anio: number; mes: number }; // mes 0-11

const dos = (n: number) => String(n).padStart(2, '0');

export function aTexto(anio: number, mes: number, dia: number): string {
  return `${anio}-${dos(mes + 1)}-${dos(dia)}`;
}

/** Fecha AAAA-MM-DD válida o null. */
export function leerFecha(valor: string): { anio: number; mes: number; dia: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const d = new Date(Date.UTC(anio, mes, dia));
  return d.getUTCMonth() === mes && d.getUTCDate() === dia ? { anio, mes, dia } : null;
}

export function moverMes({ anio, mes }: Mes, delta: number): Mes {
  const total = anio * 12 + mes + delta;
  return { anio: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
}

/**
 * Celdas del mes en filas de 7 (lunes a domingo); null = hueco antes del día 1 o después del último.
 */
export function semanasDelMes({ anio, mes }: Mes): (number | null)[][] {
  const primero = (new Date(Date.UTC(anio, mes, 1)).getUTCDay() + 6) % 7; // 0 = lunes
  const dias = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const celdas: (number | null)[] = [...Array(primero).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  while (celdas.length % 7) celdas.push(null);
  const semanas: (number | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}

/** "lun. 22 de octubre de 2026" */
export function fechaLarga(valor: string): string {
  const f = leerFecha(valor);
  if (!f) return valor;
  const semana = DIAS_CORTOS[new Date(Date.UTC(f.anio, f.mes, f.dia)).getUTCDay()];
  return `${semana}. ${f.dia} de ${MESES[f.mes]} de ${f.anio}`;
}

/** "22 oct. 2026" (o el texto tal cual si no es una fecha válida). */
export function fechaCorta(valor: string): string {
  const f = leerFecha(valor);
  return f ? `${f.dia} ${MESES[f.mes].slice(0, 3)}. ${f.anio}` : valor;
}

/** true si la fecha cae fuera de [minimo, maximo] (límites opcionales, inclusivos). */
export function fueraDeRango(fecha: string, minimo?: string, maximo?: string): boolean {
  return (!!minimo && fecha < minimo) || (!!maximo && fecha > maximo);
}
