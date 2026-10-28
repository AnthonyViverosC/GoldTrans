import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { EstadoReservaTexto } from '@/components/estado-reserva';
import { EstadoVacio } from '@/components/estado-vacio';
import { Mensaje } from '@/components/mensaje';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { formatearPesos } from '@/lib/cotizador';
import {
  estadoVisible,
  listarMisReservas,
  plazoRestante,
  resumenPagos,
  saldoVencido,
  type ReservaCompleta,
} from '@/lib/reservas';

// HU-22 · HU-25 · HU-26 · Reservas Goldtours del cliente con su estado y saldo.
export default function MisReservas() {
  const { usuario } = useAuth();
  const [reservas, setReservas] = useState<ReservaCompleta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!usuario) return;
    let vigente = true;
    listarMisReservas(usuario.id).then((r) => {
      if (!vigente) return;
      setCargando(false);
      if (r.ok) {
        setReservas(r.data);
        setError(null);
      } else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [usuario, version]);

  // Se recarga al entrar (por ejemplo, después de reservar o registrar un abono).
  useFocusEffect(useCallback(() => setVersion((v) => v + 1), []));

  return (
    <FlatList
      contentContainerStyle={styles.lista}
      data={reservas}
      keyExtractor={(r) => r.id}
      refreshControl={
        <RefreshControl
          refreshing={cargando && reservas.length > 0}
          onRefresh={() => {
            setCargando(true);
            setVersion((v) => v + 1);
          }}
        />
      }
      ListHeaderComponent={
        <>
          <Link href="/goldtours" asChild>
            <Boton titulo="Ver paquetes Goldtours" variante="secundario" />
          </Link>
          <Mensaje texto={error} />
        </>
      }
      ListEmptyComponent={
        cargando ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <EstadoVacio
            icono="ticket-outline"
            texto={'Aún no tienes reservas. Elige un paquete en Goldtours, escoge la fecha de salida y toca «Reservar».'}
          />
        )
      }
      renderItem={({ item: r }) => {
        const estado = estadoVisible(r, r.abonos);
        const pagos = resumenPagos(r, r.abonos);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Ver la reserva y registrar abonos"
            onPress={() => router.push({ pathname: '/reservas/[id]', params: { id: r.id } })}
            style={({ pressed }) => [styles.tarjeta, pressed && styles.presionada]}>
            <View style={styles.filaTitulo}>
              <Text style={styles.codigo}>{r.codigo}</Text>
              <EstadoReservaTexto estado={estado} />
            </View>
            <Text style={styles.paquete}>{r.paquete_nombre}</Text>
            <Text style={styles.detalle}>
              {r.destino} · {r.fecha_salida} → {r.fecha_regreso} · {r.cupos} {r.cupos === 1 ? 'viajero' : 'viajeros'}
            </Text>
            <View style={styles.filaTitulo}>
              <Text style={[styles.detalle, saldoVencido(r) && styles.alerta]}>
                {estado === 'prerreserva'
                  ? pagos.enRevision > 0
                    ? 'Abono en revisión'
                    : plazoRestante(r.vence_at)
                  : estado === 'confirmada'
                    ? `Saldo hasta ${r.fecha_limite_pago}`
                    : ''}
              </Text>
              {estado === 'prerreserva' || estado === 'confirmada' ? (
                <Text style={styles.valor}>Saldo {formatearPesos(pagos.saldo)}</Text>
              ) : (
                <Text style={styles.valor}>{formatearPesos(r.valor_total)}</Text>
              )}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  lista: { padding: Spacing.md, gap: Spacing.md },
  vacio: { textAlign: 'center', color: Colors.muted, marginTop: Spacing.lg, fontSize: 15 },
  tarjeta: {
    padding: Spacing.md,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  presionada: { backgroundColor: Colors.surface },
  filaTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  codigo: { fontSize: 13, fontWeight: '600', color: Colors.primaryDark, letterSpacing: 0.5 },
  paquete: { fontSize: 17, fontWeight: '700', color: Colors.text, marginTop: Spacing.xs },
  detalle: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  alerta: { color: Colors.danger, fontWeight: '600' },
  valor: { fontSize: 16, fontWeight: '700', color: Colors.primaryDark },
});
