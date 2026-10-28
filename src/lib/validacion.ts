// Validaciones de formularios. Las mismas reglas existen como CHECK en la base de datos.

export type Errores<K extends string> = Partial<Record<K, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validarEmail(email: string): string | undefined {
  if (!email.trim()) return 'Ingresa tu correo';
  if (!EMAIL_RE.test(email.trim())) return 'Correo no válido';
}

export const PASSWORD_MIN = 8;

export function validarPassword(password: string): string | undefined {
  if (password.length < PASSWORD_MIN) return `Mínimo ${PASSWORD_MIN} caracteres`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Debe tener letras y números';
  }
}

/** Código de un solo uso enviado por correo (otp_length de Supabase: 6 a 10 dígitos). */
export function validarCodigo(codigo: string): string | undefined {
  if (!/^\d{6,10}$/.test(codigo.trim())) return 'Ingresa el código que te llegó al correo';
}

export function validarConfirmacion(password: string, confirmacion: string): string | undefined {
  if (password !== confirmacion) return 'Las contraseñas no coinciden';
}

const PESOS_NIT = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/** Dígito de verificación de un NIT colombiano (algoritmo DIAN, módulo 11). */
export function calcularDigitoVerificacion(nit: string): number {
  const digitos = nit.split('').reverse();
  const suma = digitos.reduce((acc, d, i) => acc + Number(d) * PESOS_NIT[i], 0);
  const residuo = suma % 11;
  return residuo > 1 ? 11 - residuo : residuo;
}

/** Normaliza "900.123.456-8" → "900123456-8". */
export function normalizarNit(nit: string): string {
  return nit.replace(/[.\s]/g, '');
}

export function validarNit(nit: string): string | undefined {
  const limpio = normalizarNit(nit);
  if (!limpio) return 'Ingresa el NIT';
  const match = /^(\d{6,15})-(\d)$/.exec(limpio);
  if (!match) return 'Formato: 900123456-8 (con dígito de verificación)';
  if (calcularDigitoVerificacion(match[1]) !== Number(match[2])) {
    return 'El dígito de verificación no corresponde al NIT';
  }
}

export function validarDocumento(numero: string): string | undefined {
  if (!numero.trim()) return 'Ingresa el número de documento';
  if (!/^[0-9A-Za-z]{4,20}$/.test(numero.trim())) return 'Documento no válido';
}

export function normalizarTelefono(telefono: string): string {
  return telefono.replace(/[\s()-]/g, '');
}

export function validarTelefono(telefono: string, requerido = false): string | undefined {
  const limpio = normalizarTelefono(telefono);
  if (!limpio) return requerido ? 'Ingresa un teléfono' : undefined;
  if (!/^\+?[0-9]{7,15}$/.test(limpio)) return 'Teléfono no válido';
}

export function requerido(valor: string, mensaje = 'Campo obligatorio'): string | undefined {
  if (!valor.trim()) return mensaje;
}

// ─── Registro (HU-01) ─────────────────────────────────────────

export type TipoPersona = 'persona' | 'empresa';
export const TIPOS_DOCUMENTO = ['CC', 'CE', 'PA', 'TI'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export type DatosPerfil = {
  tipoPersona: TipoPersona;
  nombreCompleto: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  razonSocial: string;
  nit: string;
  telefono: string;
  ciudad: string;
};

export type DatosRegistro = DatosPerfil & {
  email: string;
  password: string;
  confirmacion: string;
  /** RNF-03 · Autorización de tratamiento de datos (Ley 1581 de 2012); la casilla empieza sin marcar. */
  autorizaDatos: boolean;
};

export function validarPerfil(d: DatosPerfil): Errores<keyof DatosPerfil> {
  const errores: Errores<keyof DatosPerfil> = {
    nombreCompleto: requerido(
      d.nombreCompleto,
      d.tipoPersona === 'empresa' ? 'Ingresa el nombre del representante' : 'Ingresa tu nombre',
    ),
    telefono: validarTelefono(d.telefono, true),
  };
  if (d.tipoPersona === 'persona') {
    errores.numeroDocumento = validarDocumento(d.numeroDocumento);
  } else {
    errores.razonSocial = requerido(d.razonSocial, 'Ingresa la razón social');
    errores.nit = validarNit(d.nit);
  }
  return limpiar(errores);
}

export function validarRegistro(d: DatosRegistro): Errores<keyof DatosRegistro> {
  return limpiar({
    ...validarPerfil(d),
    email: validarEmail(d.email),
    password: validarPassword(d.password),
    confirmacion: validarConfirmacion(d.password, d.confirmacion),
    autorizaDatos: d.autorizaDatos
      ? undefined
      : 'Debes autorizar el tratamiento de tus datos personales para crear la cuenta',
  });
}

// ─── Vehículos (HU-06) ────────────────────────────────────────

export function normalizarPlaca(placa: string): string {
  return placa.replace(/[\s-]/g, '').toUpperCase();
}

export function validarPlaca(placa: string): string | undefined {
  if (!/^[A-Z]{3}[0-9]{3}$/.test(normalizarPlaca(placa))) return 'Formato: ABC123';
}

export function validarEntero(
  valor: string,
  min: number,
  max: number,
  mensaje: string,
): string | undefined {
  const n = Number(valor);
  if (!/^\d+$/.test(valor.trim()) || n < min || n > max) return mensaje;
}

// ─── Rutas y tarifas (HU-09 · HU-10) ──────────────────────────

/** "$ 1.250.000" → "1250000" (los valores en pesos se escriben con puntos de miles). */
export function normalizarPesos(valor: string): string {
  return valor.replace(/[$\s.]/g, '');
}

export function validarPesos(valor: string, mensaje = 'Valor en pesos no válido'): string | undefined {
  return validarEntero(normalizarPesos(valor), 0, 100_000_000, mensaje);
}

/** "132,5" o "132.5" → 132.5 (NaN si no es un número). */
export function aDecimal(valor: string): number {
  const limpio = valor.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : NaN;
}

export function validarDecimal(
  valor: string,
  min: number,
  max: number,
  mensaje: string,
): string | undefined {
  const n = aDecimal(valor);
  if (Number.isNaN(n) || n < min || n > max) return mensaje;
}

/** Fecha opcional AAAA-MM-DD. */
export function validarFecha(valor: string): string | undefined {
  if (!valor.trim()) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
  if (!m) return 'Formato: AAAA-MM-DD';
  const fecha = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (fecha.getUTCMonth() !== Number(m[2]) - 1 || fecha.getUTCDate() !== Number(m[3])) {
    return 'Fecha no válida';
  }
}

export function sinErrores(errores: Record<string, string | undefined>): boolean {
  return Object.values(errores).every((e) => !e);
}

function limpiar<T extends Record<string, string | undefined>>(errores: T): T {
  for (const k of Object.keys(errores)) {
    if (!errores[k]) delete errores[k];
  }
  return errores;
}
