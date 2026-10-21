// Sprint 5 · Reglas del portal de licitaciones, compartidas por la app (Jest/Expo) y las Edge Functions (Deno).
// Sin imports, igual que calculo.ts. Las mismas reglas están en SQL (estado_vigencia, generar_alertas_vencimiento).

// ─── Vigencias (HU-28 · HU-29) ────────────────────────────────

/** Un documento está "por vencer" desde la primera alerta (60 días antes). */
export const DIAS_POR_VENCER = 60;
/** Umbrales de alerta en días antes del vencimiento; 0 = vence hoy o ya venció. */
export const UMBRALES_ALERTA = [60, 30, 15, 0] as const;

export const ESTADOS_VIGENCIA = ['vigente', 'por_vencer', 'vencido', 'sin_vigencia'] as const;
export type EstadoVigencia = (typeof ESTADOS_VIGENCIA)[number];

const MS_DIA = 86_400_000;

/** Días de `desde` a `hasta` (fechas AAAA-MM-DD); negativo si `hasta` ya pasó. */
export function diasHasta(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MS_DIA);
}

export function estadoVigencia(vence: string | null | undefined, hoy: string): EstadoVigencia {
  if (!vence) return 'sin_vigencia';
  const dias = diasHasta(hoy, vence);
  if (dias < 0) return 'vencido';
  return dias <= DIAS_POR_VENCER ? 'por_vencer' : 'vigente';
}

/** Umbral de alerta que corresponde hoy (el más cercano ya alcanzado) o null si aún falta. */
export function umbralAlerta(vence: string, hoy: string): number | null {
  const dias = diasHasta(hoy, vence);
  const alcanzados = UMBRALES_ALERTA.filter((u) => dias <= u);
  return alcanzados.length ? Math.min(...alcanzados) : null;
}

// ─── Lista de verificación (HU-32) ────────────────────────────

/**
 * cumple: documento vigente en la fecha de cierre (o requisito marcado a mano) ·
 * vence_antes_cierre: hoy está vigente pero vence antes del cierre · vencido: ya venció ·
 * pendiente: sin documento ni marca.
 */
export type EstadoItem = 'cumple' | 'vence_antes_cierre' | 'vencido' | 'pendiente';

export type ItemEvaluable = {
  documento_id: string | null;
  cumplido_manual: boolean;
  obligatorio: boolean;
};

/** `vence`: fecha de vencimiento del documento vinculado (null si no vence). */
export function estadoItem(item: ItemEvaluable, vence: string | null, hoy: string, cierre: string): EstadoItem {
  if (!item.documento_id) return item.cumplido_manual ? 'cumple' : 'pendiente';
  if (vence && vence < hoy) return 'vencido';
  if (vence && vence < cierre) return 'vence_antes_cierre';
  return 'cumple';
}

export type Cumplimiento = {
  total: number;
  cumplidos: number;
  porcentaje: number;
  obligatoriosPendientes: number;
};

export function cumplimiento(items: readonly { estado: EstadoItem; obligatorio: boolean }[]): Cumplimiento {
  const cumplidos = items.filter((i) => i.estado === 'cumple').length;
  return {
    total: items.length,
    cumplidos,
    porcentaje: items.length ? Math.floor((cumplidos * 100) / items.length) : 0,
    obligatoriosPendientes: items.filter((i) => i.obligatorio && i.estado !== 'cumple').length,
  };
}

// ─── Paquete de documentos (HU-33) ────────────────────────────

/** Tamaño máximo del ZIP que arma la Edge Function (memoria de la función). */
export const MAX_PAQUETE_BYTES = 100 * 1024 * 1024;

export type ProblemasPaquete<T> = { vencidos: T[]; venceAntesCierre: T[]; sinDocumento: T[] };

/** Lo que hay que advertir antes de descargar: documentos vencidos, que vencen antes del cierre o faltantes. */
export function problemasPaquete<T extends { estado: EstadoItem; documento_id: string | null }>(
  items: readonly T[],
): ProblemasPaquete<T> {
  return {
    vencidos: items.filter((i) => i.estado === 'vencido'),
    venceAntesCierre: items.filter((i) => i.estado === 'vence_antes_cierre'),
    sinDocumento: items.filter((i) => i.estado === 'pendiente'),
  };
}

/** "Cámara de Comercio (vigente)" → "03-camara-de-comercio-vigente.pdf" */
export function nombreEnPaquete(posicion: number, requisito: string, extension: string): string {
  const base = requisito
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${String(posicion).padStart(2, '0')}-${base || 'documento'}.${extension}`;
}
