import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { Colors, Spacing } from '@/constants/theme';
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

  return (
    <PantallaFormulario titulo="GOLDTRANS S.A.S." subtitulo="Transporte terrestre especial">
      <Mensaje texto={aviso ?? error} />

      <CampoTexto
        etiqueta="Correo electrónico"
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

      <Boton titulo="Iniciar sesión" onPress={entrar} cargando={enviando} />

      <View style={styles.enlaces}>
        <Link href="/recuperar" style={styles.enlace}>
          ¿Olvidaste tu contraseña?
        </Link>
        <Link href="/registro" style={styles.enlace}>
          Crear una cuenta
        </Link>
      </View>

      <View style={styles.separador} />
      <Link href="/cotizador" asChild>
        <Boton titulo="Cotizar sin registrarme" variante="secundario" />
      </Link>

      <Text style={[styles.estado, { color: health.status === 'done' && !health.ok ? Colors.danger : Colors.muted }]}>
        {health.status === 'loading'
          ? 'Verificando conexión…'
          : health.ok
            ? 'Servidor conectado'
            : `Sin conexión al servidor: ${health.error}`}
      </Text>
    </PantallaFormulario>
  );
}

const styles = StyleSheet.create({
  enlaces: { marginTop: Spacing.lg, gap: Spacing.md, alignItems: 'center' },
  enlace: { color: Colors.primaryDark, fontSize: 15, fontWeight: '600' },
  separador: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },
  estado: { marginTop: Spacing.xl, fontSize: 12, textAlign: 'center' },
});
