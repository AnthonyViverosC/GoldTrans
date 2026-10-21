import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { abrirArchivo, urlFirmada } from '@/lib/archivos';
import type { Abono } from '@/lib/reservas';

/**
 * HU-24 · El asesor ve el comprobante antes de aprobar. Las imágenes se muestran aquí;
 * los PDF se abren en el visor del sistema. Ambos con URL firmada (bucket privado).
 */
export function VistaComprobante({ abono }: { abono: Pick<Abono, 'comprobante_ruta' | 'comprobante_tipo'> }) {
  const esImagen = abono.comprobante_tipo.startsWith('image/');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!esImagen) return;
    let vigente = true;
    urlFirmada('comprobantes', abono.comprobante_ruta).then((r) => {
      if (!vigente) return;
      if (r.ok) setUrl(r.data);
      else setError(r.error);
    });
    return () => {
      vigente = false;
    };
  }, [abono.comprobante_ruta, esImagen]);

  async function abrir() {
    setError(null);
    const r = await abrirArchivo('comprobantes', abono.comprobante_ruta);
    if (!r.ok) setError(r.error);
  }

  return (
    <View style={styles.contenedor}>
      {esImagen ? (
        url ? (
          <Image
            source={url}
            style={styles.imagen}
            contentFit="contain"
            accessibilityLabel="Comprobante de transferencia"
          />
        ) : !error ? (
          <ActivityIndicator color={Colors.primary} style={styles.cargando} />
        ) : null
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Boton titulo={esImagen ? 'Abrir en tamaño completo' : 'Abrir comprobante PDF'} variante="secundario" onPress={abrir} />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: Spacing.sm },
  imagen: { width: '100%', aspectRatio: 3 / 4, borderRadius: Radius, backgroundColor: Colors.surface },
  cargando: { marginVertical: Spacing.lg },
  error: { color: Colors.danger, fontSize: 13 },
});
