import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { formatearPesos } from '@/lib/cotizador';
import {
  crearSolicitud,
  validarFormularioSolicitud,
  type FormularioSolicitud,
  type Solicitud,
} from '@/lib/solicitudes';
import { sinErrores, type Errores } from '@/lib/validacion';

type Props = {
  /** null = cerrado. */
  cotizacion: { id: string; codigo: string; origen: string; destino: string; valor_total: number } | null;
  onCerrar: () => void;
  onCreada: (s: Solicitud) => void;
};

/** HU-16 · Convierte una cotización del cliente en solicitud formal de servicio. */
export function ModalSolicitud({ cotizacion, onCerrar, onCreada }: Props) {
  return (
    <Modal
      visible={cotizacion !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCerrar}>
      {cotizacion ? <Formulario cotizacion={cotizacion} onCerrar={onCerrar} onCreada={onCreada} /> : null}
    </Modal>
  );
}

function Formulario({
  cotizacion: c,
  onCerrar,
  onCreada,
}: Props & { cotizacion: NonNullable<Props['cotizacion']> }) {
  const { usuario } = useAuth();
  const perfil = usuario?.perfil;
  const [datos, setDatos] = useState<FormularioSolicitud>({
    nombreContacto: perfil?.nombre_completo ?? '',
    telefonoContacto: perfil?.telefono ?? '',
    direccionRecogida: '',
    horaRecogida: '',
    observaciones: '',
  });
  const [errores, setErrores] = useState<Errores<keyof FormularioSolicitud>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function cambiar(campo: keyof FormularioSolicitud, valor: string) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function enviar() {
    const nuevos = validarFormularioSolicitud(datos);
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;
    setEnviando(true);
    setError(null);
    const r = await crearSolicitud(c.id, datos);
    setEnviando(false);
    if (r.ok) onCreada(r.data);
    else setError(r.error);
  }

  return (
    <PantallaFormulario titulo="Solicitar servicio">
      <View style={styles.resumen}>
        <Text style={styles.ruta}>
          {c.origen} → {c.destino}
        </Text>
        <Text style={styles.dato}>
          Cotización {c.codigo} · {formatearPesos(c.valor_total)}
        </Text>
      </View>

      <CampoTexto
        etiqueta="Nombre de quien recibe el servicio"
        value={datos.nombreContacto}
        onChangeText={(v) => cambiar('nombreContacto', v)}
        error={errores.nombreContacto}
      />
      <CampoTexto
        etiqueta="Teléfono / WhatsApp de contacto"
        keyboardType="phone-pad"
        value={datos.telefonoContacto}
        onChangeText={(v) => cambiar('telefonoContacto', v)}
        error={errores.telefonoContacto}
      />
      <CampoTexto
        etiqueta="Dirección de recogida"
        placeholder="Barrio, calle, punto de referencia"
        value={datos.direccionRecogida}
        onChangeText={(v) => cambiar('direccionRecogida', v)}
        error={errores.direccionRecogida}
      />
      <CampoTexto
        etiqueta="Hora de recogida"
        placeholder="06:30"
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        value={datos.horaRecogida}
        onChangeText={(v) => cambiar('horaRecogida', v)}
        error={errores.horaRecogida}
        ayuda="Formato 24 horas"
      />
      <CampoTexto
        etiqueta="Observaciones (opcional)"
        placeholder="Equipaje, paradas, necesidades especiales…"
        multiline
        style={styles.multilinea}
        value={datos.observaciones}
        onChangeText={(v) => cambiar('observaciones', v)}
      />

      <Mensaje texto={error} />
      <View style={styles.botones}>
        <Boton titulo="Enviar solicitud" onPress={enviar} cargando={enviando} />
        <Boton titulo="Cancelar" variante="secundario" onPress={onCerrar} disabled={enviando} />
      </View>
    </PantallaFormulario>
  );
}

const styles = StyleSheet.create({
  resumen: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  ruta: { fontSize: 17, fontWeight: '700', color: Colors.text },
  dato: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  multilinea: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  botones: { gap: Spacing.md },
});
