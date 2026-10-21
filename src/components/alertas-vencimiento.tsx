import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { listarMisAlertas, marcarAlertasLeidas, type Alerta } from '@/lib/licitaciones';

/** HU-28 · Alertas de vencimiento sin leer del usuario (las crea el cron diario). */
export function AlertasVencimiento() {
  const { usuario } = useAuth();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [abiertas, setAbiertas] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!usuario) return;
      let vigente = true;
      listarMisAlertas(usuario.id).then((r) => {
        if (vigente && r.ok) setAlertas(r.data);
      });
      return () => {
        vigente = false;
      };
    }, [usuario]),
  );

  if (!alertas.length) return null;

  async function marcarLeidas() {
    setOcupado(true);
    const r = await marcarAlertasLeidas(alertas.map((a) => a.id));
    setOcupado(false);
    if (r.ok) setAlertas([]);
  }

  const urgentes = alertas.filter((a) => a.umbral <= 15).length;

  return (
    <View style={[styles.caja, urgentes > 0 && styles.urgente]}>
      <Text style={styles.titulo}>
        {alertas.length === 1 ? '1 alerta de vencimiento' : `${alertas.length} alertas de vencimiento`}
      </Text>
      {abiertas
        ? alertas.map((a) => (
            <Text key={a.id} style={[styles.texto, a.umbral <= 15 && styles.textoUrgente]}>
              • {a.mensaje}
            </Text>
          ))
        : null}
      <View style={styles.botones}>
        <Boton
          titulo={abiertas ? 'Ocultar' : 'Ver alertas'}
          variante="texto"
          onPress={() => setAbiertas((x) => !x)}
        />
        {abiertas ? <Boton titulo="Marcar como leídas" variante="texto" onPress={marcarLeidas} cargando={ocupado} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.primaryDark,
    backgroundColor: Colors.surface,
  },
  urgente: { borderColor: Colors.danger, backgroundColor: Colors.dangerBg },
  titulo: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: Spacing.xs },
  texto: { fontSize: 14, color: Colors.text, marginTop: Spacing.xs, lineHeight: 20 },
  textoUrgente: { color: Colors.danger },
  botones: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
});
