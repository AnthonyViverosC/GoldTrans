// Datos de la empresa tal como aparecen en las cotizaciones oficiales (docs/Ejemplos/).

export const EMPRESA = {
  razonSocial: 'GOLDTRANS S.A.S. ZOMAC',
  nit: '901.760.920-1',
  lema: 'Nuestra Misión, Tu Destino',
  ciudad: 'La Hormiga, Valle del Guamuez - Putumayo',
  direccion: 'Cra 8 Dg Caseta JAC / Barrio El Recreo - La Hormiga / Valle del Guamuez - Putumayo',
  telefonos: ['3227279371', '3148032534'],
  correos: ['goldtranssas@gmail.com', 'goldtransoperativo@outlook.com'],
  web: 'www.goldtrans.org',
  /** Control documental del Sistema de Gestión Integral para el formato de cotización. */
  formatoCotizacion: { codigo: 'SGI-OP-CT-01', version: '0' },
} as const;

/** Número de atención comercial para WhatsApp (el primero del pie de página oficial). */
export const WHATSAPP_EMPRESA = EMPRESA.telefonos[0];
