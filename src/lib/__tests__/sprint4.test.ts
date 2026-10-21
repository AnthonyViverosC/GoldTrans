// Sprint 4 · HU-22 a HU-26 reservas y abonos · HU-27 documentos · RNF-06 archivos.
import { formatearTamano, rutaArchivo, tipoPorNombre, validarArchivo } from '../archivos';
import { filtrarDocumentos, validarDocumento, versionActual, DOCUMENTO_VACIO } from '../documentos';
import {
  VIAJERO_VACIO,
  abonoMinimo,
  estadoVisible,
  fechaHoraColombia,
  fechaLimitePago,
  plazoRestante,
  reservaSinErrores,
  resumenPagos,
  saldoVencido,
  validarAbono,
  validarReserva,
  validarVerificacion,
  validarViajero,
  viajerosAJson,
  type FormularioViajero,
} from '../reservas';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-file-system', () => ({ File: class {} }));
jest.mock('expo-image-picker', () => ({}));

const HOY = '2026-10-21';
const ana: FormularioViajero = {
  nombreCompleto: 'Ana Gómez',
  tipoDocumento: 'CC',
  numeroDocumento: '1122334455',
  fechaNacimiento: '1990-05-14',
};

describe('HU-22 · reglas de la reserva', () => {
  it('abono mínimo: 30 % redondeado hacia arriba (igual que crear_reserva)', () => {
    expect(abonoMinimo(1_700_000)).toBe(510_000);
    expect(abonoMinimo(333_333)).toBe(100_000);
    expect(abonoMinimo(1)).toBe(1);
  });

  it('fecha límite de pago: 8 días antes de la salida', () => {
    expect(fechaLimitePago('2026-12-20', HOY)).toBe('2026-12-12');
  });

  it('fecha límite de pago: reservas de última hora tienen 2 días, sin pasar del día anterior a la salida', () => {
    expect(fechaLimitePago('2026-10-26', HOY)).toBe('2026-10-23');
    expect(fechaLimitePago('2026-10-22', HOY)).toBe('2026-10-21');
  });

  it('valida cada viajero', () => {
    expect(validarViajero(ana, HOY)).toEqual({});
    const e = validarViajero({ ...VIAJERO_VACIO, fechaNacimiento: '2030-01-01' }, HOY);
    expect(Object.keys(e).sort()).toEqual(['fechaNacimiento', 'nombreCompleto', 'numeroDocumento']);
    expect(validarViajero({ ...ana, fechaNacimiento: '14/05/1990' }, HOY).fechaNacimiento).toBe('Formato: AAAA-MM-DD');
  });

  it('no deja repetir un documento ni pasar de los cupos disponibles', () => {
    const e = validarReserva([ana, { ...ana, nombreCompleto: 'Otra', numeroDocumento: '1122334455 ' }], '3101234567', 1, HOY);
    expect(e.viajeros[1].numeroDocumento).toBe('Este documento ya está en otro viajero');
    expect(e.general).toBe('Solo quedan 1 cupos en esta salida');
    expect(reservaSinErrores(e)).toBe(false);
  });

  it('una reserva válida no tiene errores', () => {
    const e = validarReserva([ana], '310 123 4567', 10, HOY);
    expect(reservaSinErrores(e)).toBe(true);
    expect(validarReserva([ana], '', 10, HOY).telefono).toBe('Ingresa un teléfono');
  });

  it('envía los viajeros con el documento normalizado', () => {
    expect(viajerosAJson([{ ...ana, nombreCompleto: ' Ana Gómez ', numeroDocumento: ' ab1234 ' }])).toEqual([
      { nombre_completo: 'Ana Gómez', tipo_documento: 'CC', numero_documento: 'AB1234', fecha_nacimiento: '1990-05-14' },
    ]);
  });
});

describe('HU-25 · saldo y plazos', () => {
  const reserva = { valor_total: 1_000_000, valor_abonado: 300_000, abono_minimo: 300_000 };

  it('resume lo aprobado, lo que está en revisión y lo que falta', () => {
    const r = resumenPagos(reserva, [
      { estado: 'aprobado', valor: 300_000 },
      { estado: 'pendiente', valor: 200_000 },
      { estado: 'rechazado', valor: 999 },
    ]);
    expect(r).toEqual({
      total: 1_000_000,
      abonado: 300_000,
      enRevision: 200_000,
      saldo: 700_000,
      porPagar: 500_000,
      minimoPendiente: 0,
    });
  });

  it('el mínimo pendiente descuenta lo que ya está en revisión', () => {
    const r = resumenPagos({ ...reserva, valor_abonado: 0 }, [{ estado: 'pendiente', valor: 100_000 }]);
    expect(r.minimoPendiente).toBe(200_000);
  });

  it('marca el saldo atrasado solo en reservas confirmadas con saldo', () => {
    const base = { estado: 'confirmada', fecha_limite_pago: '2026-10-20', valor_total: 10, valor_abonado: 5 };
    expect(saldoVencido(base, HOY)).toBe(true);
    expect(saldoVencido({ ...base, fecha_limite_pago: HOY }, HOY)).toBe(false);
    expect(saldoVencido({ ...base, valor_abonado: 10 }, HOY)).toBe(false);
    expect(saldoVencido({ ...base, estado: 'cancelada' }, HOY)).toBe(false);
  });

  it('muestra fechas y plazos en hora de Colombia', () => {
    expect(fechaHoraColombia('2026-10-23T19:30:00Z')).toBe('2026-10-23 14:30');
    const ahora = new Date('2026-10-21T12:00:00Z');
    expect(plazoRestante('2026-10-21T12:40:00Z', ahora)).toBe('Vence en 40 min');
    expect(plazoRestante('2026-10-23T11:00:00Z', ahora)).toBe('Vence en 47 h');
    expect(plazoRestante('2026-10-21T11:00:00Z', ahora)).toBe('El plazo venció');
  });
});

describe('HU-26 · estado visible', () => {
  const ahora = new Date('2026-10-21T12:00:00Z');
  const vencida = { estado: 'prerreserva', vence_at: '2026-10-21T11:00:00Z' };

  it('una prerreserva con el plazo vencido se ve vencida', () => {
    expect(estadoVisible(vencida, [], ahora)).toBe('vencida');
  });

  it('no se ve vencida si tiene un abono en revisión', () => {
    expect(estadoVisible(vencida, [{ estado: 'pendiente' }], ahora)).toBe('prerreserva');
  });

  it('los demás estados se muestran tal cual', () => {
    expect(estadoVisible({ ...vencida, estado: 'confirmada' }, [], ahora)).toBe('confirmada');
    expect(estadoVisible({ ...vencida, vence_at: '2026-10-22T00:00:00Z' }, [], ahora)).toBe('prerreserva');
  });
});

describe('HU-23 · HU-24 · abonos', () => {
  const resumen = resumenPagos({ valor_total: 1_000_000, valor_abonado: 0, abono_minimo: 300_000 }, []);
  const archivo = { uri: 'file:///c.jpg', nombre: 'c.jpg', tipo: 'image/jpeg', tamano: 1000 };

  it('exige el abono mínimo, la fecha y el comprobante', () => {
    expect(validarAbono({ valor: '300.000', fechaTransferencia: HOY, referencia: '' }, resumen, archivo, HOY)).toEqual({});
    const e = validarAbono({ valor: '100000', fechaTransferencia: '2026-10-22', referencia: '' }, resumen, null, HOY);
    expect(e.valor).toBe('El abono mínimo para confirmar la reserva es $ 300.000');
    expect(e.fechaTransferencia).toBe('No puede ser una fecha futura');
    expect(e.comprobante).toBe('Adjunta el comprobante de la transferencia');
  });

  it('no deja abonar más que el saldo', () => {
    const e = validarAbono({ valor: '1.000.001', fechaTransferencia: HOY, referencia: '' }, resumen, archivo, HOY);
    expect(e.valor).toBe('No puede superar el saldo pendiente ($ 1.000.000)');
  });

  it('el rechazo exige motivo; la aprobación no', () => {
    expect(validarVerificacion('rechazar', '  ')).toBe('Explica al cliente por qué se rechaza');
    expect(validarVerificacion('aprobar', '')).toBeUndefined();
  });
});

describe('RNF-06 · archivos', () => {
  it('reconoce el tipo por la extensión', () => {
    expect(tipoPorNombre('Comprobante.PDF')).toBe('application/pdf');
    expect(tipoPorNombre('foto.jpeg')).toBe('image/jpeg');
    expect(tipoPorNombre('rut.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(tipoPorNombre('virus.exe')).toBeNull();
  });

  it('aplica las reglas de cada bucket', () => {
    expect(validarArchivo({ tipo: 'application/pdf', tamano: 4 * 1024 * 1024 }, 'comprobantes')).toBeUndefined();
    expect(validarArchivo({ tipo: 'application/pdf', tamano: 6 * 1024 * 1024 }, 'comprobantes')).toBe(
      'El archivo pesa 6,0 MB: el máximo es 5,0 MB',
    );
    expect(validarArchivo({ tipo: 'application/msword', tamano: null }, 'comprobantes')).toMatch(/no permitido/);
    expect(validarArchivo({ tipo: 'application/msword', tamano: null }, 'documentos')).toBeUndefined();
  });

  it('genera rutas únicas dentro de la carpeta del dueño', () => {
    const ruta = rutaArchivo('usuario/reserva', 'application/pdf', 1700000000000);
    expect(ruta).toMatch(/^usuario\/reserva\/1700000000000-[a-z0-9]+\.pdf$/);
  });

  it('formatea tamaños', () => {
    expect(formatearTamano(512)).toBe('512 B');
    expect(formatearTamano(2048)).toBe('2 KB');
    expect(formatearTamano(1.5 * 1024 * 1024)).toBe('1,5 MB');
  });
});

describe('HU-27 · documentos', () => {
  const doc = (nombre: string, categoria_id: string, descripcion = '') => ({ nombre, categoria_id, descripcion });

  it('filtra por categoría y por texto sin tildes', () => {
    const docs = [doc('RUT', 'leg'), doc('Póliza RCE', 'pol', 'Responsabilidad civil'), doc('Cámara de comercio', 'leg')];
    expect(filtrarDocumentos(docs, 'leg', '').map((d) => d.nombre)).toEqual(['Cámara de comercio', 'RUT']);
    expect(filtrarDocumentos(docs, '', 'poliza').map((d) => d.nombre)).toEqual(['Póliza RCE']);
    expect(filtrarDocumentos(docs, '', 'civil')).toHaveLength(1);
  });

  it('la versión vigente es la de mayor número', () => {
    const v = (version: number) => ({ version }) as never;
    expect(versionActual({ versiones: [v(1), v(3), v(2)] })).toEqual({ version: 3 });
    expect(versionActual({ versiones: [] })).toBeNull();
  });

  it('un documento nuevo exige categoría, nombre y archivo', () => {
    expect(Object.keys(validarDocumento(DOCUMENTO_VACIO, null, true)).sort()).toEqual([
      'archivo',
      'categoriaId',
      'nombre',
    ]);
    expect(validarDocumento({ ...DOCUMENTO_VACIO, categoriaId: 'x', nombre: 'RUT' }, null, false)).toEqual({});
  });
});
