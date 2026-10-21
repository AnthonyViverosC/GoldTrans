# Sprint 5 — Portal de licitaciones, calidad y despliegue

## Qué incluye

| Ítem | Implementación |
|---|---|
| HU-28 Vigencias y alertas 60/30/15 | Sección *Vigencia* en el detalle del documento (vencimiento, expedición, responsable) · tabla `vigencias` · Edge Function `alertas-vencimiento` (cron diario, 7:00) → `generar_alertas_vencimiento()` · tabla `alertas` · aviso en el portal (`components/alertas-vencimiento.tsx`) y correo opcional |
| HU-29 Tablero documental | Indicadores *Vigente / Por vencer / Vencido / Sin vencimiento* arriba del repositorio (`resumenTablero()`). Tocar uno filtra la lista |
| HU-30 Buscador | Texto (nombre o descripción, sin tildes) + categoría + estado (`filtrarDocumentos()`) |
| HU-31 Procesos de licitación | `components/procesos-licitacion.tsx`: número, entidad, objeto, cierre, valor, responsable, enlace a SECOP, estado y notas de seguimiento · tabla `procesos_licitacion` |
| HU-32 Lista de verificación | Requisitos con documento del repositorio o marcados a mano, porcentaje de cumplimiento y obligatorios pendientes · plantilla de 11 requisitos habituales · tabla `items_verificacion` |
| HU-33 Descarga del paquete | Edge Function `descargar-paquete`: ZIP con la versión vigente de cada documento + `00-INDICE.txt` · antes de descargar, la app advierte los vencidos, los que vencen antes del cierre y los faltantes · tabla `bitacora_descargas` |
| RNF-07 Integración y regresión | `scripts/integracion.mjs` (los 3 módulos de punta a punta) · nuevo job `integracion` en CI · pgTAP `licitaciones.test.sql` · Jest `sprint5.test.ts` |
| Despliegue | `vercel.json` (web) · `eas.json` (Android/iOS) · pasos abajo |

**Dónde está en la app.** El asesor tiene la pestaña **Licitaciones** además de **Documentos**. El admin ya tenía 7 pestañas,
así que *Docs* pasó a llamarse **Portal**, con un selector *Documentos | Licitaciones*.

## Reglas

| Regla | Valor | Dónde |
|---|---|---|
| Por vencer | faltan 60 días o menos (desde la primera alerta) | `estado_vigencia()` · `estadoVigencia()` |
| Alertas | 60, 30 y 15 días antes, y el día que vence (o si ya venció) | `generar_alertas_vencimiento()` · `umbralAlerta()` |
| Sin alertas repetidas | una por documento, fecha de vencimiento y umbral (`unique`) | tabla `alertas` |
| Cron atrasado | se crea solo la alerta del umbral más cercano ya alcanzado, no todas las atrasadas | `generar_alertas_vencimiento()` |
| Requisito cumplido | documento vinculado **vigente en la fecha de cierre** (o que no vence), o marca manual si no está en el repositorio | `estadoItem()` |
| Cumplimiento | requisitos que cumplen ÷ total, redondeado hacia abajo | `cumplimiento()` |
| Paquete | máximo 100 MB · un archivo por documento · solo queda el último ZIP de cada proceso · URL firmada de 10 min | `descargar-paquete` |

- Las reglas de vigencia y cumplimiento están en `supabase/functions/_shared/licitaciones.ts`. Ese archivo no tiene imports y lo
  usan la app, Jest, las Edge Functions y el script de integración. En SQL hay una copia (`estado_vigencia`,
  `generar_alertas_vencimiento`) y las pruebas cubren los mismos casos en los dos lados.
- El responsable de una vigencia tiene que ser un asesor o un admin activo (trigger `vigencias_validar_responsable`).
- Las alertas solo se marcan como leídas, no se editan. Cada quien ve las suyas y el admin ve todas.
- Si se borra un documento vinculado, el requisito no desaparece: vuelve a quedar *Pendiente*.
- El asesor crea y edita procesos. Solo el admin los elimina.

## RNF-07 · Pruebas

| Nivel | Qué cubre | Comando | Dónde corre |
|---|---|---|---|
| Unitarias (regresión) | Cálculo de tarifas, validaciones, roles, solicitudes, Goldtours, reservas, abonos, archivos, documentos, vigencias, licitaciones | `npx jest` (150 pruebas) | Local y CI |
| Base de datos | Restricciones, funciones y RLS por rol de los 5 sprints (`supabase/tests/database/*.test.sql`) | `npm run test:db` | CI (job *database*) |
| Integración de punta a punta | Visitante, cliente y asesor reales sobre Auth, API REST, RLS, Storage y las 4 Edge Functions: cotizar (< 5 s) → solicitud → confirmación · catálogo → reserva → comprobante → aprobación · documento → vigencia → proceso → ZIP → alerta | `npm run test:integracion` | CI (job *integracion*, Supabase local) o contra un proyecto |
| Rendimiento | RNF-04 en producción | `npm run test:rendimiento` | Contra producción |

El script de integración crea sus propios usuarios y datos (prefijo `IT <id>`) y los borra al terminar, aunque algo falle.
Contra un proyecto que no sea local exige `INTEGRACION_PRODUCCION=1`.

## Despliegue en producción

### 1. Supabase

```bash
npx supabase link --project-ref <id>
npx supabase db push                                     # migraciones de los sprints 4 y 5
npx supabase secrets set CRON_SECRET=<cadena-larga-aleatoria>
npx supabase functions deploy calcular-tarifa
npx supabase functions deploy liberar-cupos
npx supabase functions deploy alertas-vencimiento
npx supabase functions deploy descargar-paquete
```

Una sola vez, en el SQL Editor, los secretos que usan las dos tareas programadas (`liberar-cupos` cada 15 min y
`alertas-vencimiento` a diario):

```sql
select vault.create_secret('https://<proyecto>.supabase.co', 'project_url');
select vault.create_secret('<el mismo CRON_SECRET>', 'cron_secret');
-- Verificar: select jobname, schedule from cron.job;
--            select * from cron.job_run_details order by start_time desc limit 5;
```

> La migración del Sprint 5 programa `alertas-vencimiento` solo si `pg_cron` y `pg_net` ya existen (los crea la
> migración del Sprint 4). Si `select jobname from cron.job` no la muestra, ejecuta el bloque `do $$ … $$` del final de
> `20261028000000_licitaciones.sql` en el SQL Editor.

**Correo de alertas (opcional):** con una cuenta de [Resend](https://resend.com) y un dominio verificado:

```bash
npx supabase secrets set RESEND_API_KEY=re_... ALERTAS_REMITENTE="GOLDTRANS <alertas@tu-dominio.co>"
```

Sin estos secretos las alertas se ven igual en el portal.

**Auth:** en *Authentication → URL Configuration* agrega la URL de Vercel a *Site URL* / *Redirect URLs*.

### 2. Web en Vercel

1. *Add New Project* → importar el repositorio de GitHub. `vercel.json` ya define build, salida y rutas dinámicas.
2. *Environment Variables*: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_DATOS_TRANSFERENCIA`.
   **Nunca** `SUPABASE_SERVICE_ROLE_KEY`.
3. *Production Branch*: `main`. Cada merge a `main` publica; cada PR recibe una URL de vista previa.

### 3. Android e iOS con EAS

```bash
npm install -g eas-cli
eas login
eas init                                  # crea el proyecto en Expo y agrega extra.eas.projectId a app.json
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<proyecto>.supabase.co
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key>
eas env:create --environment production --name EXPO_PUBLIC_DATOS_TRANSFERENCIA --value "<cuenta>"
#   (repite con --environment preview)
eas build --platform android --profile preview      # APK para instalar en teléfonos reales
eas build --platform all --profile production       # AAB para Play Store / build para App Store
```

En el primer build, EAS pide el identificador de la app (`android.package` / `ios.bundleIdentifier`, p. ej.
`co.goldtrans.app`). Después ya no se puede cambiar sin publicar una app nueva, así que el equipo debe decidirlo.

### 4. Verificación en producción

```bash
npm run test:rendimiento                                   # RNF-04 · p95 < 5 s
INTEGRACION_PRODUCCION=1 CRON_SECRET=... npm run test:integracion
```

## Checklist de salida — verificación manual

- [ ] Documento con vencimiento a 10 días → al día siguiente a las 7:00 llega la alerta de 15 días al responsable
- [ ] El tablero cuenta bien Vigente / Por vencer / Vencido y tocar un indicador filtra la lista
- [ ] Proceso con la plantilla de requisitos → vincular documentos → el porcentaje sube; un requisito marcado a mano cuenta
- [ ] Con un documento vencido, *Descargar paquete* muestra la advertencia y, al confirmar, baja el ZIP con `00-INDICE.txt`
- [ ] La web de Vercel abre `/goldtours` y `/paquete/<id>` directamente (sin pasar por el inicio)
- [ ] APK de EAS instalada en un Android real e inicio de sesión de los cuatro roles
