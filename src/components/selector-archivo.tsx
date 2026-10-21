import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  REGLAS,
  elegirDocumento,
  elegirImagen,
  formatearTamano,
  validarArchivo,
  type ArchivoElegido,
  type Bucket,
} from '@/lib/archivos';

type Props = {
  etiqueta: string;
  bucket: Bucket;
  archivo: ArchivoElegido | null;
  onCambio: (archivo: ArchivoElegido | null) => void;
  error?: string;
  deshabilitado?: boolean;
};

/** Adjuntar una foto de la galería o un archivo (PDF, Word...) con las reglas del bucket. */
export function SelectorArchivo({ etiqueta, bucket, archivo, onCambio, error, deshabilitado }: Props) {
  const [invalido, setInvalido] = useState<string | null>(null);

  async function elegir(origen: 'imagen' | 'archivo') {
    setInvalido(null);
    let elegido: ArchivoElegido | null;
    try {
      elegido = origen === 'imagen' ? await elegirImagen() : await elegirDocumento(bucket);
    } catch {
      setInvalido('No se pudo abrir el selector de archivos');
      return;
    }
    if (!elegido) return;
    const problema = validarArchivo(elegido, bucket);
    if (problema) {
      setInvalido(problema);
      return;
    }
    onCambio(elegido);
  }

  const mensaje = invalido ?? error;

  return (
    <View style={styles.contenedor}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      {archivo ? (
        <View style={styles.elegido}>
          <View style={styles.flex}>
            <Text style={styles.nombre} numberOfLines={1}>
              {archivo.nombre}
            </Text>
            {archivo.tamano !== null ? <Text style={styles.ayuda}>{formatearTamano(archivo.tamano)}</Text> : null}
          </View>
          <Boton titulo="Quitar" variante="texto" onPress={() => onCambio(null)} disabled={deshabilitado} />
        </View>
      ) : (
        <View style={styles.botones}>
          <View style={styles.flex}>
            <Boton titulo="Foto o captura" variante="secundario" onPress={() => elegir('imagen')} disabled={deshabilitado} />
          </View>
          <View style={styles.flex}>
            <Boton
              titulo={bucket === 'comprobantes' ? 'Archivo PDF' : 'Archivo'}
              variante="secundario"
              onPress={() => elegir('archivo')}
              disabled={deshabilitado}
            />
          </View>
        </View>
      )}
      {mensaje ? <Text style={styles.error}>{mensaje}</Text> : <Text style={styles.ayuda}>{REGLAS[bucket].ayuda}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { marginBottom: Spacing.md },
  etiqueta: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: Spacing.xs },
  botones: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
  elegido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.md,
    borderRadius: Radius,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  nombre: { fontSize: 15, color: Colors.text, fontWeight: '600' },
  ayuda: { color: Colors.muted, fontSize: 13, marginTop: Spacing.xs },
  error: { color: Colors.danger, fontSize: 13, marginTop: Spacing.xs },
});
