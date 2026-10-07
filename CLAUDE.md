# GOLDTRANS S.A.S. — App Móvil

Aplicación móvil para GOLDTRANS S.A.S., empresa de transporte terrestre especial con sede en La Hormiga, Putumayo. Tres módulos: cotizador instantáneo, Goldtours (paquetes turísticos) y portal de licitaciones/documentos.

**Equipo:** Camilo Gordillo · Andrés Muñoz · Víctor Velásquez · Anthony Viveros  
**Stack:** React Native + Expo · Supabase (PostgreSQL + Auth + Storage + Edge Functions) · GitHub · Docker · Vercel  
**Metodología:** Scrum — 6 sprints de 2 semanas — Scrum Master rotativo

---

## Regla de avance entre sprints

> **No pasar al siguiente sprint sin autorización explícita.**  
> Al terminar cada sprint, Claude presenta el checklist de entregables y espera confirmación antes de continuar.  
> Comando para autorizar: escribe **"aprobar sprint X"** o **"avanzar a sprint X+1"**.

---

## Sprint 0 — Preparación del proyecto
**Semanas 1–2 · 26 puntos · Scrum Master: Camilo Gordillo**

**Objetivo:** Infraestructura lista para que el equipo pueda desarrollar desde el día 1.

### Tareas
- [ ] SCRUM-11 · Configurar repositorio GitHub con ramas `main`, `develop` y convención `feature/HU-XX-nombre` (5 pts)
- [ ] SCRUM-12 · Configurar proyecto Jira: épicas, sprints y backlog importado (5 pts)
- [ ] SCRUM-13 · Inicializar proyecto React Native con Expo + Expo Router + TypeScript (5 pts)
- [ ] SCRUM-14 · Crear proyecto Supabase: base de datos, Auth y Storage configurados (5 pts)
- [ ] SCRUM-15 · Definir arquitectura y diagrama de componentes (3 pts)
- [ ] SCRUM-16 · Configurar Docker y pipeline CI/CD básico (3 pts)

### Variables de entorno requeridas
```env
EXPO_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### Checklist de salida — Sprint 0
Antes de avanzar al Sprint 1, confirmar que:
- [ ] Repositorio en GitHub con estructura de ramas definida
- [ ] Tablero Jira activo con los 53 ítems cargados
- [ ] `npx expo start` corre sin errores en Android e iOS
- [ ] Conexión a Supabase verificada desde la app
- [ ] Pipeline CI pasa en verde

> ⏸️ **PAUSA — escribe "aprobar sprint 0" para continuar al Sprint 1**

---

## Sprint 1 — Base y gestión de usuarios
**Semanas 3–4 · 50 puntos · Scrum Master: Andrés Muñoz**

**Objetivo:** Registro, autenticación, cuatro roles con RLS y administración básica de usuarios y vehículos.

### Historias de usuario
- [ ] SCRUM-17 · **HU-01** Registrar usuario — persona o empresa con NIT (5 pts · Highest)
- [ ] SCRUM-18 · **HU-02** Iniciar sesión con correo y contraseña (5 pts · Highest)
- [ ] SCRUM-19 · **HU-03** Cuatro roles con permisos diferenciados (8 pts · Highest)
- [ ] SCRUM-20 · **HU-04** Consultar y editar perfil (3 pts · Medium)
- [ ] SCRUM-21 · **HU-05** Cotizar sin registro previo (3 pts · High)
- [ ] SCRUM-22 · **HU-06** Administrar flota de vehículos (5 pts · High)
- [ ] SCRUM-23 · **HU-07** Recuperar contraseña por correo (3 pts · High)
- [ ] SCRUM-24 · **HU-08** Gestionar usuarios: activar, desactivar, cambiar rol (5 pts · Medium)

### Tareas técnicas
- [ ] SCRUM-25 · **RNF-01** Autenticación JWT con Supabase Auth (5 pts · Highest)
- [ ] SCRUM-26 · **RNF-02** Políticas Row Level Security por rol (5 pts · Highest)
- [ ] SCRUM-27 · **RNF-03** Pruebas unitarias del módulo de autenticación (3 pts · Medium)

### Tablas de base de datos
```sql
-- Crear antes de iniciar el sprint
usuarios, roles, perfiles, vehiculos
```

### Checklist de salida — Sprint 1
- [ ] Un usuario puede registrarse como persona o empresa
- [ ] Login y logout funcionan con sesión persistente
- [ ] Los 4 roles ven pantallas distintas (no hay acceso cruzado)
- [ ] El administrador puede activar, desactivar y cambiar roles
- [ ] RLS implementado y probado en Supabase
- [ ] Pruebas unitarias en verde

> ⏸️ **PAUSA — escribe "aprobar sprint 1" para continuar al Sprint 2**

---

## Sprint 2 — Cotizador instantáneo
**Semanas 5–6 · 45 puntos · Scrum Master: Víctor Velásquez**

**Objetivo:** Motor de cotización completo: rutas, tarifas, sugerencia de vehículo y cálculo automático en menos de 5 segundos.

### Historias de usuario
- [ ] SCRUM-28 · **HU-09** Administrar tabla de rutas (8 pts · Highest)
- [ ] SCRUM-29 · **HU-10** Administrar tarifas por tipo de vehículo y vigencia (8 pts · Highest)
- [ ] SCRUM-30 · **HU-11** Seleccionar ruta, tipo de servicio y fecha (5 pts · High)
- [ ] SCRUM-31 · **HU-12** Indicar pasajeros — sugerencia automática de vehículo (5 pts · High)
- [ ] SCRUM-32 · **HU-13** Calcular valor del servicio al instante (8 pts · Highest)
- [ ] SCRUM-33 · **HU-14** Ver desglose de la cotización (3 pts · Medium)

### Tareas técnicas
- [ ] SCRUM-34 · **RNF-04** Tiempo de respuesta del cotizador < 5 segundos (8 pts · High)

### Edge Function a implementar
```
supabase/functions/calcular-tarifa/
  Fórmula: valor_total = tarifa_base + (distancia × valor_km) + (dias × valor_dia) + recargos
```

### Tablas de base de datos
```sql
rutas, tarifas, cotizaciones, detalle_cotizacion
```

### Checklist de salida — Sprint 2
- [ ] Un visitante puede cotizar sin iniciar sesión
- [ ] El cotizador sugiere el vehículo según número de pasajeros
- [ ] El cálculo responde en menos de 5 segundos
- [ ] El desglose muestra tarifa base, km, días, peajes y recargos
- [ ] No se pueden crear tarifas con vigencias superpuestas
- [ ] RNF-04 verificado con prueba de rendimiento

> ⏸️ **PAUSA — escribe "aprobar sprint 2" para continuar al Sprint 3**

---

## Sprint 3 — Cotización formal y catálogo Goldtours
**Semanas 7–8 · 46 puntos · Scrum Master: Anthony Viveros**

**Objetivo:** Formalizar solicitudes de servicio e implementar el catálogo de paquetes turísticos con fechas y cupos.

### Historias de usuario
- [ ] SCRUM-35 · **HU-15** Enviar y descargar cotización (por WhatsApp o correo) (5 pts · High)
- [ ] SCRUM-36 · **HU-16** Convertir cotización en solicitud formal (5 pts · Highest)
- [ ] SCRUM-37 · **HU-17** Gestionar solicitudes como asesor comercial (8 pts · Highest)
- [ ] SCRUM-38 · **HU-18** Catálogo de paquetes turísticos con filtros (5 pts · High)
- [ ] SCRUM-39 · **HU-19** Ver ficha detallada del paquete (5 pts · High)
- [ ] SCRUM-40 · **HU-20** Administrar fechas de salida con cupos (8 pts · Highest)
- [ ] SCRUM-41 · **HU-21** Crear y actualizar paquetes turísticos (5 pts · High)

### Tareas técnicas
- [ ] SCRUM-42 · **RNF-05** Compatibilidad verificada en Android e iOS (5 pts · High)

### Tablas de base de datos
```sql
solicitudes, paquetes, imagenes_paquete, fechas_salida, itinerario_paquete
```

### Checklist de salida — Sprint 3
- [ ] El cliente puede enviar la cotización por WhatsApp y correo
- [ ] La solicitud aparece en la bandeja del asesor con estado Pendiente
- [ ] El asesor puede confirmar, ajustar o rechazar (con motivo)
- [ ] El catálogo muestra solo paquetes activos con foto y precio
- [ ] Las fechas agotadas no permiten nuevas reservas
- [ ] App verificada en dispositivo Android real y simulador iOS

> ⏸️ **PAUSA — escribe "aprobar sprint 3" para continuar al Sprint 4**

---

## Sprint 4 — Reservas, abonos y repositorio documental
**Semanas 9–10 · 50 puntos · Scrum Master: Camilo Gordillo**

**Objetivo:** Flujo completo de reservas con abono por transferencia, verificación de comprobante y repositorio de documentos.

### Historias de usuario
- [ ] SCRUM-43 · **HU-22** Crear reserva con datos de viajeros (8 pts · Highest)
- [ ] SCRUM-44 · **HU-23** Registrar abono adjuntando comprobante de transferencia (8 pts · Highest)
- [ ] SCRUM-45 · **HU-24** Verificar abono como asesor (aprobar o rechazar) (8 pts · Highest)
- [ ] SCRUM-46 · **HU-25** Controlar saldo pendiente y fecha límite de pago (5 pts · High)
- [ ] SCRUM-47 · **HU-26** Seguir estados y liberar cupos vencidos (5 pts · High)
- [ ] SCRUM-48 · **HU-27** Cargar y categorizar documentos de la empresa (8 pts · High)

### Tareas técnicas
- [ ] SCRUM-49 · **RNF-06** Almacenamiento seguro de archivos en Supabase Storage (8 pts · High)

### Edge Function a implementar
```
supabase/functions/liberar-cupos/
  Cancela prerreservas vencidas y suma el cupo de vuelta a fecha_salida
```

### Tablas de base de datos
```sql
reservas, viajeros, abonos, documentos, categorias_doc, versiones_doc
```

### Notas importantes
- El pago es por **transferencia bancaria**, no pasarela. El comprobante es imagen o PDF subido a Storage.
- Bucket privado por empresa en Supabase Storage.
- El asesor ve el comprobante antes de aprobar.

### Checklist de salida — Sprint 4
- [ ] El cliente puede reservar y ve su código de reserva
- [ ] Puede adjuntar comprobante de transferencia (imagen o PDF)
- [ ] El asesor aprueba o rechaza con motivo registrado
- [ ] Los cupos se liberan automáticamente al vencer la prerreserva
- [ ] Los documentos se suben por categoría y mantienen historial de versiones
- [ ] Solo usuarios con rol Asesor o Admin acceden al repositorio

> ⏸️ **PAUSA — escribe "aprobar sprint 4" para continuar al Sprint 5**

---

## Sprint 5 — Portal de licitaciones, calidad y despliegue
**Semanas 11–12 · 50 puntos · Scrum Master: Andrés Muñoz**

**Objetivo:** Completar el portal de licitaciones con alertas, tablero documental, pruebas finales y despliegue en producción.

### Historias de usuario
- [ ] SCRUM-50 · **HU-28** Registrar vigencias y alertas automáticas (60/30/15 días) (8 pts · Highest)
- [ ] SCRUM-51 · **HU-29** Tablero de estado documental: Vigente / Por vencer / Vencido (5 pts · High)
- [ ] SCRUM-52 · **HU-30** Buscador de documentos por nombre, categoría y estado (3 pts · Medium)
- [ ] SCRUM-53 · **HU-31** Registrar y hacer seguimiento de procesos de licitación (5 pts · High)
- [ ] SCRUM-54 · **HU-32** Lista de verificación de documentos por proceso (8 pts · High)
- [ ] SCRUM-55 · **HU-33** Descargar paquete de documentos de un proceso (8 pts · High)

### Tareas técnicas
- [ ] SCRUM-56 · **RNF-07** Pruebas de integración y regresión completas (5 pts · Highest)
- [ ] SCRUM-57 · Despliegue en producción: Vercel + Supabase (8 pts · High)

### Edge Function a implementar
```
supabase/functions/alertas-vencimiento/
  Cron diario: revisa vigencias y crea notificaciones a 60, 30 y 15 días antes del vencimiento
```

### Tablas de base de datos
```sql
vigencias, alertas, procesos_licitacion, items_verificacion, bitacora_descargas
```

### Checklist de salida — Sprint 5 (entrega final)
- [ ] Las alertas de vencimiento llegan al responsable en los plazos correctos
- [ ] El tablero documental clasifica correctamente Vigente / Por vencer / Vencido
- [ ] La lista de verificación muestra porcentaje de cumplimiento
- [ ] La descarga alerta si hay documentos vencidos en el paquete
- [ ] Pruebas de integración en verde para los 3 módulos
- [ ] App desplegada y accesible desde dispositivos reales
- [ ] Cotizador responde en < 5 segundos en producción

> ✅ **Sprint 5 completado = proyecto entregado**

---

## Estructura de archivos

```
goldtrans-app/
├── CLAUDE.md                   ← este archivo
├── app/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── registro.tsx
│   │   └── recuperar.tsx
│   ├── (public)/
│   │   └── cotizador.tsx
│   ├── (client)/
│   │   ├── perfil.tsx
│   │   ├── mis-cotizaciones.tsx
│   │   ├── goldtours/
│   │   └── reservas/
│   ├── (advisor)/
│   │   ├── solicitudes.tsx
│   │   ├── abonos.tsx
│   │   └── documentos/
│   └── (admin)/
│       ├── usuarios.tsx
│       ├── rutas.tsx
│       ├── tarifas.tsx
│       ├── flota.tsx
│       └── paquetes/
├── components/
├── lib/
│   └── supabase.ts
├── hooks/
├── types/
└── supabase/
    ├── migrations/
    └── functions/
        ├── calcular-tarifa/
        ├── alertas-vencimiento/
        └── liberar-cupos/
```

## Convenciones

- **Ramas:** `feature/HU-XX-nombre-corto` — una rama por historia
- **Commits:** `feat(HU-XX): descripción` (Conventional Commits)
- **PR:** revisión de al menos un compañero antes de merge a `develop`
- **TypeScript:** modo estricto activado
- **Componentes:** funcionales + hooks, PascalCase
- **Archivos:** kebab-case

## Comandos frecuentes

```bash
npx expo start                          # Desarrollo
npx expo run:android                    # Android
npx expo run:ios                        # iOS
supabase db push                        # Aplicar migraciones
supabase functions deploy <nombre>      # Desplegar Edge Function
npx jest                                # Tests
eas build --platform all                # Build producción
```
