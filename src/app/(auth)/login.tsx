import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AccesoRapido } from '@/components/acceso-rapido';
import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { Logo } from '@/components/logo';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Colors, Radius, Sombra, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useSupabaseHealth } from '@/hooks/use-supabase-health';
import { iniciarSesion } from '@/lib/auth';
import { sinErrores, validarEmail } from '@/lib/validacion';

// HU-02 · Iniciar sesión con correo y contraseña.
export default function Login() {
  const { aviso, limpiarAviso } = useAuth();
  const health = useSupabaseHealth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    limpiarAviso();
    const nuevos = {
      email: validarEmail(email),
      password: password ? undefined : 'Ingresa tu contraseña',
    };
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;

    setEnviando(true);
    setError(null);
    const resultado = await iniciarSesion(email, password);
    setEnviando(false);
    // Si todo sale bien, AuthProvider carga el rol y la navegación cambia sola.
    if (!resultado.ok) setError(resultado.error);
  }

  const conectado = health.status === 'done' && health.ok;
  const sinConexion = health.status === 'done' && !health.ok;

  return (
    <PantallaFormulario
      cabecera={
        <View style={styles.marca}>
          <Logo tamano={112} />
          <Text style={styles.nombre}>
            GOLD<Text style={styles.trans}>TRANS</Text> S.A.S.
          </Text>
          <Text style={styles.lema}>Transporte terrestre especial · La Hormiga, Putumayo</Text>
        </View>
      }>
      {/* Lo que más busca un visitante va primero: cotizar o ver paquetes, sin cuenta. */}
      <View style={styles.accesos}>
        <Link href="/cotizador" asChild>
          <AccesoRapido icono="calculator" titulo="Cotizar viaje" detalle="Sin registrarte" />
        </Link>
        <Link href="/goldtours" asChild>
          <AccesoRapido icono="earth" titulo="Goldtours" detalle="Paquetes turísticos" />
        </Link>
      </View>

      <View style={styles.tarjeta}>
        <Text style={styles.tituloTarjeta}>Iniciar sesión</Text>
        <Mensaje texto={aviso ?? error} />

        <CampoTexto
          etiqueta="Correo electrónico"
          placeholder="tucorreo@ejemplo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          error={errores.email}
        />
        <CampoTexto
          etiqueta="Contraseña"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={entrar}
          error={errores.password}
        />
        <Link href="/recuperar" style={styles.olvido}>
          ¿Olvidaste tu contraseña?
        </Link>

        <Boton titulo="Iniciar sesión" icono="log-in-outline" onPress={entrar} cargando={enviando} />
      </View>

      <View style={styles.registro}>
        <Text style={styles.registroTexto}>¿No tienes cuenta?</Text>
        <Link href="/registro" style={styles.enlace}>
          Crear una cuenta
        </Link>
      </View>

      <View style={styles.estado}>
        <View
          style={[
            styles.punto,
            { backgroundColor: conectado ? Colors.success : sinConexion ? Colors.danger : Colors.border },
          ]}
        />
        <Text style={[styles.estadoTexto, sinConexion && { color: Colors.danger }]}>
          {health.status === 'loading'
            ? 'Verificando conexión…'
            : health.ok
              ? 'Servidor conectado'
              : `Sin conexión al servidor: ${health.error}`}
        </Text>
      </View>
    </PantallaFormulario>
  );
}

const styles = StyleSheet.create({
  marca: { alignItems: 'center', marginBottom: Spacing.lg },
  nombre: { marginTop: Spacing.sm, fontSize: 24, fontWeight: '800', color: Colors.primary, letterSpacing: 0.5 },
  trans: { color: Colors.accentDark },
  lema: { marginTop: Spacing.xs, fontSize: 14, color: Colors.muted, textAlign: 'center' },
  accesos: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  tarjeta: {
    padding: Spacing.lg,
    borderRadius: Radius + 4,
    backgroundColor: Colors.background,
    ...Sombra,
  },
  tituloTarjeta: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: Spacing.md },
  olvido: {
    alignSelf: 'flex-end',
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: -Spacing.xs,
    marginBottom: Spacing.md,
  },
  registro: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: Spacing.lg },
  registroTexto: { color: Colors.muted, fontSize: 15 },
  enlace: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  estado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.xl },
  punto: { width: 8, height: 8, borderRadius: 4 },
  estadoTexto: { fontSize: 12, color: Colors.muted },
});
