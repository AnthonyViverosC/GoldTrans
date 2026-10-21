import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { estilosCampo } from '@/components/campo-texto';
import { Colors, Radius, Sombra, Spacing } from '@/constants/theme';
import {
  DIAS_SEMANA,
  MESES,
  aTexto,
  fechaLarga,
  fueraDeRango,
  leerFecha,
  moverMes,
  semanasDelMes,
  type Mes,
} from '@/lib/calendario';
import { hoyEnColombia } from '@/lib/cotizador';

type Props = {
  etiqueta: string;
  /** AAAA-MM-DD o vacío. */
  value: string;
  onChangeText: (valor: string) => void;
  error?: string;
  ayuda?: string;
  placeholder?: string;
  /** Límites inclusivos AAAA-MM-DD (o "hoy"): los días fuera del rango no se pueden elegir. */
  minimo?: string;
  maximo?: string;
  /** Muestra "Quitar fecha" para dejar el campo vacío. */
  opcional?: boolean;
};

/** Campo de fecha con calendario. Reemplaza escribir "AAAA-MM-DD" a mano; el valor sigue siendo ese texto. */
export function CampoFecha({ etiqueta, value, onChangeText, error, ayuda, placeholder, opcional, ...limites }: Props) {
  const [abierto, setAbierto] = useState(false);
  const hoy = hoyEnColombia();
  const minimo = limites.minimo === 'hoy' ? hoy : limites.minimo;
  const maximo = limites.maximo === 'hoy' ? hoy : limites.maximo;
  const valida = !!leerFecha(value);

  return (
    <View style={styles.contenedor}>
      <Text style={estilosCampo.etiqueta}>{etiqueta}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}: ${valida ? fechaLarga(value) : 'sin elegir'}`}
        accessibilityHint="Abre el calendario"
        onPress={() => setAbierto(true)}
        style={({ pressed }) => [
          estilosCampo.caja,
          styles.caja,
          (pressed || abierto) && estilosCampo.cajaEnfocada,
          !!error && estilosCampo.cajaError,
        ]}>
        <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
        <Text style={[styles.valor, !value && styles.placeholder]} numberOfLines={1}>
          {valida ? fechaLarga(value) : value || placeholder || 'Elegir fecha'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Colors.muted} />
      </Pressable>
      {error ? (
        <View style={styles.filaError}>
          <Ionicons name="alert-circle" size={14} color={Colors.danger} />
          <Text style={estilosCampo.error}>{error}</Text>
        </View>
      ) : ayuda ? (
        <Text style={estilosCampo.ayuda}>{ayuda}</Text>
      ) : null}

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <Pressable style={styles.fondo} onPress={() => setAbierto(false)} accessibilityLabel="Cerrar calendario">
          {/* Pressable interno: los toques dentro de la tarjeta no cierran el calendario */}
          <Pressable style={styles.tarjeta} onPress={() => {}}>
            <Calendario
              titulo={etiqueta}
              valor={value}
              minimo={minimo}
              maximo={maximo}
              onElegir={(f) => {
                onChangeText(f);
                setAbierto(false);
              }}
            />
            <View style={styles.pie}>
              {opcional && value ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChangeText('');
                    setAbierto(false);
                  }}>
                  <Text style={styles.quitar}>Quitar fecha</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable accessibilityRole="button" onPress={() => setAbierto(false)}>
                <Text style={styles.cancelar}>Cancelar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

type CalendarioProps = {
  titulo: string;
  valor: string;
  minimo?: string;
  maximo?: string;
  onElegir: (fecha: string) => void;
};

function Calendario({ titulo, valor, minimo, maximo, onElegir }: CalendarioProps) {
  const hoy = hoyEnColombia();
  const inicial = leerFecha(valor) ?? leerFecha(minimo && minimo > hoy ? minimo : hoy)!;
  const [mes, setMes] = useState<Mes>({ anio: inicial.anio, mes: inicial.mes });
  const [eligiendoAnio, setEligiendoAnio] = useState(false);

  const anioActual = Number(hoy.slice(0, 4));
  const desde = minimo ? Number(minimo.slice(0, 4)) : anioActual - 100;
  const hasta = maximo ? Number(maximo.slice(0, 4)) : anioActual + 10;
  const anios = Array.from({ length: hasta - desde + 1 }, (_, i) => hasta - i);

  return (
    <View>
      <Text style={styles.tituloModal}>{titulo}</Text>
      <View style={styles.navegacion}>
        <BotonIcono icono="chevron-back" etiqueta="Mes anterior" onPress={() => setMes((m) => moverMes(m, -1))} />
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Elegir el año"
          onPress={() => setEligiendoAnio((v) => !v)}
          style={styles.mesAnio}>
          <Text style={styles.mesAnioTexto}>
            {MESES[mes.mes]} {mes.anio}
          </Text>
          <Ionicons name={eligiendoAnio ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.primary} />
        </Pressable>
        <BotonIcono icono="chevron-forward" etiqueta="Mes siguiente" onPress={() => setMes((m) => moverMes(m, 1))} />
      </View>

      {eligiendoAnio ? (
        <ScrollView style={styles.anios} contentContainerStyle={styles.aniosGrid}>
          {anios.map((a) => (
            <Pressable
              key={a}
              accessibilityRole="button"
              onPress={() => {
                setMes((m) => ({ ...m, anio: a }));
                setEligiendoAnio(false);
              }}
              style={[styles.anio, a === mes.anio && styles.diaElegido]}>
              <Text style={[styles.diaTexto, a === mes.anio && styles.diaTextoElegido]}>{a}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View>
          <View style={styles.semana}>
            {DIAS_SEMANA.map((d, i) => (
              <Text key={i} style={styles.diaSemana}>
                {d}
              </Text>
            ))}
          </View>
          {semanasDelMes(mes).map((semana, i) => (
            <View key={i} style={styles.semana}>
              {semana.map((dia, j) => {
                if (!dia) return <View key={j} style={styles.dia} />;
                const fecha = aTexto(mes.anio, mes.mes, dia);
                const elegido = fecha === valor;
                const bloqueado = fueraDeRango(fecha, minimo, maximo);
                return (
                  <Pressable
                    key={j}
                    accessibilityRole="button"
                    accessibilityLabel={fechaLarga(fecha)}
                    accessibilityState={{ selected: elegido, disabled: bloqueado }}
                    disabled={bloqueado}
                    onPress={() => onElegir(fecha)}
                    style={({ pressed }) => [
                      styles.dia,
                      fecha === hoy && styles.diaHoy,
                      pressed && styles.diaPresionado,
                      elegido && styles.diaElegido,
                    ]}>
                    <Text
                      style={[
                        styles.diaTexto,
                        bloqueado && styles.diaBloqueado,
                        elegido && styles.diaTextoElegido,
                      ]}>
                      {dia}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          {!fueraDeRango(hoy, minimo, maximo) && hoy !== valor ? (
            <Pressable accessibilityRole="button" onPress={() => onElegir(hoy)} style={styles.hoy}>
              <Text style={styles.hoyTexto}>Hoy</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

function BotonIcono({ icono, etiqueta, onPress }: { icono: 'chevron-back' | 'chevron-forward'; etiqueta: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.botonIcono, pressed && styles.diaPresionado]}>
      <Ionicons name={icono} size={22} color={Colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginBottom: Spacing.md },
  caja: { paddingHorizontal: 14, gap: Spacing.sm },
  valor: { flex: 1, fontSize: 16, color: Colors.text },
  placeholder: { color: Colors.muted },
  filaError: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(20, 33, 61, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  tarjeta: {
    width: '100%',
    maxWidth: 360,
    padding: Spacing.md,
    borderRadius: Radius + 4,
    backgroundColor: Colors.background,
    ...Sombra,
  },
  tituloModal: { fontSize: 13, fontWeight: '600', color: Colors.muted, textAlign: 'center', marginBottom: Spacing.sm },
  navegacion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  botonIcono: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  mesAnio: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: Radius },
  mesAnioTexto: { fontSize: 17, fontWeight: '700', color: Colors.text, textTransform: 'capitalize' },
  semana: { flexDirection: 'row' },
  diaSemana: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: Colors.muted, paddingVertical: 6 },
  dia: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999, margin: 1 },
  diaHoy: { borderWidth: 1.5, borderColor: Colors.accent },
  diaPresionado: { backgroundColor: Colors.surface },
  diaElegido: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  diaTexto: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  diaTextoElegido: { color: Colors.onPrimary, fontWeight: '700' },
  diaBloqueado: { color: Colors.border },
  hoy: { alignSelf: 'center', marginTop: Spacing.sm, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 999, backgroundColor: Colors.surface },
  hoyTexto: { color: Colors.primary, fontWeight: '700' },
  anios: { maxHeight: 280 },
  aniosGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  anio: { width: '25%', paddingVertical: 12, alignItems: 'center', borderRadius: 999 },
  pie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md },
  quitar: { color: Colors.danger, fontWeight: '600', fontSize: 15 },
  cancelar: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
});
