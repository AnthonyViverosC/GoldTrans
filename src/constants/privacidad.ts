// RNF-03 · Aviso de privacidad y autorización de tratamiento de datos (Ley 1581 de 2012).
// Si el texto cambia de fondo, sube VERSION_AVISO_PRIVACIDAD: cada perfil guarda la versión que aceptó.
// Borrador técnico: GOLDTRANS debe revisar el texto y completar los datos de contacto antes de producción.

export const VERSION_AVISO_PRIVACIDAD = '2026-10-30';

export const CORREO_PRIVACIDAD = 'protecciondedatos@goldtrans.com.co';

export const TEXTO_AUTORIZACION =
  'Autorizo de manera previa, expresa e informada a GOLDTRANS S.A.S. para tratar mis datos personales conforme al aviso de privacidad y a la Ley 1581 de 2012.';

export type SeccionAviso = { titulo: string; parrafos: string[] };

export const AVISO_PRIVACIDAD: SeccionAviso[] = [
  {
    titulo: 'Responsable del tratamiento',
    parrafos: [
      'GOLDTRANS S.A.S., empresa de transporte terrestre especial con domicilio en La Hormiga, Putumayo, Colombia.',
      `Correo para asuntos de datos personales: ${CORREO_PRIVACIDAD}.`,
    ],
  },
  {
    titulo: 'Datos que recolectamos',
    parrafos: [
      'Nombre, tipo y número de documento o NIT, razón social, correo electrónico, teléfono y ciudad.',
      'Al reservar un paquete turístico: nombre, documento y fecha de nacimiento de los viajeros, y los comprobantes de transferencia que adjuntes.',
    ],
  },
  {
    titulo: 'Finalidades',
    parrafos: [
      'Crear y administrar tu cuenta en la aplicación.',
      'Elaborar cotizaciones, atender solicitudes de servicio y gestionar reservas y pagos.',
      'Contactarte sobre los servicios que solicitaste y enviarte información comercial de GOLDTRANS y Goldtours.',
      'Cumplir obligaciones legales del transporte especial, como el registro de pasajeros.',
    ],
  },
  {
    titulo: 'Tus derechos como titular',
    parrafos: [
      'Conocer, actualizar y rectificar tus datos personales.',
      'Solicitar prueba de la autorización que otorgaste.',
      'Ser informado sobre el uso que se da a tus datos.',
      'Revocar la autorización o pedir la supresión de tus datos cuando no exista un deber legal o contractual de conservarlos.',
      'Presentar quejas ante la Superintendencia de Industria y Comercio (SIC).',
    ],
  },
  {
    titulo: 'Cómo ejercer tus derechos',
    parrafos: [
      'Puedes actualizar tus datos en cualquier momento desde Mi perfil.',
      `Para consultas, reclamos, revocatoria o supresión escribe a ${CORREO_PRIVACIDAD}. Las consultas se responden en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles.`,
    ],
  },
  {
    titulo: 'Seguridad y datos sensibles',
    parrafos: [
      'Tus datos se guardan en servidores con acceso restringido por rol y comunicación cifrada (HTTPS).',
      'Los datos de menores de edad que viajen en un paquete se tratan solo para la prestación del servicio y con autorización de su representante legal.',
    ],
  },
];
