// Sprint 5 · HU-28 vigencias y alertas · HU-29 tablero · HU-30 buscador · HU-31/32 procesos · HU-33 paquete.
import { filtrarDocumentos, resumenTablero, validarVigencia } from '../documentos';
import {
  PLANTILLA_REQUISITOS,
  PROCESO_VACIO,
  cumplimiento,
  diasHasta,
  estadoItem,
  estadoVigencia,
  evaluarProceso,
  nombreEnPaquete,
  problemasPaquete,
  procesoAbierto,
  umbralAlerta,
  validarProceso,
  type ItemConDocumento,
} from '../licitaciones';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-file-system', () => ({ File: class {} }));
jest.mock('expo-image-picker', () => ({}));

const HOY = '2026-10-28';

describe('HU-28 · vigencias', () => {
  it('cuenta los días entre fechas, también hacia atrás y entre años', () => {
    expect(diasHasta(HOY, '2026-10-29')).toBe(1);
    expect(diasHasta(HOY, '2026-10-18')).toBe(-10);
    expect(diasHasta('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('clasifica Vigente / Por vencer (60 días o menos) / Vencido / Sin vencimiento', () => {
    expect(estadoVigencia('2027-01-01', HOY)).toBe('vigente');
    expect(estadoVigencia('2026-12-27', HOY)).toBe('por_vencer'); // 60 días
    expect(estadoVigencia('2026-12-28', HOY)).toBe('vigente'); // 61 días
    expect(estadoVigencia(HOY, HOY)).toBe('por_vencer'); // vence hoy: aún sirve
    expect(estadoVigencia('2026-10-27', HOY)).toBe('vencido');
    expect(estadoVigencia(null, HOY)).toBe('sin_vigencia');
  });

  it('alerta a 60, 30 y 15 días, y el día que vence (igual que generar_alertas_vencimiento)', () => {
    expect(umbralAlerta('2026-12-28', HOY)).toBeNull(); // 61 días
    expect(umbralAlerta('2026-12-27', HOY)).toBe(60);
    expect(umbralAlerta('2026-11-27', HOY)).toBe(30);
    expect(umbralAlerta('2026-11-12', HOY)).toBe(15);
    expect(umbralAlerta('2026-11-01', HOY)).toBe(15);
    expect(umbralAlerta(HOY, HOY)).toBe(0);
    expect(umbralAlerta('2026-01-01', HOY)).toBe(0); // ya vencido: una sola alerta de vencimiento
  });

  it('valida la vigencia', () => {
    const ok = { fechaExpedicion: '2026-01-01', fechaVencimiento: '2027-01-01', responsableId: 'u1', notas: '' };
    expect(validarVigencia(ok)).toEqual({});
    expect(validarVigencia({ ...ok, fechaVencimiento: '2025-12-31' }).fechaVencimiento).toBe(
      'Debe ser posterior a la expedición',
    );
    expect(Object.keys(validarVigencia({ ...ok, fechaVencimiento: '', responsableId: '' })).sort()).toEqual([
      'fechaVencimiento',
      'responsableId',
    ]);
  });
});

describe('HU-29 · HU-30 · tablero y buscador', () => {
  const docs = [
    { nombre: 'SOAT TQK123', descripcion: '', categoria_id: 'veh', vigencia: { fecha_vencimiento: '2026-11-10' } },
    { nombre: 'Póliza RCE', descripcion: 'Responsabilidad civil', categoria_id: 'pol', vigencia: { fecha_vencimiento: '2026-10-01' } },
    { nombre: 'Cámara de comercio', descripcion: '', categoria_id: 'leg', vigencia: { fecha_vencimiento: '2027-03-01' } },
    { nombre: 'RUT', descripcion: '', categoria_id: 'leg', vigencia: null },
  ];

  it('cuenta los documentos por estado', () => {
    expect(resumenTablero(docs, HOY)).toEqual({ vigente: 1, por_vencer: 1, vencido: 1, sin_vigencia: 1 });
  });

  it('busca por nombre, categoría y estado', () => {
    expect(filtrarDocumentos(docs, '', '', 'vencido', HOY).map((d) => d.nombre)).toEqual(['Póliza RCE']);
    expect(filtrarDocumentos(docs, 'leg', '', 'sin_vigencia', HOY).map((d) => d.nombre)).toEqual(['RUT']);
    expect(filtrarDocumentos(docs, '', 'camara', '', HOY).map((d) => d.nombre)).toEqual(['Cámara de comercio']);
    expect(filtrarDocumentos(docs, '', 'soat', 'vigente', HOY)).toHaveLength(0);
  });
});

describe('HU-31 · procesos', () => {
  const valido = { ...PROCESO_VACIO, numero: 'SA-001-2026', entidad: 'Alcaldía', objeto: 'Transporte escolar', fechaCierre: '2026-11-20' };

  it('valida los datos del proceso', () => {
    expect(validarProceso(valido)).toEqual({});
    expect(validarProceso({ ...valido, valorEstimado: '1.250.000.000' })).toEqual({}); // contratos de más de 100 millones
    expect(validarProceso({ ...valido, valorEstimado: 'mil' }).valorEstimado).toMatch(/no válido/);
    expect(validarProceso({ ...valido, enlace: 'secop.gov.co' }).enlace).toBe('Debe empezar por https://');
    expect(Object.keys(validarProceso(PROCESO_VACIO)).sort()).toEqual(['entidad', 'fechaCierre', 'numero', 'objeto']);
  });

  it('en curso = en preparación o presentada', () => {
    expect(procesoAbierto('preparacion')).toBe(true);
    expect(procesoAbierto('presentada')).toBe(true);
    expect(procesoAbierto('adjudicada')).toBe(false);
  });

  it('la plantilla trae los requisitos habituales sin repetir', () => {
    const nombres = PLANTILLA_REQUISITOS.map((r) => r.requisito);
    expect(new Set(nombres).size).toBe(nombres.length);
    expect(nombres.some((n) => /RUT/.test(n))).toBe(true);
  });
});

describe('HU-32 · lista de verificación', () => {
  const CIERRE = '2026-11-20';
  const base = { documento_id: 'd1', cumplido_manual: false, obligatorio: true };

  it('evalúa cada requisito contra hoy y la fecha de cierre', () => {
    expect(estadoItem(base, '2027-01-01', HOY, CIERRE)).toBe('cumple');
    expect(estadoItem(base, null, HOY, CIERRE)).toBe('cumple'); // documento que no vence
    expect(estadoItem(base, '2026-11-15', HOY, CIERRE)).toBe('vence_antes_cierre');
    expect(estadoItem(base, CIERRE, HOY, CIERRE)).toBe('cumple'); // vigente el día del cierre
    expect(estadoItem(base, '2026-10-01', HOY, CIERRE)).toBe('vencido');
    expect(estadoItem({ ...base, documento_id: null }, null, HOY, CIERRE)).toBe('pendiente');
    expect(estadoItem({ ...base, documento_id: null, cumplido_manual: true }, null, HOY, CIERRE)).toBe('cumple');
  });

  it('calcula el porcentaje de cumplimiento y los obligatorios pendientes', () => {
    expect(
      cumplimiento([
        { estado: 'cumple', obligatorio: true },
        { estado: 'cumple', obligatorio: false },
        { estado: 'vencido', obligatorio: true },
      ]),
    ).toEqual({ total: 3, cumplidos: 2, porcentaje: 66, obligatoriosPendientes: 1 });
    expect(cumplimiento([])).toEqual({ total: 0, cumplidos: 0, porcentaje: 0, obligatoriosPendientes: 0 });
  });

  it('evalúa un proceso completo con sus documentos vinculados', () => {
    const item = (id: string, vence: string | null, documento = true): ItemConDocumento => ({
      id,
      proceso_id: 'p',
      orden: 0,
      requisito: id,
      obligatorio: true,
      documento_id: documento ? `doc-${id}` : null,
      cumplido_manual: false,
      notas: null,
      created_at: '2026-10-01',
      documento: documento
        ? { id: `doc-${id}`, nombre: id, version_actual: 1, vigencia: vence ? { fecha_vencimiento: vence } : null }
        : null,
    });
    const { items, resumen } = evaluarProceso(
      { fecha_cierre: CIERRE, items: [item('rut', null), item('soat', '2026-10-01'), item('carta', null, false)] },
      HOY,
    );
    expect(items.map((i) => i.estado)).toEqual(['cumple', 'vencido', 'pendiente']);
    expect(resumen.porcentaje).toBe(33);
    const problemas = problemasPaquete(items);
    expect(problemas.vencidos.map((i) => i.id)).toEqual(['soat']);
    expect(problemas.sinDocumento.map((i) => i.id)).toEqual(['carta']);
  });
});

describe('HU-33 · paquete', () => {
  it('nombra los archivos del ZIP en orden, sin tildes ni símbolos', () => {
    expect(nombreEnPaquete(3, 'Cámara de Comercio (vigente)', 'pdf')).toBe('03-camara-de-comercio-vigente.pdf');
    expect(nombreEnPaquete(12, '¡¡¡', 'docx')).toBe('12-documento.docx');
  });
});
