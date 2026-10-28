# Sprint 1 — Base y gestión de usuarios

## Qué incluye

| Ítem | Implementación |
|---|---|
| HU-01 Registro persona / empresa | `src/app/(auth)/registro.tsx` · trigger `handle_new_user` crea `usuarios` + `perfiles` · NIT validado con dígito de verificación DIAN |
| HU-02 Inicio de sesión | `src/app/(auth)/login.tsx` · sesión persistente en AsyncStorage (`src/hooks/use-auth.tsx`) |
| HU-03 Cuatro roles | `visitante` (sin sesión), `cliente`, `asesor`, `admin` · `Stack.Protected` por grupo en `src/app/_layout.tsx` |
| HU-04 Perfil | `src/app/perfil.tsx` (todos los roles con sesión) |
| HU-05 Cotizar sin registro | `src/app/(public)/cotizador.tsx` — accesible sin sesión; el cálculo llega en el Sprint 2 |
| HU-06 Flota | `src/app/(admin)/flota.tsx` · tabla `vehiculos` |
| HU-07 Recuperar contraseña | `(auth)/recuperar.tsx` envía un **código** al correo → `restablecer.tsx` lo verifica (`verifyOtp`) y guarda la nueva clave. Sin enlaces: funciona igual en Expo Go, web y la app instalada |
| HU-08 Gestión de usuarios | `src/app/(admin)/usuarios.tsx` · activar / desactivar / cambiar rol |
| RNF-01 Usabilidad y diseño responsivo móvil | Formularios en `PantallaFormulario` (ancho máximo 480, scroll y teclado) · *pendiente de verificar en Jira: cotizar en máximo 4 pasos y prueba en celulares de distintos tamaños* |
| RNF-02 Seguridad en acceso y manejo de información | Contraseñas cifradas por Supabase Auth, todo por HTTPS, sesión JWT y acceso por rol en pantallas (`Stack.Protected`) y datos (RLS) · `supabase/migrations/20261008000000_usuarios_roles.sql` · pruebas en `supabase/tests/database/rls_usuarios.test.sql` |
| RNF-03 Tratamiento de datos (Ley 1581 de 2012) | Aviso de privacidad en `src/app/(public)/privacidad.tsx` (texto en `src/constants/privacidad.ts`) · casilla de autorización obligatoria en el registro · el trigger `handle_new_user` rechaza registros sin autorización y guarda la prueba (`perfiles.autoriza_datos_at`, `version_aviso_privacidad`) · migración `20261030000000_autorizacion_datos.sql` · pruebas en `supabase/tests/database/privacidad.test.sql` |
| Pruebas unitarias (base de RNF-07) | `src/lib/__tests__/` (auth, roles, validación) |

> Los nombres de los requisitos siguen el backlog de Jira (proyecto SCRUM): las historias **HU-XX** del código son las **RF-XX** de Jira con el mismo número.

### RNF-03 · Antes de producción

- GOLDTRANS debe revisar el texto del aviso y confirmar el correo de contacto (`CORREO_PRIVACIDAD` en `src/constants/privacidad.ts`, hoy es un valor provisional).
- Si el aviso cambia, subir `VERSION_AVISO_PRIVACIDAD`: cada perfil guarda la versión que aceptó.
- Las cuentas creadas antes de la migración quedan con `autoriza_datos_at` vacío.
- Las cuentas ya no se pueden crear desde **Authentication → Add user** del panel de Supabase sin la metadata de autorización: el personal se registra desde la app y luego el admin le cambia el rol.

## Reglas de seguridad

- Todo registro nuevo es **cliente**. El rol nunca se lee del formulario; solo un admin lo cambia.
- Un admin no puede quitarse su propio rol ni desactivarse (trigger `proteger_autoadministracion`).
- Usuario **desactivado**: `rol_actual()` lo trata como visitante → RLS le niega todo, y la app cierra su sesión.
- Desde la app solo se pueden actualizar las columnas `rol`/`activo` de `usuarios` (permisos por columna); el correo se sincroniza desde Auth.

## Pasos para dejarlo funcionando

### 1. Aplicar la migración

```bash
npx supabase db push
```

### 2. Configurar Auth en el dashboard de Supabase

**Authentication → URL Configuration → Redirect URLs**, agregar:

```
goldtrans://**
exp://**
```

(`exp://**` es para probar en Expo Go; en producción basta `goldtrans://**`.)

**Authentication → Emails → Templates → Reset password**: la plantilla debe incluir `{{ .Token }}`
(el código que el usuario escribe en la app). Ejemplo:

```html
<h2>Recupera tu contraseña — GOLDTRANS</h2>
<p>Tu código de verificación es:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Escríbelo en la app para crear una nueva contraseña. Vence en 1 hora.</p>
<p>Si no solicitaste este cambio, ignora este correo.</p>
```

**Authentication → Providers → Email → Password**: mínimo 8 caracteres, "letters and digits" (igual que la validación de la app).

**Confirmar correo**: si está activo, tras registrarse el usuario debe confirmar antes de iniciar sesión (la app lo indica).

### 3. Crear el primer administrador

Regístrate desde la app y luego, en el **SQL Editor** de Supabase:

```sql
update public.usuarios set rol = 'admin' where email = 'tu-correo@ejemplo.com';
```

Desde ahí el admin asigna los demás roles desde la pestaña **Usuarios**.

### 4. Probar RLS

```bash
npx supabase start      # requiere Docker
npm run test:db         # pgTAP: 20 aserciones por rol
```

En CI corre automáticamente en el job **Migraciones · Pruebas RLS (pgTAP)**.

### 5. Regenerar tipos (opcional)

`src/types/database.ts` está escrito a mano según la migración. Para regenerarlo:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```
