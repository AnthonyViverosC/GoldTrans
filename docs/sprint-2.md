# Sprint 2 — Cotizador instantáneo

## Qué incluye

| Ítem | Implementación |
|---|---|
| HU-09 Rutas | `src/app/(admin)/rutas.tsx` · `src/lib/rutas.ts` · tabla `rutas` (origen → destino, km, duración, peajes por trayecto, activa/inactiva) |
| HU-10 Tarifas con vigencia | `src/app/(admin)/tarifas.tsx` · `src/lib/tarifas.ts` · tabla `tarifas` con restricción de exclusión `tarifas_sin_superposicion` |
| HU-11 Ruta, servicio y fecha | `src/app/(public)/cotizador.tsx`: origen → destino, *solo ida* / *ida y vuelta* / *por días*, fechas |
| HU-12 Sugerencia de vehículo | `elegirVehiculo()`: el vehículo **disponible** más pequeño que lleve a todos los pasajeros y cuyo tipo tenga tarifa vigente |
| HU-13 Cálculo al instante | Edge Function `supabase/functions/calcular-tarifa/` |
| HU-14 Desglose | `src/components/desglose-cotizacion.tsx` · tabla `detalle_cotizacion` · historial en `(client)/mis-cotizaciones.tsx` |
| RNF-04 < 5 s | `npm run test:rendimiento` (`scripts/rendimiento-cotizador.mjs`) + `duracion_ms` guardado en cada cotización |

## Fórmula

> **Reemplazada** por las tarifas por jornada de las cotizaciones oficiales (migración
> `20261029000000_tarifas_jornada.sql`). Ver [tarifas.md](tarifas.md). Lo que sigue describe el modelo
> original del Sprint 2.

```
valor_total = tarifa_base + (distancia × valor_km) + (dias × valor_dia) + peajes + recargo
```

| Concepto | Regla |
|---|---|
| Distancia | km de la ruta × trayectos (1 en *solo ida*; 2 en *ida y vuelta* y *por días*) |
| Días | días de servicio contando el primero y el último (*solo ida* = 1) · máximo 30 |
| Peajes | peajes de la ruta × trayectos (al costo, sin recargo) |
| Recargo fin de semana | `(base + km + días) × % ÷ días` por cada día que cae en sábado o domingo |
| Tarifa aplicada | la vigente en la **fecha de inicio** para el tipo de vehículo sugerido |

La lógica vive en `supabase/functions/_shared/calculo.ts`. Ese archivo no tiene imports,
así lo usan tanto la Edge Function (Deno) como la app y Jest. Hay un solo lugar donde cambiar la fórmula.

## Decisiones

- **Las cotizaciones las crea solo la Edge Function** (service role) mediante `guardar_cotizacion()`,
  que inserta la cotización y su desglose en una sola transacción y verifica que el total cuadre.
  Ningún rol puede insertar cotizaciones desde la app (RLS + permisos).
- Se guardan también las cotizaciones de **visitantes** (`usuario_id` null) para tener métricas de demanda.
- La cotización guarda una **copia de origen y destino**: el historial no cambia si la ruta se edita o se desactiva.
- Las rutas con cotizaciones **no se borran** (FK): se marcan como inactivas. Las tarifas usadas se cierran
  con una fecha *hasta*.
- `verify_jwt = false` para `calcular-tarifa`: la app usa una *publishable key* (`sb_publishable_…`), que no
  es un JWT. La función identifica al usuario con `auth.getUser()` cuando la petición trae su sesión.
- **Región fija (RNF-04):** la base de datos está en `us-west-2`, pero sin indicación la función se
  ejecuta en el borde más cercano al usuario (`us-east-1` desde Colombia) y cada consulta cruza el
  continente. La app invoca con `region: FunctionRegion.UsWest2` (`REGION_FUNCIONES` en
  `src/lib/cotizador.ts`). Si el proyecto cambia de región, hay que actualizar esa constante.
- Recargo solo por sábado y domingo. Los festivos colombianos quedan pendientes (necesitan una tabla de festivos).

## Pasos para dejarlo funcionando

### 1. Aplicar la migración y desplegar la función

```bash
npx supabase db push
npx supabase functions deploy calcular-tarifa
```

`supabase/config.toml` ya tiene `verify_jwt = false` para la función, así que el deploy lo toma solo.

### 2. Cargar datos (como admin, desde la app)

1. **Flota**: al menos un vehículo en estado *Disponible*.
2. **Tarifas**: una tarifa vigente por cada tipo de vehículo de la flota.
3. **Rutas**: las rutas que se ofrecen (km y peajes de **un** trayecto).

Sin esas tres cosas el cotizador responde "No hay un vehículo disponible con tarifa vigente…".

### 3. Pruebas

```bash
npx jest                    # cálculo, validaciones, rutas, tarifas
npm run test:db             # pgTAP: supabase/tests/database/cotizador.test.sql (requiere Docker)
npm run test:rendimiento    # RNF-04 contra el proyecto de .env (crea cotizaciones de visitante)
```

## Resultado de RNF-04 (14-oct-2026, proyecto en producción)

| Medida | Sin región fija | Con región `us-west-2` |
|---|---|---|
| Cálculo dentro de la función | ≈ 550 ms | ≈ 220 ms |
| Peticiones secuenciales (p95) | 5.647 ms (n=15, un pico) | **636 ms** (n=40) |
| Peticiones simultáneas (máx.) | 1.299 ms (5) | **1.335 ms** (10) |
| Primera petición (arranque en frío) | 971 ms | 1.193 ms |

La prueba usó datos temporales que se borraron al terminar.
