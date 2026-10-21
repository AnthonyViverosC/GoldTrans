import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Boton } from '@/components/boton';
import { Mensaje } from '@/components/mensaje';
import { Spacing } from '@/constants/theme';
import type { Resultado } from '@/lib/auth';
import {
  descargarPdf,
  enviarPorCorreo,
  enviarPorWhatsApp,
  type CotizacionCompartible,
} from '@/lib/compartir';

type Accion = 'whatsapp' | 'correo' | 'pdf';

const ACCIONES: Record<Accion, (c: CotizacionCompartible) => Promise<Resultado>> = {
  whatsapp: enviarPorWhatsApp,
  correo: enviarPorCorreo,
  pdf: descargarPdf,
};

/** HU-15 · Enviar la cotización por WhatsApp o correo, o descargarla en PDF. */
export function AccionesCompartir({ cotizacion }: { cotizacion: CotizacionCompartible }) {
  const [ocupado, setOcupado] = useState<Accion | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar(accion: Accion) {
    setOcupado(accion);
    setError(null);
    const r = await ACCIONES[accion](cotizacion);
    setOcupado(null);
    if (!r.ok) setError(r.error);
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.fila}>
        <View style={styles.boton}>
          <Boton
            titulo="WhatsApp"
            variante="secundario"
            cargando={ocupado === 'whatsapp'}
            disabled={ocupado !== null}
            onPress={() => ejecutar('whatsapp')}
          />
        </View>
        <View style={styles.boton}>
          <Boton
            titulo="Correo"
            variante="secundario"
            cargando={ocupado === 'correo'}
            disabled={ocupado !== null}
            onPress={() => ejecutar('correo')}
          />
        </View>
        <View style={styles.boton}>
          <Boton
            titulo="PDF"
            variante="secundario"
            cargando={ocupado === 'pdf'}
            disabled={ocupado !== null}
            onPress={() => ejecutar('pdf')}
          />
        </View>
      </View>
      <Mensaje texto={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginTop: Spacing.sm },
  fila: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  boton: { flex: 1 },
});
