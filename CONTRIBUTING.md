# Guía de contribución

## Ramas

| Rama | Uso |
|---|---|
| `main` | Producción. Solo recibe merges desde `develop` al cerrar un sprint. |
| `develop` | Integración del sprint en curso. |
| `feature/HU-XX-nombre-corto` | Una rama por historia, creada desde `develop`. Ej: `feature/HU-01-registro-usuario` |

Tareas técnicas sin HU: `feature/SCRUM-XX-nombre-corto` o `chore/...`.

```bash
git checkout develop && git pull
git checkout -b feature/HU-01-registro-usuario
```

## Commits — Conventional Commits

```
feat(HU-01): formulario de registro para persona o empresa
fix(HU-02): mantener sesión al reabrir la app
chore: actualizar dependencias de Expo
docs: diagrama de arquitectura
test(HU-02): pruebas del hook de sesión
```

## Pull requests

1. PR de `feature/*` → `develop` usando la plantilla.
2. CI en verde (lint, typecheck, tests, bundle).
3. Al menos **una aprobación** de un compañero antes del merge.

## Reglas de protección (configurar en GitHub → Settings → Branches)

Para `main` y `develop`:
- Require a pull request before merging (1 aprobación)
- Require status checks to pass: `Lint · Typecheck · Tests · Bundle`, `Docker build`
- Bloquear force push y borrado

## Antes de abrir el PR

```bash
npm run lint
npm run typecheck
npm test
```
