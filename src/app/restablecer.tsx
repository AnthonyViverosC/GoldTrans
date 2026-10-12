import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Boton } from '@/components/boton';
import { CampoTexto } from '@/components/campo-texto';
import { Mensaje } from '@/components/mensaje';
import { PantallaFormulario } from '@/components/pantalla-formulario';
import { actualizarPassword, cerrarSesion, enviarRecuperacion, verificarCodigoRecuperacion } from '@/lib/auth';
import {
  sinErrores,
  validarCodigo,
  validarConfirmacion,
  validarEmail,
  validarPassword,
} from '@/lib/validacion';

type Campos = 'email' | 'codigo' | 'password' | 'confirmacion';

// HU-07 · Recuperar contraseña (paso 2: código del correo + nueva contraseña).
export default function Restablecer() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState<Partial<Record<Campos, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    params.email ? `Enviamos un código a ${params.email}.` : null,
  );
  // Tras verificar el código ya hay sesión: si falla el cambio de clave no se vuelve a verificar.
  const [verificado, setVerificado] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  async function guardar() {
    const nuevos = {
      email: verificado ? undefined : validarEmail(email),
      codigo: verificado ? undefined : validarCodigo(codigo),
      password: validarPassword(password),
      confirmacion: validarConfirmacion(password, confirmacion),
    };
    setErrores(nuevos);
    if (!sinErrores(nuevos)) return;

    setGuardando(true);
    setError(null);
    setInfo(null);
    if (!verificado) {
      const r = await verificarCodigoRecuperacion(email, codigo);
      if (!r.ok) {
        setGuardando(false);
        setError(r.error);
        return;
      }
      setVerificado(true);
    }
    const r = await actualizarPassword(password);
    setGuardando(false);
    if (r.ok) setGuardado(true);
    else setError(r.error);
  }

  async function reenviar() {
    const err = validarEmail(email);
    setErrores({ email: err });
    if (err) return;
    setReenviando(true);
    setError(null);
    const r = await enviarRecuperacion(email);
    setReenviando(false);
    if (r.ok) setInfo(`Enviamos un nuevo código a ${email.trim().toLowerCase()}.`);
    else setError(r.error);
  }

  async function cancelar() {
    // Si el código ya se verificó hay una sesión abierta sin clave nueva: se cierra.
    if (verificado) await cerrarSesion();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  if (guardado) {
    return (
      <PantallaFormulario titulo="Contraseña actualizada">
        <Mensaje tipo="exito" texto="Tu contraseña se cambió correctamente." />
        <Boton titulo="Continuar" onPress={() => router.replace('/')} />
      </PantallaFormulario>
    );
  }

  return (
    <PantallaFormulario
      titulo="Nueva contraseña"
      subtitulo="Escribe el código que llegó a tu correo y tu nueva contraseña">
      <Mensaje tipo="exito" texto={info} />
      <Mensaje texto={error} />

      {!verificado ? (
        <>
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
            etiqueta="Código de verificación"
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
            value={codigo}
            onChangeText={(v) => setCodigo(v.replace(/\D/g, ''))}
            error={errores.codigo}
          />
        </>
      ) : null}

      <CampoTexto
        etiqueta="Nueva contraseña"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        value={password}
        onChangeText={setPassword}
        error={errores.password}
        ayuda="Mínimo 8 caracteres, con letras y números"
      />
      <CampoTexto
        etiqueta="Confirmar contraseña"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        value={confirmacion}
        onChangeText={setConfirmacion}
        onSubmitEditing={guardar}
        error={errores.confirmacion}
      />

      <Boton titulo="Guardar contraseña" onPress={guardar} cargando={guardando} />
      {!verificado ? (
        <Boton titulo="Reenviar código" variante="texto" onPress={reenviar} cargando={reenviando} />
      ) : null}
      <Boton titulo="Cancelar" variante="texto" onPress={cancelar} disabled={guardando} />
    </PantallaFormulario>
  );
}
