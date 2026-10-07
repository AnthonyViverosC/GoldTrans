# GOLDTRANS S.A.S. — App móvil

App de transporte terrestre especial (La Hormiga, Putumayo): cotizador instantáneo, Goldtours y portal de licitaciones.

**Stack:** React Native + Expo (SDK 57, Expo Router, TypeScript estricto) · Supabase · GitHub Actions · Docker · Vercel

## Puesta en marcha

```bash
npm install
cp .env.example .env      # completar URL y anon key de Supabase
npx expo start
```

La pantalla inicial muestra si la conexión con Supabase está activa.

### Supabase local (opcional, requiere Docker)

```bash
npx supabase start        # levanta Postgres, Auth y Storage locales
npx supabase db reset     # aplica supabase/migrations/
```

### Supabase cloud

```bash
npx supabase login
npx supabase link --project-ref <id-proyecto>
npx supabase db push
```

### Docker

```bash
docker compose up app                 # servidor Metro en :8081
docker compose --profile web up web   # build web estático en :8080
```

## Scripts

| Comando | Descripción |
|---|---|
| `npm start` | Servidor de desarrollo |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Jest |

## Documentación

- [Arquitectura](docs/arquitectura.md)
- [Guía de contribución](CONTRIBUTING.md)
- [Plan de sprints](CLAUDE.md)
