# Arquitectura — GOLDTRANS App

## Vista general

```mermaid
flowchart LR
  subgraph Cliente["App móvil (React Native + Expo)"]
    UI["Pantallas<br/>Expo Router<br/>src/app/(grupo)/"]
    HK["Hooks<br/>src/hooks/"]
    LIB["Cliente Supabase<br/>src/lib/supabase.ts"]
    UI --> HK --> LIB
  end

  subgraph Supabase
    AUTH["Auth (JWT)"]
    DB[("PostgreSQL<br/>+ RLS por rol")]
    ST["Storage<br/>buckets privados"]
    EF["Edge Functions<br/>calcular-tarifa<br/>liberar-cupos<br/>alertas-vencimiento"]
    CRON["pg_cron"]
  end

  LIB -- "anon key + JWT" --> AUTH
  LIB --> DB
  LIB --> ST
  LIB --> EF
  EF -- "service role" --> DB
  CRON --> EF

  WEB["Vercel<br/>build web"] -.-> UI
  GH["GitHub Actions<br/>CI"] -.-> WEB
```

## Capas

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| Rutas / pantallas | `src/app/` | Una pantalla por archivo. Grupos por rol: `(auth)`, `(public)`, `(client)`, `(advisor)`, `(admin)`. Cada `_layout.tsx` protege el grupo según el rol de la sesión. |
| Componentes | `src/components/` | UI reutilizable, sin acceso directo a datos. |
| Hooks | `src/hooks/` | Lógica de datos y estado (`use-*.ts`). Único punto que llama a `lib/`. |
| Servicios | `src/lib/` | Cliente Supabase y funciones de acceso a datos. |
| Tipos | `src/types/` | `database.ts` generado desde Supabase + tipos de dominio. |
| Base de datos | `supabase/migrations/` | Esquema versionado (SQL). Una migración por cambio. |
| Lógica de servidor | `supabase/functions/` | Edge Functions (Deno) para cálculos y tareas programadas. |

## Módulos y roles

| Módulo | Visitante | Cliente | Asesor | Admin |
|---|:-:|:-:|:-:|:-:|
| Cotizador instantáneo | ✔ | ✔ | ✔ | ✔ |
| Solicitudes formales | | ✔ (propias) | ✔ (gestiona) | ✔ |
| Goldtours — catálogo | ✔ | ✔ | ✔ | ✔ |
| Goldtours — reservas y abonos | | ✔ (propias) | ✔ (verifica) | ✔ |
| Repositorio documental / licitaciones | | | ✔ | ✔ |
| Usuarios, rutas, tarifas, flota, paquetes | | | | ✔ |

## Seguridad

- La app solo conoce la **anon key**; los permisos reales los imponen las políticas **RLS** según el rol del JWT.
- La **service role key** solo existe en Edge Functions / CI, nunca en el bundle de la app.
- La sesión se persiste en `AsyncStorage` y el token se refresca solo con la app en primer plano.
- Archivos (comprobantes, documentos) en buckets **privados**, accedidos con URLs firmadas.

## Flujo de cotización (Sprint 2)

```mermaid
sequenceDiagram
  participant U as Usuario
  participant A as App
  participant F as Edge Function calcular-tarifa
  participant D as PostgreSQL
  U->>A: ruta, servicio, fecha, pasajeros
  A->>F: invoke()
  F->>D: ruta + tarifa vigente + vehículo sugerido
  F-->>A: valor_total + desglose (< 5 s)
  A-->>U: cotización
```

## Entornos

| Entorno | App | Supabase |
|---|---|---|
| Local | `npx expo start` / `docker compose up app` | `npx supabase start` (Docker) |
| CI | GitHub Actions (lint, tipos, tests, bundle, Docker) | — |
| Producción | EAS Build (Android/iOS) + Vercel (web) | Proyecto Supabase cloud |
