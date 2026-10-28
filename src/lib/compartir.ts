// HU-15 · Enviar la cotización por WhatsApp o correo y descargarla en PDF.
// El PDF sigue el formato de las cotizaciones oficiales de GOLDTRANS (docs/Ejemplos/).
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

import { EMPRESA, WHATSAPP_EMPRESA } from '@/constants/empresa';
import { LOGO_PDF } from '@/constants/logo-pdf';
import type { Resultado } from '@/lib/auth';
import { MESES, fechaCorta } from '@/lib/calendario';
import {
  ETIQUETA_SERVICIO,
  detalleLinea,
  diasEntre,
  formatearDecimal,
  formatearPesos,
  hoyEnColombia,
  type Cotizacion,
  type CotizacionGuardada,
  type LineaDesgloseVista,
  type TipoServicio,
} from '@/lib/cotizador';
import { normalizarTelefono } from '@/lib/validacion';
import { ETIQUETA_TIPO, type TipoVehiculo } from '@/lib/vehiculos';
import type { Tables } from '@/types/database';

/** "Señores:" de la carta. */
export type Destinatario = { nombre: string; documento?: string; ciudad?: string };

export function destinatarioDesdePerfil(perfil: Tables<'perfiles'> | null | undefined): Destinatario | undefined {
  if (!perfil) return undefined;
  const ciudad = perfil.ciudad ?? undefined;
  if (perfil.tipo_persona === 'empresa' && perfil.razon_social) {
    return { nombre: perfil.razon_social, documento: perfil.nit ? `NIT ${perfil.nit}` : undefined, ciudad };
  }
  const documento =
    perfil.numero_documento ? `${perfil.tipo_documento ?? 'Documento'} ${perfil.numero_documento}` : undefined;
  return { nombre: perfil.nombre_completo, documento, ciudad };
}

/** Datos comunes a la respuesta del cotizador y a una cotización guardada. */
export type CotizacionCompartible = {
  codigo: string;
  origen: string;
  destino: string;
  tipo_servicio: TipoServicio;
  fecha_inicio: string;
  fecha_fin: string;
  pasajeros: number;
  tipo_vehiculo: string;
  capacidad_vehiculo: number;
  distancia_km: number;
  desglose: readonly LineaDesgloseVista[];
  valor_total: number;
  /** null en cotizaciones anteriores a las tarifas por jornada. */
  jornada_horas?: number | null;
  km_incluidos_dia?: number | null;
  valor_km_adicional?: number | null;
  /** Fecha de la cotización (ISO); sin ella se usa la de hoy. */
  created_at?: string;
  destinatario?: Destinatario;
};

export function desdeRespuesta(c: Cotizacion, destinatario?: Destinatario): CotizacionCompartible {
  return {
    codigo: c.codigo,
    origen: c.ruta.origen,
    destino: c.ruta.destino,
    tipo_servicio: c.tipo_servicio,
    fecha_inicio: c.fecha_inicio,
    fecha_fin: c.fecha_fin,
    pasajeros: c.pasajeros,
    tipo_vehiculo: c.vehiculo.tipo,
    capacidad_vehiculo: c.vehiculo.capacidad,
    distancia_km: c.distancia_km,
    desglose: c.desglose,
    valor_total: c.valor_total,
    jornada_horas: c.jornada_horas,
    km_incluidos_dia: c.km_incluidos_dia,
    valor_km_adicional: c.valor_km_adicional,
    created_at: c.created_at,
    destinatario,
  };
}

export function desdeGuardada(c: CotizacionGuardada, destinatario?: Destinatario): CotizacionCompartible {
  return {
    codigo: c.codigo,
    origen: c.origen,
    destino: c.destino,
    tipo_servicio: c.tipo_servicio as TipoServicio,
    fecha_inicio: c.fecha_inicio,
    fecha_fin: c.fecha_fin,
    pasajeros: c.pasajeros,
    tipo_vehiculo: c.tipo_vehiculo,
    capacidad_vehiculo: c.capacidad_vehiculo,
    distancia_km: c.distancia_km,
    desglose: c.detalle,
    valor_total: c.valor_total,
    jornada_horas: c.jornada_horas,
    km_incluidos_dia: c.km_incluidos_dia,
    valor_km_adicional: c.valor_km_adicional,
    created_at: c.created_at,
    destinatario,
  };
}

function fechas(c: CotizacionCompartible) {
  return c.fecha_fin === c.fecha_inicio ? c.fecha_inicio : `${c.fecha_inicio} al ${c.fecha_fin}`;
}

function vehiculo(c: CotizacionCompartible) {
  return `${ETIQUETA_TIPO[c.tipo_vehiculo as TipoVehiculo] ?? c.tipo_vehiculo} (hasta ${c.capacidad_vehiculo} pasajeros)`;
}

const NOTA = 'Valor de referencia sujeto a disponibilidad. Un asesor lo confirma al formalizar la solicitud.';

/** "21 de octubre de 2026" en hora de Colombia. */
export function fechaCarta(iso?: string): string {
  const [anio, mes, dia] = hoyEnColombia(iso ? new Date(iso) : new Date()).split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}

function itinerario(c: CotizacionCompartible) {
  return c.tipo_servicio === 'ida' ? `${c.origen} – ${c.destino}` : `${c.origen} – ${c.destino} – ${c.origen}`;
}

/** Notas de las cotizaciones oficiales: modalidad, kilometraje, pago e inclusiones. */
export function notasCotizacion(c: CotizacionCompartible): string[] {
  const notas = [
    c.jornada_horas
      ? `Disponibilidad: sujeta a confirmación del asesor. Modalidad ${c.jornada_horas} horas.`
      : 'Disponibilidad: sujeta a confirmación del asesor.',
  ];
  if (c.km_incluidos_dia != null && c.valor_km_adicional != null) {
    notas.push(
      `Base kilometraje: ${c.km_incluidos_dia} km diarios y ${formatearPesos(c.valor_km_adicional)} por km adicional.`,
    );
  }
  notas.push(
    'Forma de pago: con presentación de factura, o 50 % al inicio y 50 % al finalizar el servicio.',
    'Incluye: vehículo, conductor, combustible, peajes y demás gastos operativos.',
  );
  return notas;
}

/** Texto plano para WhatsApp y correo. */
export function textoCotizacion(c: CotizacionCompartible): string {
  const lineas = c.desglose.map((l) => {
    const detalle = detalleLinea(l);
    return `• ${l.descripcion}: ${formatearPesos(l.subtotal)}${detalle ? ` (${detalle})` : ''}`;
  });
  return [
    `*GOLDTRANS S.A.S.* · Cotización ${c.codigo}`,
    `${c.origen} → ${c.destino}`,
    `${ETIQUETA_SERVICIO[c.tipo_servicio]} · ${fechas(c)} · ${formatearDecimal(c.distancia_km)} km`,
    `${c.pasajeros} ${c.pasajeros === 1 ? 'pasajero' : 'pasajeros'} · ${vehiculo(c)}`,
    '',
    ...lineas,
    '',
    `*Total: ${formatearPesos(c.valor_total)}*`,
    '',
    ...notasCotizacion(c).map((n) => `• ${n}`),
    '',
    NOTA,
    `${EMPRESA.telefonos.join(' - ')} · ${EMPRESA.correos[0]} · ${EMPRESA.web}`,
  ].join('\n');
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Documento para el PDF, con el formato de la carta de cotización oficial. */
export function htmlCotizacion(c: CotizacionCompartible): string {
  const d = c.destinatario;
  const tipo = ETIQUETA_TIPO[c.tipo_vehiculo as TipoVehiculo] ?? c.tipo_vehiculo;
  const dias = diasEntre(c.fecha_inicio, c.fecha_fin);
  const periodo =
    c.fecha_fin === c.fecha_inicio
      ? fechaCorta(c.fecha_inicio)
      : `${fechaCorta(c.fecha_inicio)} al ${fechaCorta(c.fecha_fin)}`;
  const observacion = [
    c.jornada_horas ? `${c.jornada_horas} horas` : null,
    `${dias} ${dias === 1 ? 'día' : 'días'} · ${periodo}`,
    `${c.pasajeros} ${c.pasajeros === 1 ? 'pasajero' : 'pasajeros'}`,
  ]
    .filter(Boolean)
    .map((t) => escapar(t as string))
    .join('<br>');
  const filas = c.desglose
    .map((l) => {
      const detalle = detalleLinea(l);
      return `<tr><td>${escapar(l.descripcion)}${detalle ? `<br><small>${escapar(detalle)}</small>` : ''}</td>
        <td class="valor">${formatearPesos(l.subtotal)}</td></tr>`;
    })
    .join('');
  const notas = notasCotizacion(c).map((n) => `<li>${escapar(n)}</li>`).join('');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Cotización ${escapar(c.codigo)}</title>
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: Calibri, -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #14213D; margin: 0; font-size: 13px; line-height: 1.45; }
  .hoja { padding: 36px 56px 24px; }
  .encabezado { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .marca { display: flex; align-items: center; gap: 12px; }
  .marca img { width: 64px; height: 64px; }
  .nombre { font-size: 26px; font-weight: 800; color: #1A4294; letter-spacing: 1px; }
  .lema { font-style: italic; color: #1A4294; font-size: 12px; }
  .control { border-collapse: collapse; font-size: 10px; }
  .control td { border: 1px solid #14213D; padding: 2px 8px; }
  .control .tit { font-weight: 700; text-align: center; }
  .barra { height: 5px; background: linear-gradient(90deg, #1A4294 70%, #E3B341 70%); margin: 14px 0 22px; }
  p { margin: 0 0 12px; text-align: justify; }
  .senores p { margin: 0; text-align: left; }
  .senores { margin-bottom: 16px; }
  table.oferta { width: 100%; border-collapse: collapse; margin: 8px 0 14px; }
  .oferta th { background: #1A4294; color: #FFFFFF; padding: 6px 8px; text-align: center; border: 1px solid #14213D; }
  .oferta td { border: 1px solid #14213D; padding: 6px 8px; vertical-align: middle; }
  .oferta .total td { font-weight: 700; }
  .centro { text-align: center; }
  .valor { text-align: right; white-space: nowrap; }
  table.detalle { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px; }
  .detalle td { padding: 5px 0; border-bottom: 1px solid #D9E0EB; vertical-align: top; }
  .detalle small { color: #5E6A7E; }
  h3 { font-size: 13px; margin: 0 0 4px; }
  ul { margin: 0 0 14px; padding-left: 18px; }
  .firma { margin-top: 22px; }
  .firma p { margin: 0; text-align: left; }
  .aviso { font-size: 11px; color: #5E6A7E; margin-top: 16px; }
  .pie { background: #1A4294; color: #FFFFFF; padding: 12px 56px; font-size: 11px; text-align: center; line-height: 1.6; }
</style></head>
<body>
<div class="hoja">
  <div class="encabezado">
    <div class="marca">
      <img src="${LOGO_PDF}" alt="GOLDTRANS">
      <div><div class="nombre">GOLDTRANS</div><div class="lema">"${escapar(EMPRESA.lema)}"</div></div>
    </div>
    <table class="control">
      <tr><td class="tit" colspan="2">SISTEMA DE GESTIÓN INTEGRAL · COTIZACIÓN</td></tr>
      <tr><td>CÓDIGO-${EMPRESA.formatoCotizacion.codigo}</td><td>VERSIÓN-${EMPRESA.formatoCotizacion.version}</td></tr>
      <tr><td colspan="2">N.º ${escapar(c.codigo)}</td></tr>
    </table>
  </div>
  <div class="barra"></div>

  <p>${escapar(EMPRESA.ciudad)}, ${fechaCarta(c.created_at)}.</p>

  <div class="senores">
    <p>Señores:</p>
    ${d ? `<p><strong>${escapar(d.nombre)}</strong></p>${d.documento ? `<p>${escapar(d.documento)}</p>` : ''}${d.ciudad ? `<p>${escapar(d.ciudad)}</p>` : ''}` : '<p><strong>Cliente</strong></p>'}
  </div>

  <p><strong>Ref.</strong> Cotización Servicio de Transporte Especial a todo costo.</p>
  <p>La EMPRESA DE TRANSPORTE ${escapar(EMPRESA.razonSocial)} se permite formalmente enviar cotización del
  Servicio de Transporte Especial, cumpliendo con las condiciones técnicas, legales y operativas requeridas
  para la adecuada ejecución del servicio, de acuerdo con las siguientes especificaciones:</p>

  <table class="oferta">
    <tr><th>Tipo de vehículo</th><th>Itinerario de ruta</th><th>Observación</th><th>Valor</th></tr>
    <tr>
      <td class="centro">${escapar(tipo)}<br><small>Hasta ${c.capacidad_vehiculo} pasajeros</small></td>
      <td>${escapar(itinerario(c))}<br><small>${ETIQUETA_SERVICIO[c.tipo_servicio]} · ${formatearDecimal(c.distancia_km)} km</small></td>
      <td class="centro">${observacion}</td>
      <td class="valor">${formatearPesos(c.valor_total)}</td>
    </tr>
    <tr class="total"><td colspan="3" class="valor">TOTAL DEL SERVICIO</td><td class="valor">${formatearPesos(c.valor_total)}</td></tr>
  </table>

  <h3>Detalle del valor</h3>
  <table class="detalle">${filas}</table>

  <h3>NOTA:</h3>
  <ul>${notas}</ul>

  <p>De antemano agradecemos por tener en cuenta a nuestra empresa y permitirnos presentar esta propuesta,
  esperando esté dentro de sus expectativas.</p>

  <div class="firma">
    <p>Cordialmente;</p>
    <p><strong>${escapar(EMPRESA.razonSocial)}</strong></p>
    <p>NIT ${EMPRESA.nit} · Área comercial</p>
    <p>${escapar(EMPRESA.correos.join(' – '))}</p>
  </div>
  <p class="aviso">${NOTA}</p>
</div>
<div class="pie">
  ${EMPRESA.telefonos.join(' - ')} &nbsp;·&nbsp; ${escapar(EMPRESA.correos[0])} &nbsp;·&nbsp; ${EMPRESA.web}<br>
  ${escapar(EMPRESA.direccion)}
</div>
</body></html>`;
}

/** Celular colombiano de 10 dígitos → con indicativo 57 (formato de wa.me). */
export function telefonoWhatsApp(telefono: string): string {
  const limpio = normalizarTelefono(telefono).replace(/^\+/, '');
  return /^3\d{9}$/.test(limpio) ? `57${limpio}` : limpio;
}

/** Sin teléfono, WhatsApp deja elegir a quién enviarlo. */
export function enlaceWhatsApp(texto: string, telefono?: string): string {
  const destino = telefono ? telefonoWhatsApp(telefono) : '';
  return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`;
}

export function enlaceCorreo(asunto: string, cuerpo: string, para = ''): string {
  return `mailto:${para}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

async function abrir(url: string, sinApp: string): Promise<Resultado> {
  try {
    await Linking.openURL(url);
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: sinApp };
  }
}

/** Abre el chat con el área comercial de GOLDTRANS con la cotización ya escrita. */
export function hablarConAsesor(c: CotizacionCompartible): Promise<Resultado> {
  const texto = `Hola, quiero confirmar esta cotización:\n\n${textoCotizacion(c)}`;
  return abrir(enlaceWhatsApp(texto, WHATSAPP_EMPRESA), 'No se pudo abrir WhatsApp');
}

export function enviarPorWhatsApp(c: CotizacionCompartible): Promise<Resultado> {
  // El texto usa *negrillas* de WhatsApp.
  return abrir(enlaceWhatsApp(textoCotizacion(c)), 'No se pudo abrir WhatsApp');
}

export function enviarPorCorreo(c: CotizacionCompartible): Promise<Resultado> {
  const cuerpo = textoCotizacion(c).replace(/\*/g, '');
  return abrir(
    enlaceCorreo(`Cotización ${c.codigo} · GOLDTRANS`, cuerpo),
    'No hay una aplicación de correo configurada',
  );
}

/** Genera el PDF y abre el menú del sistema para guardarlo o compartirlo. */
export async function descargarPdf(c: CotizacionCompartible): Promise<Resultado> {
  const html = htmlCotizacion(c);
  try {
    if (Platform.OS === 'web') {
      // En el navegador se abre el diálogo de impresión ("Guardar como PDF").
      await Print.printAsync({ html });
      return { ok: true, data: undefined };
    }
    const { uri } = await Print.printToFileAsync({ html });
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, error: 'Este dispositivo no permite compartir archivos' };
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Cotización ${c.codigo}`,
    });
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: 'No se pudo generar el PDF' };
  }
}
