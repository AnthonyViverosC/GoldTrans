# Modelo entidad-relación — GOLDTRANS App

Modelo de la base de datos en Supabase (esquema `public`), construido a partir de las migraciones de
`supabase/migrations/`. Todas las tablas tienen RLS activado; los permisos por rol están en
[arquitectura.md](arquitectura.md) y en cada migración.

Convenciones: **PK** clave primaria · **FK** clave foránea · **UK** valor único. Los valores en pesos
colombianos son `integer`. Las fechas y horas de auditoría (`created_at`, `updated_at`) se omiten en
los diagramas para que sean legibles.

## Diagrama

![Modelo entidad-relación GOLDTRANS](img/modelo-entidad-relacion.svg)

> Imagen: [`img/modelo-entidad-relacion.svg`](img/modelo-entidad-relacion.svg) (vectorial, se abre en
> cualquier navegador) · [`img/modelo-entidad-relacion.png`](img/modelo-entidad-relacion.png) (alta
> resolución, para Word, PowerPoint o Canva).

## Vista general (Mermaid)

```mermaid
erDiagram
  AUTH_USERS ||--|| USUARIOS : "es"
  ROLES ||--o{ USUARIOS : "asigna"
  USUARIOS ||--|| PERFILES : "tiene"

  RUTAS |o--o{ TARIFAS : "precio especial"
  RUTAS ||--o{ COTIZACIONES : "cotizada en"
  TARIFAS ||--o{ COTIZACIONES : "aplicada en"
  USUARIOS |o--o{ COTIZACIONES : "solicita"
  COTIZACIONES ||--|{ DETALLE_COTIZACION : "desglosa"
  COTIZACIONES ||--o| SOLICITUDES : "se formaliza"
  USUARIOS ||--o{ SOLICITUDES : "cliente"
  USUARIOS |o--o{ SOLICITUDES : "asesor"

  PAQUETES ||--o{ IMAGENES_PAQUETE : "tiene"
  PAQUETES ||--o{ ITINERARIO_PAQUETE : "tiene"
  PAQUETES ||--o{ FECHAS_SALIDA : "programa"
  FECHAS_SALIDA ||--o{ RESERVAS : "reservada en"
  USUARIOS ||--o{ RESERVAS : "reserva"
  RESERVAS ||--|{ VIAJEROS : "incluye"
  RESERVAS ||--o{ ABONOS : "recibe"
  USUARIOS |o--o{ ABONOS : "verifica"

  CATEGORIAS_DOC ||--o{ DOCUMENTOS : "clasifica"
  DOCUMENTOS ||--|{ VERSIONES_DOC : "versiona"
  DOCUMENTOS ||--o| VIGENCIAS : "vence"
  USUARIOS ||--o{ VIGENCIAS : "responsable"
  DOCUMENTOS ||--o{ ALERTAS : "genera"
  USUARIOS ||--o{ ALERTAS : "recibe"
  PROCESOS_LICITACION ||--o{ ITEMS_VERIFICACION : "exige"
  DOCUMENTOS |o--o{ ITEMS_VERIFICACION : "cumple"
  PROCESOS_LICITACION ||--o{ BITACORA_DESCARGAS : "registra"
  USUARIOS |o--o{ BITACORA_DESCARGAS : "descarga"
  USUARIOS |o--o{ PROCESOS_LICITACION : "responsable"

  VEHICULOS {
    uuid id PK
  }
```

`VEHICULOS` no tiene claves foráneas: se relaciona con `tarifas` y `cotizaciones` por el valor de
`tipo` / `tipo_vehiculo` (automovil, campero, camioneta, van, microbus, buseta, bus).

---

## 1. Usuarios y flota (Sprint 1)

```mermaid
erDiagram
  AUTH_USERS ||--|| USUARIOS : "es"
  ROLES ||--o{ USUARIOS : "asigna"
  USUARIOS ||--|| PERFILES : "tiene"

  AUTH_USERS {
    uuid id PK
    text email
  }
  ROLES {
    text codigo PK "visitante | cliente | asesor | admin"
    text nombre
    text descripcion
  }
  USUARIOS {
    uuid id PK "FK auth.users"
    text email
    text rol FK "roles.codigo"
    boolean activo
  }
  PERFILES {
    uuid usuario_id PK "FK usuarios"
    text tipo_persona "persona | empresa"
    text nombre_completo
    text tipo_documento "CC | CE | PA | TI"
    text numero_documento
    text razon_social
    text nit UK "solo empresa"
    text telefono
    text ciudad
  }
  VEHICULOS {
    uuid id PK
    text placa UK "AAA000"
    text tipo
    text marca
    text modelo
    integer anio
    integer capacidad_pasajeros
    text estado "disponible | mantenimiento | inactivo"
    date soat_vence
    date tecnomecanica_vence
  }
```

## 2. Cotizador y solicitudes (Sprints 2–3)

```mermaid
erDiagram
  RUTAS |o--o{ TARIFAS : "precio especial"
  RUTAS ||--o{ COTIZACIONES : "cotizada en"
  TARIFAS ||--o{ COTIZACIONES : "aplicada en"
  USUARIOS |o--o{ COTIZACIONES : "solicita"
  COTIZACIONES ||--|{ DETALLE_COTIZACION : "desglosa"
  COTIZACIONES ||--o| SOLICITUDES : "se formaliza"
  USUARIOS ||--o{ SOLICITUDES : "cliente"
  USUARIOS |o--o{ SOLICITUDES : "asesor"

  RUTAS {
    uuid id PK
    text origen "UK con destino"
    text destino
    numeric distancia_km
    numeric duracion_horas
    integer peajes
    boolean activo
  }
  TARIFAS {
    uuid id PK
    text tipo_vehiculo
    uuid ruta_id FK "null = tarifa general"
    smallint jornada_horas "4 | 8 | 12"
    integer valor_jornada
    integer km_incluidos_dia
    integer valor_km_adicional
    integer recargo_fin_semana_pct
    date vigencia_desde "sin superposición"
    date vigencia_hasta
  }
  COTIZACIONES {
    uuid id PK
    text codigo UK
    uuid usuario_id FK "null = visitante"
    uuid ruta_id FK
    uuid tarifa_id FK
    text origen
    text destino
    text tipo_servicio "ida | ida_vuelta | disponibilidad"
    date fecha_inicio
    date fecha_fin
    integer dias
    integer pasajeros
    text tipo_vehiculo
    integer capacidad_vehiculo
    numeric distancia_km
    smallint jornada_horas
    integer km_incluidos_dia
    integer valor_km_adicional
    integer valor_total
    integer duracion_ms "RNF-04"
  }
  DETALLE_COTIZACION {
    uuid id PK
    uuid cotizacion_id FK "UK con orden"
    smallint orden
    text concepto "jornada | km_adicional | peajes | recargo"
    text descripcion
    numeric cantidad
    integer valor_unitario
    integer subtotal
  }
  SOLICITUDES {
    uuid id PK
    text codigo UK
    uuid cotizacion_id FK "UK"
    uuid usuario_id FK
    text estado "pendiente | confirmada | ajustada | rechazada | cancelada"
    text nombre_contacto
    text telefono_contacto
    text direccion_recogida
    time hora_recogida
    text observaciones
    integer valor_cotizado
    integer valor_final
    text motivo
    uuid asesor_id FK
    timestamptz respondida_at
  }
  USUARIOS {
    uuid id PK
  }
```

## 3. Goldtours y reservas (Sprints 3–4)

```mermaid
erDiagram
  PAQUETES ||--o{ IMAGENES_PAQUETE : "tiene"
  PAQUETES ||--o{ ITINERARIO_PAQUETE : "tiene"
  PAQUETES ||--o{ FECHAS_SALIDA : "programa"
  FECHAS_SALIDA ||--o{ RESERVAS : "reservada en"
  USUARIOS ||--o{ RESERVAS : "reserva"
  USUARIOS |o--o{ RESERVAS : "cancela"
  RESERVAS ||--|{ VIAJEROS : "incluye"
  RESERVAS ||--o{ ABONOS : "recibe"
  USUARIOS |o--o{ ABONOS : "verifica"

  PAQUETES {
    uuid id PK
    text nombre
    text destino
    text descripcion
    integer duracion_dias
    integer duracion_noches
    integer precio_por_persona
    text_array incluye
    text_array no_incluye
    boolean activo
  }
  IMAGENES_PAQUETE {
    uuid id PK
    uuid paquete_id FK
    text ruta UK "Storage"
    integer orden
  }
  ITINERARIO_PAQUETE {
    uuid id PK
    uuid paquete_id FK "UK con dia"
    integer dia
    text titulo
    text descripcion
  }
  FECHAS_SALIDA {
    uuid id PK
    uuid paquete_id FK "UK con fecha_salida"
    date fecha_salida
    date fecha_regreso
    integer cupos_totales
    integer cupos_reservados
    integer cupos_disponibles "calculada"
    text estado "abierta | cerrada"
  }
  RESERVAS {
    uuid id PK
    text codigo UK
    uuid usuario_id FK
    uuid fecha_salida_id FK
    text paquete_nombre
    text destino
    date fecha_salida
    date fecha_regreso
    integer cupos
    integer precio_por_persona
    integer valor_total
    integer abono_minimo
    integer valor_abonado
    integer saldo "calculada"
    text estado "prerreserva | confirmada | pagada | vencida | cancelada"
    timestamptz vence_at
    date fecha_limite_pago
    text telefono_contacto
    text observaciones
    text motivo_cancelacion
    uuid cancelada_por FK
  }
  VIAJEROS {
    uuid id PK
    uuid reserva_id FK
    integer orden
    text nombre_completo
    text tipo_documento "CC | CE | PA | TI | RC"
    text numero_documento "UK por reserva"
    date fecha_nacimiento
  }
  ABONOS {
    uuid id PK
    uuid reserva_id FK
    integer valor
    date fecha_transferencia
    text referencia
    text comprobante_ruta UK "bucket comprobantes"
    text comprobante_tipo "jpeg | png | webp | pdf"
    text estado "pendiente | aprobado | rechazado"
    text motivo
    uuid asesor_id FK
    timestamptz revisado_at
  }
  USUARIOS {
    uuid id PK
  }
```

## 4. Repositorio documental y licitaciones (Sprints 4–5)

```mermaid
erDiagram
  CATEGORIAS_DOC ||--o{ DOCUMENTOS : "clasifica"
  DOCUMENTOS ||--|{ VERSIONES_DOC : "versiona"
  DOCUMENTOS ||--o| VIGENCIAS : "vence"
  DOCUMENTOS ||--o{ ALERTAS : "genera"
  USUARIOS ||--o{ VIGENCIAS : "responsable"
  USUARIOS ||--o{ ALERTAS : "recibe"
  USUARIOS |o--o{ DOCUMENTOS : "crea"
  USUARIOS |o--o{ VERSIONES_DOC : "sube"
  PROCESOS_LICITACION ||--o{ ITEMS_VERIFICACION : "exige"
  DOCUMENTOS |o--o{ ITEMS_VERIFICACION : "cumple"
  PROCESOS_LICITACION ||--o{ BITACORA_DESCARGAS : "registra"
  USUARIOS |o--o{ BITACORA_DESCARGAS : "descarga"
  USUARIOS |o--o{ PROCESOS_LICITACION : "responsable"

  CATEGORIAS_DOC {
    uuid id PK
    text nombre UK
    text descripcion
    integer orden
  }
  DOCUMENTOS {
    uuid id PK
    uuid categoria_id FK "UK con nombre"
    text nombre
    text descripcion
    integer version_actual
    uuid creado_por FK
  }
  VERSIONES_DOC {
    uuid id PK
    uuid documento_id FK "UK con version"
    integer version
    text ruta UK "bucket documentos"
    text nombre_archivo
    text tipo_mime
    bigint tamano_bytes
    text notas
    uuid subido_por FK
  }
  VIGENCIAS {
    uuid documento_id PK "FK documentos"
    date fecha_expedicion
    date fecha_vencimiento
    uuid responsable_id FK "asesor o admin"
    text notas
    uuid actualizado_por FK
  }
  ALERTAS {
    uuid id PK
    uuid documento_id FK
    uuid responsable_id FK
    integer umbral "60 | 30 | 15 | 0"
    date fecha_vencimiento
    integer dias_restantes
    text mensaje
    timestamptz correo_enviado_at
    timestamptz leida_at
  }
  PROCESOS_LICITACION {
    uuid id PK
    text numero "UK con entidad"
    text entidad
    text objeto
    date fecha_cierre
    bigint valor_estimado
    text estado "preparacion | presentada | adjudicada | no_adjudicada | desierta | cancelada"
    text enlace
    text notas
    uuid responsable_id FK
    uuid creado_por FK
  }
  ITEMS_VERIFICACION {
    uuid id PK
    uuid proceso_id FK
    integer orden
    text requisito
    boolean obligatorio
    uuid documento_id FK "null = pendiente"
    boolean cumplido_manual
    text notas
  }
  BITACORA_DESCARGAS {
    uuid id PK
    uuid proceso_id FK
    uuid usuario_id FK
    integer documentos
    integer vencidos
    bigint tamano_bytes
    text ruta
  }
  USUARIOS {
    uuid id PK
  }
```

---

## Relaciones y reglas de borrado

| Relación | Cardinalidad | Al borrar el padre |
|---|---|---|
| `auth.users` → `usuarios` | 1 : 1 | cascade |
| `roles` → `usuarios.rol` | 1 : N | restrict |
| `usuarios` → `perfiles` | 1 : 1 | cascade |
| `rutas` → `tarifas.ruta_id` | 1 : N (opcional) | cascade |
| `rutas` / `tarifas` → `cotizaciones` | 1 : N | restrict |
| `usuarios` → `cotizaciones` | 1 : N (opcional) | set null |
| `cotizaciones` → `detalle_cotizacion` | 1 : N | cascade |
| `cotizaciones` → `solicitudes` | 1 : 0..1 | restrict |
| `usuarios` → `solicitudes` (cliente / asesor) | 1 : N | cascade / set null |
| `paquetes` → `imagenes_paquete`, `itinerario_paquete`, `fechas_salida` | 1 : N | cascade |
| `fechas_salida` → `reservas` | 1 : N | restrict |
| `usuarios` → `reservas` | 1 : N | restrict |
| `reservas` → `viajeros`, `abonos` | 1 : N | cascade |
| `usuarios` → `abonos.asesor_id` | 1 : N (opcional) | set null |
| `categorias_doc` → `documentos` | 1 : N | restrict |
| `documentos` → `versiones_doc` | 1 : N | cascade |
| `documentos` → `vigencias` | 1 : 0..1 | cascade |
| `documentos` → `alertas` | 1 : N | cascade |
| `usuarios` → `vigencias.responsable_id` | 1 : N | restrict |
| `procesos_licitacion` → `items_verificacion`, `bitacora_descargas` | 1 : N | cascade |
| `documentos` → `items_verificacion` | 1 : N (opcional) | set null |

## Reglas de negocio reflejadas en el modelo

- **Tarifas sin superposición:** restricción `exclude using gist` sobre tipo de vehículo, ruta,
  jornada y rango de vigencia.
- **Cotización inmutable:** `cotizaciones` copia origen, destino, distancia y condiciones de la tarifa
  para que el historial no cambie si después se edita la ruta o la tarifa.
- **Una solicitud por cotización:** `solicitudes.cotizacion_id` es único.
- **Cupos:** `fechas_salida.cupos_disponibles = cupos_totales − cupos_reservados` (columna calculada);
  `liberar-cupos` devuelve los cupos de las prerreservas vencidas.
- **Saldo:** `reservas.saldo = valor_total − valor_abonado` (columna calculada); solo los abonos
  aprobados suman a `valor_abonado`.
- **Historial documental:** cada carga crea una fila en `versiones_doc` y actualiza
  `documentos.version_actual`.
- **Alertas sin duplicados:** único por (`documento_id`, `fecha_vencimiento`, `umbral`).
