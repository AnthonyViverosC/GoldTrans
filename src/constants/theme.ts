import { Platform, type ViewStyle } from 'react-native';

/** Paleta tomada del logo de GOLDTRANS: azul rey + dorado. */
export const Colors = {
  primary: '#1A4294',
  primaryDark: '#102E6E',
  onPrimary: '#FFFFFF',
  /** Dorado de marca: acentos, nunca texto pequeño sobre blanco (bajo contraste). */
  accent: '#E3B341',
  /** Dorado oscuro, legible como texto sobre blanco. */
  accentDark: '#8A6410',
  accentBg: '#FDF5E1',
  /** Fondo de las pantallas. Tarjetas y campos van en `background` (blanco) encima. */
  page: '#F3F5F9',
  background: '#FFFFFF',
  /** Paneles suaves dentro de una tarjeta, estado presionado, selección. */
  surface: '#EAF0FA',
  border: '#D9E0EB',
  text: '#14213D',
  muted: '#5E6A7E',
  success: '#1E7B3A',
  successBg: '#E6F4EA',
  warning: '#9A5B00',
  warningBg: '#FFF3DC',
  danger: '#C62828',
  dangerBg: '#FDECEA',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = 12;

/** Sombra suave para tarjetas destacadas. */
export const Sombra: ViewStyle = Platform.select({
  web: { boxShadow: '0 2px 10px rgba(20, 33, 61, 0.08)' },
  default: {
    shadowColor: '#14213D',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
}) as ViewStyle;
