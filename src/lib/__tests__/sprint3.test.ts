// Sprint 3 · HU-15 compartir · HU-16/17 solicitudes · HU-18 a HU-21 Goldtours.
import {
  destinatarioDesdePerfil,
  enlaceCorreo,
  enlaceWhatsApp,
  htmlCotizacion,
  telefonoWhatsApp,
  textoCotizacion,
  type CotizacionCompartible,
} from '../compartir';
import {
  FILTROS_INICIALES,
  PAQUETE_VACIO,
  admiteReservas,
  base64ABytes,
  duracionTexto,
  estadoFecha,
  filtrarCatalogo,
  formularioAPaquete,
  lineas,
  proximaSalida,
  validarFechaSalida,
  validarPaquete,
  type FechaSalida,
  type PaqueteCompleto,
} from '../paquetes';
import {
  validarFormularioSolicitud,
  validarHora,
  validarRespuesta,
  valorSolicitud,
} from '../solicitudes';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const cotizacion: CotizacionCompartible = {
  codigo: 'COT-000087',
  origen: 'La Hormiga',
  destino: 'Puerto Asís',
  tipo_servicio: 'ida_vuelta',
  fecha_inicio: '2026-10-24',
  fecha_fin: '2026-10-25',
  pasajeros: 10,
  tipo_vehiculo: 'van',
  capacidad_vehiculo: 15,
  distancia_km: 104,
  desglose: [
    { concepto: 'tarifa_base', descripcion: 'Tarifa base', cantidad: 1, valor_unitario: 180000, subtotal: 180000 },
    { concepto: 'kilometraje', descripcion: 'Recorrido (km)', cantidad: 104, valor_unitario: 2800, subtotal: 291200 },
    { concepto: 'dias', descripcion: 'Días de servicio', cantidad: 2, valor_unitario: 280000, subtotal: 560000 },
    { concepto: 'peajes', descripcion: 'Peajes (ida y regreso)', cantidad: 2, valor_unitario: 0, subtotal: 0 },
    { concepto: 'recargo', descripcion: 'Recargo fin de semana (20 %)', cantidad: 2, valor_unitario: 103120, subtotal: 206240 },
  ],
  valor_total: 1237440,
};

describe('compartir cotización (HU-15)', () => {
  it('arma el texto con ruta, vehículo, desglose y total', () => {
    const t = textoCotizacion(cotizacion);
    expect(t).toContain('Cotización COT-000087');
    expect(t).toContain('La Hormiga → Puerto Asís');
    expect(t).toContain('Ida y vuelta · 2026-10-24 al 2026-10-25 · 104 km');
    expect(t).toContain('Van (hasta 15 pasajeros)');
    expect(t).toContain('• Recorrido (km): $ 291.200 (104 km × $ 2.800)');
    expect(t).toContain('*Total: $ 1.237.440*');
  });

  it('agrega las notas de la cotización oficial cuando se conoce la jornada', () => {
    const t = textoCotizacion({ ...cotizacion, jornada_horas: 12, km_incluidos_dia: 150, valor_km_adicional: 1500 });
    expect(t).toContain('Modalidad 12 horas');
    expect(t).toContain('Base kilometraje: 150 km diarios y $ 1.500 por km adicional.');
    expect(t).toContain('Incluye: vehículo, conductor, combustible, peajes y demás gastos operativos.');
    // Las cotizaciones antiguas no tienen esos datos: no se inventan.
    expect(textoCotizacion(cotizacion)).not.toContain('Base kilometraje');
  });

  it('el PDF sigue el formato oficial: fecha, destinatario, tabla y datos de la empresa', () => {
    const html = htmlCotizacion({
      ...cotizacion,
      jornada_horas: 8,
      created_at: '2026-10-22T03:00:00Z', // 21 de octubre en Colombia
      destinatario: destinatarioDesdePerfil({
        usuario_id: 'u',
        tipo_persona: 'empresa',
        nombre_completo: 'Ana Pérez',
        tipo_documento: null,
        numero_documento: null,
        razon_social: 'COOTRANSERP',
        nit: '900162246-4',
        telefono: null,
        ciudad: 'Villagarzón',
        created_at: '',
        updated_at: '',
      }),
    });
    expect(html).toContain('La Hormiga, Valle del Guamuez - Putumayo, 21 de octubre de 2026.');
    expect(html).toContain('<strong>COOTRANSERP</strong>');
    expect(html).toContain('NIT 900162246-4');
    expect(html).toContain('La Hormiga – Puerto Asís – La Hormiga');
    expect(html).toContain('TOTAL DEL SERVICIO');
    expect(html).toContain('CÓDIGO-SGI-OP-CT-01');
    expect(html).toContain('901.760.920-1');
  });

  it('el PDF escapa el texto para no inyectar HTML', () => {
    const html = htmlCotizacion({ ...cotizacion, origen: '<script>x</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('$ 1.237.440');
  });

  it('agrega el indicativo 57 a celulares colombianos', () => {
    expect(telefonoWhatsApp('310 123 4567')).toBe('573101234567');
    expect(telefonoWhatsApp('+573101234567')).toBe('573101234567');
    expect(telefonoWhatsApp('6012345678')).toBe('6012345678');
  });

  it('codifica los enlaces de WhatsApp y correo', () => {
    expect(enlaceWhatsApp('Hola & chao')).toBe('https://wa.me/?text=Hola%20%26%20chao');
    expect(enlaceWhatsApp('Hola', '3101234567')).toBe('https://wa.me/573101234567?text=Hola');
    expect(enlaceCorreo('Asunto', 'Línea 1\nLínea 2')).toBe(
      'mailto:?subject=Asunto&body=L%C3%ADnea%201%0AL%C3%ADnea%202',
    );
  });
});

describe('solicitudes (HU-16 · HU-17)', () => {
  const valida = {
    nombreContacto: 'Laura',
    telefonoContacto: '310 123 4567',
    direccionRecogida: 'Parque principal',
    horaRecogida: '06:30',
    observaciones: '',
  };

  it('valida la hora en formato 24 h', () => {
    expect(validarHora('06:30')).toBeUndefined();
    expect(validarHora('23:59')).toBeUndefined();
    expect(validarHora('24:00')).toBeDefined();
    expect(validarHora('6:30')).toBeDefined();
    expect(validarHora('')).toBeDefined();
  });

  it('exige contacto, teléfono, dirección y hora', () => {
    expect(validarFormularioSolicitud(valida)).toEqual({});
    const errores = validarFormularioSolicitud({
      ...valida,
      nombreContacto: ' ',
      telefonoContacto: '12',
      direccionRecogida: '',
    });
    expect(Object.keys(errores).sort()).toEqual(['direccionRecogida', 'nombreContacto', 'telefonoContacto']);
  });

  it('el asesor debe dar motivo al rechazar y valor + motivo al ajustar', () => {
    expect(validarRespuesta('confirmar', '', '')).toEqual({});
    expect(Object.keys(validarRespuesta('rechazar', '', ''))).toEqual(['motivo']);
    expect(Object.keys(validarRespuesta('ajustar', '', '')).sort()).toEqual(['motivo', 'valor']);
    expect(validarRespuesta('ajustar', '0', 'x').valor).toBeDefined();
    expect(validarRespuesta('ajustar', '1.300.000', 'Peaje adicional')).toEqual({});
  });

  it('el valor vigente es el final si existe', () => {
    expect(valorSolicitud({ valor_cotizado: 100, valor_final: null })).toBe(100);
    expect(valorSolicitud({ valor_cotizado: 100, valor_final: 120 })).toBe(120);
  });
});

const fecha = (salida: string, totales: number, reservados = 0, estado = 'abierta'): FechaSalida => ({
  id: salida,
  paquete_id: 'p',
  fecha_salida: salida,
  fecha_regreso: salida,
  cupos_totales: totales,
  cupos_reservados: reservados,
  cupos_disponibles: totales - reservados,
  estado,
  created_at: '',
  updated_at: '',
});

const paquete = (id: string, extra: Partial<PaqueteCompleto>): PaqueteCompleto => ({
  id,
  nombre: id,
  destino: 'Mocoa',
  descripcion: '',
  duracion_dias: 1,
  duracion_noches: 0,
  precio_por_persona: 100000,
  incluye: [],
  no_incluye: [],
  activo: true,
  created_at: '',
  updated_at: '',
  imagenes: [],
  itinerario: [],
  fechas: [],
  ...extra,
});

describe('fechas de salida y cupos (HU-20)', () => {
  const hoy = '2026-10-14';

  it('clasifica cada fecha y solo deja reservar las disponibles', () => {
    expect(estadoFecha(fecha('2026-11-01', 20, 0), hoy)).toBe('disponible');
    expect(estadoFecha(fecha('2026-11-01', 20, 15), hoy)).toBe('ultimos');
    expect(estadoFecha(fecha('2026-11-01', 20, 20), hoy)).toBe('agotada');
    expect(estadoFecha(fecha('2026-11-01', 20, 0, 'cerrada'), hoy)).toBe('cerrada');
    expect(estadoFecha(fecha('2026-10-13', 20, 0), hoy)).toBe('pasada');
    expect(admiteReservas('agotada')).toBe(false);
    expect(admiteReservas('ultimos')).toBe(true);
  });

  it('la próxima salida salta las agotadas, cerradas y pasadas', () => {
    const p = paquete('a', {
      fechas: [
        fecha('2026-12-01', 10),
        fecha('2026-10-01', 10),
        fecha('2026-10-20', 10, 10),
        fecha('2026-10-25', 10, 0, 'cerrada'),
        fecha('2026-11-05', 10, 3),
      ],
    });
    expect(proximaSalida(p, hoy)?.fecha_salida).toBe('2026-11-05');
    expect(proximaSalida(paquete('b', { fechas: [fecha('2026-10-20', 5, 5)] }), hoy)).toBeNull();
  });

  it('valida fechas y no permite menos cupos que los reservados', () => {
    const f = { fechaSalida: '2026-11-01', fechaRegreso: '2026-11-03', cupos: '20', estado: 'abierta' as const };
    expect(validarFechaSalida(f)).toEqual({});
    expect(validarFechaSalida({ ...f, fechaRegreso: '2026-10-31' }).fechaRegreso).toBeDefined();
    expect(validarFechaSalida({ ...f, cupos: '0' }).cupos).toBeDefined();
    expect(validarFechaSalida({ ...f, cupos: '5' }, 8).cupos).toBe('Ya hay 8 cupos reservados: no puede ser menor');
  });
});

describe('catálogo (HU-18)', () => {
  const hoy = '2026-10-14';
  const catalogo = [
    paquete('Ruta del Yagé', { destino: 'Mocoa', duracion_dias: 3, precio_por_persona: 650000, fechas: [fecha('2026-12-01', 10)] }),
    paquete('Fin de semana en Pasto', { destino: 'Pasto', duracion_dias: 2, precio_por_persona: 480000, fechas: [fecha('2026-11-01', 10)] }),
    paquete('Cascada del Fin del Mundo', { destino: 'Mocoa', duracion_dias: 1, precio_por_persona: 180000 }),
  ];
  const nombres = (ps: PaqueteCompleto[]) => ps.map((p) => p.nombre);

  it('ordena por próxima salida (sin salida al final), por precio o precio descendente', () => {
    expect(nombres(filtrarCatalogo(catalogo, FILTROS_INICIALES, hoy))).toEqual([
      'Fin de semana en Pasto',
      'Ruta del Yagé',
      'Cascada del Fin del Mundo',
    ]);
    expect(nombres(filtrarCatalogo(catalogo, { ...FILTROS_INICIALES, orden: 'precio' }, hoy))[0]).toBe(
      'Cascada del Fin del Mundo',
    );
    expect(nombres(filtrarCatalogo(catalogo, { ...FILTROS_INICIALES, orden: 'precio_desc' }, hoy))[0]).toBe(
      'Ruta del Yagé',
    );
  });

  it('filtra por texto sin tildes, destino y duración', () => {
    expect(nombres(filtrarCatalogo(catalogo, { ...FILTROS_INICIALES, texto: 'yage' }, hoy))).toEqual(['Ruta del Yagé']);
    expect(filtrarCatalogo(catalogo, { ...FILTROS_INICIALES, destino: 'Mocoa' }, hoy)).toHaveLength(2);
    expect(nombres(filtrarCatalogo(catalogo, { ...FILTROS_INICIALES, duracion: '1' }, hoy))).toEqual([
      'Cascada del Fin del Mundo',
    ]);
    expect(filtrarCatalogo(catalogo, { ...FILTROS_INICIALES, duracion: '2-3' }, hoy)).toHaveLength(2);
    expect(filtrarCatalogo(catalogo, { ...FILTROS_INICIALES, duracion: '4+' }, hoy)).toHaveLength(0);
  });
});

describe('paquetes (HU-21)', () => {
  it('valida el formulario', () => {
    const valido = { ...PAQUETE_VACIO, nombre: 'Ruta', destino: 'Mocoa', dias: '3', noches: '2', precio: '650.000' };
    expect(validarPaquete(valido)).toEqual({});
    expect(validarPaquete({ ...valido, noches: '4' }).noches).toBe('No puede haber más noches que días');
    expect(validarPaquete({ ...valido, precio: '0' }).precio).toBeDefined();
    expect(Object.keys(validarPaquete(PAQUETE_VACIO)).sort()).toEqual(['destino', 'nombre', 'precio']);
  });

  it('convierte las listas de "incluye" (una por línea, sin viñetas ni vacíos)', () => {
    expect(lineas('- Transporte\n\n• Alojamiento \n* Guía')).toEqual(['Transporte', 'Alojamiento', 'Guía']);
    const fila = formularioAPaquete({
      ...PAQUETE_VACIO,
      nombre: ' Ruta ',
      destino: 'Mocoa',
      precio: '$ 650.000',
      incluye: 'Transporte\nAlojamiento',
      estado: 'activo',
    });
    expect(fila).toMatchObject({ nombre: 'Ruta', precio_por_persona: 650000, incluye: ['Transporte', 'Alojamiento'], activo: true });
  });

  it('describe la duración', () => {
    expect(duracionTexto({ duracion_dias: 1, duracion_noches: 0 })).toBe('1 día');
    expect(duracionTexto({ duracion_dias: 3, duracion_noches: 2 })).toBe('3 días / 2 noches');
    expect(duracionTexto({ duracion_dias: 2, duracion_noches: 1 })).toBe('2 días / 1 noche');
  });

  it.each([
    ['', []],
    ['YQ==', [97]],
    ['YWI=', [97, 98]],
    ['YWJj', [97, 98, 99]],
    ['YWJjZA==', [97, 98, 99, 100]],
    ['w7E=', [0xc3, 0xb1]], // "ñ" en UTF-8
    ['/+8=', [0xff, 0xef]],
    ['YW\nJj', [97, 98, 99]], // ignora saltos de línea
  ])('decodifica base64 %j', (b64, bytes) => {
    expect(Array.from(base64ABytes(b64))).toEqual(bytes);
  });
});
