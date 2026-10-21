import { StyleSheet, Text } from 'react-native';

import { Colors } from '@/constants/theme';
import { ETIQUETA_ITEM, ETIQUETA_VIGENCIA, type EstadoItem, type EstadoVigencia } from '@/lib/licitaciones';

export const COLOR_VIGENCIA: Record<EstadoVigencia, string> = {
  vigente: Colors.success,
  por_vencer: Colors.primaryDark,
  vencido: Colors.danger,
  sin_vigencia: Colors.muted,
};

const COLOR_ITEM: Record<EstadoItem, string> = {
  cumple: Colors.success,
  vence_antes_cierre: Colors.primaryDark,
  vencido: Colors.danger,
  pendiente: Colors.muted,
};

export function EstadoVigenciaTexto({ estado }: { estado: EstadoVigencia }) {
  return <Text style={[styles.estado, { color: COLOR_VIGENCIA[estado] }]}>{ETIQUETA_VIGENCIA[estado]}</Text>;
}

export function EstadoItemTexto({ estado }: { estado: EstadoItem }) {
  return <Text style={[styles.estado, { color: COLOR_ITEM[estado] }]}>{ETIQUETA_ITEM[estado]}</Text>;
}

const styles = StyleSheet.create({
  estado: { fontSize: 13, fontWeight: '700' },
});
