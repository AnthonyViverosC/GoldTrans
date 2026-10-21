// HU-15 · Enviar la cotización por WhatsApp o correo y descargarla en PDF.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

import type { Resultado } from '@/lib/auth';
import {
  ETIQUETA_SERVICIO,
  detalleLinea,
  formatearDecimal,
  formatearPesos,
  type Cotizacion,
  type CotizacionGuardada,
  type LineaDesgloseVista,
  type TipoServicio,
} from '@/lib/cotizador';
import { normalizarTelefono } from '@/lib/validacion';
import { ETIQUETA_TIPO, type TipoVehiculo } from '@/lib/vehiculos';

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
};

export function desdeRespuesta(c: Cotizacion): CotizacionCompartible {
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
  };
}

export function desdeGuardada(c: CotizacionGuardada): CotizacionCompartible {
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
  };
}

function fechas(c: CotizacionCompartible) {
  return c.fecha_fin === c.fecha_inicio ? c.fecha_inicio : `${c.fecha_inicio} al ${c.fecha_fin}`;
}

function vehiculo(c: CotizacionCompartible) {
  return `${ETIQUETA_TIPO[c.tipo_vehiculo as TipoVehiculo] ?? c.tipo_vehiculo} (hasta ${c.capacidad_vehiculo} pasajeros)`;
}

const NOTA = 'Valor de referencia sujeto a disponibilidad. Un asesor lo confirma al formalizar la solicitud.';

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
    NOTA,
  ].join('\n');
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Documento para el PDF. */
export function htmlCotizacion(c: CotizacionCompartible): string {
  const filas = c.desglose
    .map((l) => {
      const detalle = detalleLinea(l);
      return `<tr><td>${escapar(l.descripcion)}${detalle ? `<br><small>${escapar(detalle)}</small>` : ''}</td>
        <td class="valor">${formatearPesos(l.subtotal)}</td></tr>`;
    })
    .join('');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Cotización ${escapar(c.codigo)}</title>
<style>
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #1A1A1A; margin: 32px; }
  h1 { color: #8C6D10; margin: 0; font-size: 22px; }
  .codigo { color: #6B6B6B; margin: 4px 0 24px; }
  h2 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 2px 0; color: #444; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  td { padding: 10px 0; border-bottom: 1px solid #DDD8CA; vertical-align: top; }
  small { color: #6B6B6B; }
  .valor { text-align: right; white-space: nowrap; }
  .total td { font-weight: bold; font-size: 18px; color: #8C6D10; border-bottom: none; }
  .nota { margin-top: 32px; font-size: 12px; color: #6B6B6B; }
</style></head>
<body>
  <h1>GOLDTRANS S.A.S.</h1>
  <p class="codigo">Transporte terrestre especial · La Hormiga, Putumayo · Cotización ${escapar(c.codigo)}</p>
  <h2>${escapar(c.origen)} → ${escapar(c.destino)}</h2>
  <p>${ETIQUETA_SERVICIO[c.tipo_servicio]} · ${escapar(fechas(c))} · ${formatearDecimal(c.distancia_km)} km</p>
  <p>${c.pasajeros} ${c.pasajeros === 1 ? 'pasajero' : 'pasajeros'} · ${escapar(vehiculo(c))}</p>
  <table>${filas}<tr class="total"><td>Total</td><td class="valor">${formatearPesos(c.valor_total)}</td></tr></table>
  <p class="nota">${NOTA}</p>
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
