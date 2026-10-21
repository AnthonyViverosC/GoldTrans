-- Sprint 4 · Reservas, abonos y repositorio documental
-- HU-22 reserva con viajeros · HU-23 abono con comprobante · HU-24 verificación del asesor
-- HU-25 saldo y fecha límite · HU-26 estados y liberación de cupos · HU-27 documentos
-- RNF-06 almacenamiento seguro (buckets privados, carpetas por dueño, archivos inmutables)

-- ═════════════════════════════════════════════════════════════
-- RESERVAS (HU-22 · HU-25 · HU-26)
-- Flujo: prerreserva → confirmada → pagada        (abonos aprobados)
--        prerreserva → vencida                    (sin abono a tiempo: libera cupos)
--        prerreserva | confirmada | pagada → cancelada (asesor con motivo; cliente solo prerreserva sin abonos)
-- Reglas: la prerreserva aparta los cupos 48 h; el primer abono debe ser al menos el 30 %;
--         el saldo se paga hasta 8 días antes de la salida.
-- ═════════════════════════════════════════════════════════════
create sequence public.reservas_consecutivo_seq;

create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique
    default ('GT-' || lpad(nextval('public.reservas_consecutivo_seq')::text, 6, '0')),
  -- restrict: una cuenta con reservas no se borra (se desactiva).
  usuario_id uuid not null references public.usuarios (id) on delete restrict,
  fecha_salida_id uuid not null references public.fechas_salida (id),
  -- Copia del paquete y las fechas: la reserva no cambia si el paquete se edita o se despublica.
  paquete_nombre text not null,
  destino text not null,
  fecha_salida date not null,
  fecha_regreso date not null,
  cupos integer not null check (cupos between 1 and 20),
  precio_por_persona integer not null check (precio_por_persona > 0),
  valor_total integer not null,
  abono_minimo integer not null,
  valor_abonado integer not null default 0,
  saldo integer generated always as (valor_total - valor_abonado) stored,
  estado text not null default 'prerreserva'
    check (estado in ('prerreserva', 'confirmada', 'pagada', 'vencida', 'cancelada')),
  -- Plazo de la prerreserva para registrar el primer abono.
  vence_at timestamptz not null,
  -- Fecha hasta la que se puede pagar el saldo.
  fecha_limite_pago date not null,
  telefono_contacto text not null check (telefono_contacto ~ '^\+?[0-9]{7,15}$'),
  observaciones text,
  motivo_cancelacion text,
  cancelada_por uuid references public.usuarios (id) on delete set null,
  confirmada_at timestamptz,
  pagada_at timestamptz,
  cancelada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservas_valor_total check (valor_total = cupos * precio_por_persona),
  constraint reservas_abono_minimo check (abono_minimo between 1 and valor_total),
  constraint reservas_valor_abonado check (valor_abonado between 0 and valor_total),
  constraint reservas_pagada_sin_saldo check (estado <> 'pagada' or valor_abonado = valor_total),
  constraint reservas_motivo_cancelacion check (
    estado <> 'cancelada' or length(trim(coalesce(motivo_cancelacion, ''))) > 0
  )
);

alter sequence public.reservas_consecutivo_seq owned by public.reservas.codigo;

create index reservas_usuario_idx on public.reservas (usuario_id, created_at desc);
create index reservas_estado_idx on public.reservas (estado, created_at);
create index reservas_fecha_salida_idx on public.reservas (fecha_salida_id);
create index reservas_prerreservas_idx on public.reservas (vence_at) where estado = 'prerreserva';

create trigger reservas_set_updated_at
  before update on public.reservas
  for each row execute function public.set_updated_at();

create table public.viajeros (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas (id) on delete cascade,
  orden integer not null,
  nombre_completo text not null check (length(trim(nombre_completo)) > 0),
  tipo_documento text not null check (tipo_documento in ('CC', 'CE', 'PA', 'TI', 'RC')),
  numero_documento text not null check (numero_documento ~ '^[0-9A-Za-z]{4,20}$'),
  fecha_nacimiento date not null check (fecha_nacimiento >= '1900-01-01'),
  unique (reserva_id, orden),
  unique (reserva_id, numero_documento)
);

-- ═════════════════════════════════════════════════════════════
-- ABONOS (HU-23 · HU-24) · pago por transferencia con comprobante en Storage
-- ═════════════════════════════════════════════════════════════
create table public.abonos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas (id) on delete cascade,
  valor integer not null check (valor > 0),
  fecha_transferencia date not null,
  referencia text,
  -- Ruta en el bucket privado "comprobantes": <usuario_id>/<reserva_id>/<archivo>
  comprobante_ruta text not null unique,
  comprobante_tipo text not null
    check (comprobante_tipo in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  motivo text,
  asesor_id uuid references public.usuarios (id) on delete set null,
  revisado_at timestamptz,
  created_at timestamptz not null default now(),
  constraint abonos_motivo_rechazo check (
    estado <> 'rechazado' or length(trim(coalesce(motivo, ''))) > 0
  )
);

create index abonos_reserva_idx on public.abonos (reserva_id, created_at);
create index abonos_pendientes_idx on public.abonos (created_at) where estado = 'pendiente';

-- ─────────────────────────────────────────────────────────────
-- HU-26 · Vence las prerreservas sin abono cuyo plazo pasó y devuelve sus cupos.
-- No vence las que tienen un abono en revisión: la demora del asesor no es culpa del cliente.
-- La usan la Edge Function liberar-cupos (programada) y crear_reserva (antes de contar cupos).
-- ─────────────────────────────────────────────────────────────
create or replace function public.vencer_prerreservas(p_fecha_salida_id uuid default null)
returns table (reservas_vencidas integer, cupos_liberados integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reservas;
  v_reservas integer := 0;
  v_cupos integer := 0;
begin
  -- skip locked: las reservas que otro proceso está tocando se revisan en la siguiente ejecución.
  for r in
    select * from public.reservas
     where estado = 'prerreserva'
       and vence_at < now()
       and (p_fecha_salida_id is null or fecha_salida_id = p_fecha_salida_id)
     order by vence_at
     for update skip locked
  loop
    -- Consulta nueva (otra instantánea) después del bloqueo: ve los abonos recién registrados.
    continue when exists (
      select 1 from public.abonos a where a.reserva_id = r.id and a.estado = 'pendiente'
    );
    update public.reservas set estado = 'vencida', cancelada_at = now() where id = r.id;
    update public.fechas_salida
       set cupos_reservados = cupos_reservados - r.cupos
     where id = r.fecha_salida_id;
    v_reservas := v_reservas + 1;
    v_cupos := v_cupos + r.cupos;
  end loop;

  return query select v_reservas, v_cupos;
end;
$$;

-- HU-22 · El cliente reserva cupos de una fecha de salida con los datos de cada viajero.
-- p_viajeros: [{ nombre_completo, tipo_documento, numero_documento, fecha_nacimiento }]
create or replace function public.crear_reserva(
  p_fecha_salida_id uuid,
  p_viajeros jsonb,
  p_telefono_contacto text,
  p_observaciones text default null
)
returns public.reservas
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.fechas_salida;
  p public.paquetes;
  r public.reservas;
  n integer;
  v_hoy date := public.hoy_colombia();
  v_limite_pago date;
  v_inicio_salida timestamptz;
begin
  if public.rol_actual() <> 'cliente' then
    raise exception 'Solo los clientes pueden reservar' using errcode = '42501';
  end if;

  if jsonb_typeof(p_viajeros) is distinct from 'array' then
    raise exception 'Indica los datos de los viajeros' using errcode = '22023';
  end if;
  n := jsonb_array_length(p_viajeros);
  if n < 1 or n > 20 then
    raise exception 'Una reserva lleva entre 1 y 20 viajeros' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_viajeros) as e (v)
     where (e.v ->> 'fecha_nacimiento')::date > v_hoy
  ) then
    raise exception 'La fecha de nacimiento no puede ser futura' using errcode = '22023';
  end if;

  -- Bloquea la fecha: dos reservas simultáneas no pueden tomar los mismos cupos.
  select * into f from public.fechas_salida where id = p_fecha_salida_id for update;
  if not found or not public.paquete_publicado(f.paquete_id) then
    raise exception 'La fecha de salida no existe o ya no está disponible' using errcode = 'P0002';
  end if;
  if f.fecha_salida <= v_hoy then
    raise exception 'Esta salida ya no admite reservas' using errcode = '55000';
  end if;
  if f.estado <> 'abierta' then
    raise exception 'Las reservas para esta salida están cerradas' using errcode = '55000';
  end if;

  -- Antes de contar, devuelve los cupos de prerreservas vencidas de esta fecha.
  perform public.vencer_prerreservas(f.id);
  select * into f from public.fechas_salida where id = f.id;
  if f.cupos_disponibles = 0 then
    raise exception 'Esta salida está agotada' using errcode = '55000';
  end if;
  if f.cupos_disponibles < n then
    raise exception 'Solo quedan % cupos en esta salida', f.cupos_disponibles using errcode = '55000';
  end if;

  select * into p from public.paquetes where id = f.paquete_id;

  -- Saldo hasta 8 días antes de la salida; con reservas de última hora, al menos 2 días de plazo
  -- y nunca después del día anterior a la salida.
  v_limite_pago := least(greatest(f.fecha_salida - 8, v_hoy + 2), f.fecha_salida - 1);
  v_inicio_salida := f.fecha_salida::timestamp at time zone 'America/Bogota';

  insert into public.reservas (
    usuario_id, fecha_salida_id, paquete_nombre, destino, fecha_salida, fecha_regreso,
    cupos, precio_por_persona, valor_total, abono_minimo, vence_at, fecha_limite_pago,
    telefono_contacto, observaciones
  ) values (
    auth.uid(), f.id, p.nombre, p.destino, f.fecha_salida, f.fecha_regreso,
    n, p.precio_por_persona, n * p.precio_por_persona,
    ceil(n * p.precio_por_persona * 0.30)::integer,
    least(now() + interval '48 hours', (v_limite_pago + 1)::timestamp at time zone 'America/Bogota', v_inicio_salida),
    v_limite_pago,
    p_telefono_contacto, nullif(trim(coalesce(p_observaciones, '')), '')
  )
  returning * into r;

  insert into public.viajeros (
    reserva_id, orden, nombre_completo, tipo_documento, numero_documento, fecha_nacimiento
  )
  select r.id, t.orden::integer, trim(t.v ->> 'nombre_completo'), t.v ->> 'tipo_documento',
         upper(trim(t.v ->> 'numero_documento')), (t.v ->> 'fecha_nacimiento')::date
    from jsonb_array_elements(p_viajeros) with ordinality as t (v, orden);

  -- La restricción fechas_salida_cupos es la última barrera contra la sobreventa.
  update public.fechas_salida set cupos_reservados = cupos_reservados + n where id = f.id;

  return r;
end;
$$;

-- HU-26 · Cancela una reserva y devuelve sus cupos.
-- Asesor/admin: cualquier reserva activa, con motivo. Cliente: su prerreserva sin abonos aprobados.
create or replace function public.cancelar_reserva(p_reserva_id uuid, p_motivo text default null)
returns public.reservas
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reservas;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_asesor boolean := public.tiene_rol('asesor', 'admin');
begin
  if public.rol_actual() = 'visitante' then
    raise exception 'Inicia sesión' using errcode = '42501';
  end if;

  select * into r from public.reservas
   where id = p_reserva_id and (v_asesor or usuario_id = auth.uid())
   for update;
  if not found then
    raise exception 'Reserva no encontrada' using errcode = 'P0002';
  end if;

  if v_asesor then
    if r.estado not in ('prerreserva', 'confirmada', 'pagada') then
      raise exception 'La reserva ya está %', r.estado using errcode = '55000';
    end if;
    if v_motivo is null then
      raise exception 'Indica el motivo de la cancelación' using errcode = '22023';
    end if;
  else
    if r.estado <> 'prerreserva' or r.valor_abonado > 0 then
      raise exception 'Tu reserva ya tiene abonos aprobados: comunícate con un asesor para cancelarla'
        using errcode = '55000';
    end if;
    v_motivo := coalesce(v_motivo, 'Cancelada por el cliente');
  end if;

  update public.reservas
     set estado = 'cancelada', motivo_cancelacion = v_motivo, cancelada_por = auth.uid(),
         cancelada_at = now()
   where id = r.id
  returning * into r;

  update public.fechas_salida
     set cupos_reservados = cupos_reservados - r.cupos
   where id = r.fecha_salida_id;

  -- Los comprobantes que seguían en revisión ya no aplican.
  update public.abonos
     set estado = 'rechazado', motivo = 'La reserva fue cancelada', asesor_id = auth.uid(),
         revisado_at = now()
   where reserva_id = r.id and estado = 'pendiente';

  return r;
end;
$$;

-- HU-23 · El cliente registra un abono con el comprobante que ya subió a Storage.
-- El tipo de archivo se toma de Storage, no de lo que diga la app.
create or replace function public.registrar_abono(
  p_reserva_id uuid,
  p_valor integer,
  p_fecha_transferencia date,
  p_comprobante_ruta text,
  p_referencia text default null
)
returns public.abonos
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reservas;
  a public.abonos;
  v_pendiente integer;
  v_tipo text;
begin
  if public.rol_actual() <> 'cliente' then
    raise exception 'Solo el cliente registra abonos de su reserva' using errcode = '42501';
  end if;

  select * into r from public.reservas
   where id = p_reserva_id and usuario_id = auth.uid()
   for update;
  if not found then
    raise exception 'Reserva no encontrada' using errcode = 'P0002';
  end if;
  if r.estado not in ('prerreserva', 'confirmada') then
    raise exception 'La reserva está % y no admite abonos', r.estado using errcode = '55000';
  end if;
  if r.estado = 'prerreserva' and r.vence_at < now() then
    raise exception 'La prerreserva venció. Haz una nueva reserva' using errcode = '55000';
  end if;
  if p_fecha_transferencia is null or p_fecha_transferencia > public.hoy_colombia() then
    raise exception 'La fecha de la transferencia no puede ser futura' using errcode = '22023';
  end if;

  select coalesce(sum(valor), 0)::integer into v_pendiente
    from public.abonos where reserva_id = r.id and estado = 'pendiente';
  if p_valor is null or p_valor <= 0 then
    raise exception 'Indica el valor transferido' using errcode = '22023';
  end if;
  if p_valor > r.saldo - v_pendiente then
    raise exception 'El abono supera el saldo pendiente (% por verificar o pagar)', r.saldo - v_pendiente
      using errcode = '22023';
  end if;
  if r.valor_abonado + v_pendiente + p_valor < r.abono_minimo then
    raise exception 'El primer abono debe ser de al menos %', r.abono_minimo - r.valor_abonado - v_pendiente
      using errcode = '22023';
  end if;

  -- RNF-06 · El comprobante debe estar en la carpeta del cliente y de esta reserva, y existir.
  if p_comprobante_ruta is null
     or split_part(p_comprobante_ruta, '/', 1) <> auth.uid()::text
     or split_part(p_comprobante_ruta, '/', 2) <> r.id::text then
    raise exception 'Comprobante no válido' using errcode = '42501';
  end if;
  select o.metadata ->> 'mimetype' into v_tipo
    from storage.objects o
   where o.bucket_id = 'comprobantes' and o.name = p_comprobante_ruta;
  if not found then
    raise exception 'No encontramos el comprobante. Vuelve a adjuntarlo' using errcode = 'P0002';
  end if;

  insert into public.abonos (reserva_id, valor, fecha_transferencia, referencia, comprobante_ruta, comprobante_tipo)
  values (
    r.id, p_valor, p_fecha_transferencia, nullif(trim(coalesce(p_referencia, '')), ''),
    p_comprobante_ruta, coalesce(v_tipo, 'application/octet-stream')
  )
  returning * into a;
  return a;
end;
$$;

-- HU-24 · El asesor aprueba o rechaza (con motivo) un abono después de ver el comprobante.
-- Al aprobar: suma al abonado y la reserva pasa a confirmada (abono mínimo) o pagada (saldo 0).
create or replace function public.verificar_abono(p_abono_id uuid, p_accion text, p_motivo text default null)
returns public.abonos
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.abonos;
  r public.reservas;
  v_reserva_id uuid;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
  v_abonado integer;
begin
  if not public.tiene_rol('asesor', 'admin') then
    raise exception 'Solo un asesor puede verificar abonos' using errcode = '42501';
  end if;

  -- Orden de bloqueo reserva → abono (el mismo de cancelar_reserva) para evitar interbloqueos.
  select reserva_id into v_reserva_id from public.abonos where id = p_abono_id;
  if not found then
    raise exception 'Abono no encontrado' using errcode = 'P0002';
  end if;
  select * into r from public.reservas where id = v_reserva_id for update;
  select * into a from public.abonos where id = p_abono_id for update;
  if a.estado <> 'pendiente' then
    raise exception 'El abono ya fue verificado' using errcode = '55000';
  end if;

  if p_accion = 'aprobar' then
    if r.estado not in ('prerreserva', 'confirmada') then
      raise exception 'La reserva está %: no se pueden aprobar abonos', r.estado using errcode = '55000';
    end if;
    if a.valor > r.saldo then
      raise exception 'El abono supera el saldo de la reserva' using errcode = '55000';
    end if;
    v_abonado := r.valor_abonado + a.valor;
    update public.reservas
       set valor_abonado = v_abonado,
           estado = case
             when v_abonado = valor_total then 'pagada'
             when v_abonado >= abono_minimo then 'confirmada'
             else estado
           end,
           confirmada_at = case when v_abonado >= abono_minimo then coalesce(confirmada_at, now()) end,
           pagada_at = case when v_abonado = valor_total then now() end
     where id = r.id;
    update public.abonos
       set estado = 'aprobado', motivo = v_motivo, asesor_id = auth.uid(), revisado_at = now()
     where id = a.id
    returning * into a;
  elsif p_accion = 'rechazar' then
    if v_motivo is null then
      raise exception 'Indica el motivo del rechazo' using errcode = '22023';
    end if;
    update public.abonos
       set estado = 'rechazado', motivo = v_motivo, asesor_id = auth.uid(), revisado_at = now()
     where id = a.id
    returning * into a;
    -- Si la prerreserva está por vencer, el cliente tiene 24 h para enviar otro comprobante
    -- (sin pasar del inicio de la salida).
    if r.estado = 'prerreserva' then
      update public.reservas
         set vence_at = greatest(
               vence_at,
               least(now() + interval '24 hours', fecha_salida::timestamp at time zone 'America/Bogota')
             )
       where id = r.id;
    end if;
  else
    raise exception 'Acción no válida' using errcode = '22023';
  end if;

  return a;
end;
$$;

revoke execute on function public.vencer_prerreservas(uuid) from public, anon, authenticated;
grant execute on function public.vencer_prerreservas(uuid) to service_role;
revoke execute on function public.crear_reserva(uuid, jsonb, text, text) from public, anon;
revoke execute on function public.cancelar_reserva(uuid, text) from public, anon;
revoke execute on function public.registrar_abono(uuid, integer, date, text, text) from public, anon;
revoke execute on function public.verificar_abono(uuid, text, text) from public, anon;
grant execute on function public.crear_reserva(uuid, jsonb, text, text) to authenticated;
grant execute on function public.cancelar_reserva(uuid, text) to authenticated;
grant execute on function public.registrar_abono(uuid, integer, date, text, text) to authenticated;
grant execute on function public.verificar_abono(uuid, text, text) to authenticated;

-- ═════════════════════════════════════════════════════════════
-- REPOSITORIO DOCUMENTAL (HU-27) · solo asesor y admin
-- Cada documento guarda todas sus versiones; los archivos no se reemplazan.
-- ═════════════════════════════════════════════════════════════
create table public.categorias_doc (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique check (length(trim(nombre)) > 0),
  descripcion text not null default '',
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.categorias_doc (nombre, descripcion, orden) values
  ('Legales', 'Cámara de comercio, RUT, cédula del representante legal', 1),
  ('Habilitación', 'Resolución del Ministerio de Transporte, capacidad transportadora', 2),
  ('Financieros', 'Estados financieros, certificaciones bancarias, declaraciones de renta', 3),
  ('Pólizas', 'Responsabilidad civil contractual y extracontractual, cumplimiento', 4),
  ('Vehículos', 'SOAT, revisión técnico-mecánica, tarjetas de operación y de propiedad', 5),
  ('Conductores', 'Licencias de conducción, seguridad social, capacitaciones', 6),
  ('Experiencia', 'Contratos ejecutados y certificaciones de clientes', 7);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  -- restrict: una categoría con documentos no se elimina.
  categoria_id uuid not null references public.categorias_doc (id),
  nombre text not null check (length(trim(nombre)) > 0),
  descripcion text not null default '',
  version_actual integer not null default 1 check (version_actual >= 1),
  creado_por uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index documentos_nombre_unico on public.documentos (categoria_id, lower(nombre));

create trigger documentos_set_updated_at
  before update on public.documentos
  for each row execute function public.set_updated_at();

create table public.versiones_doc (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos (id) on delete cascade,
  version integer not null check (version >= 1),
  -- Ruta en el bucket privado "documentos".
  ruta text not null unique,
  nombre_archivo text not null check (length(trim(nombre_archivo)) > 0),
  tipo_mime text not null,
  tamano_bytes bigint not null check (tamano_bytes > 0),
  notas text,
  subido_por uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (documento_id, version)
);

-- Datos del archivo según Storage (no según la app). Falla si el archivo no se subió.
create or replace function public.archivo_documento(p_ruta text)
returns table (tipo_mime text, tamano_bytes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
    select coalesce(o.metadata ->> 'mimetype', 'application/octet-stream'),
           coalesce((o.metadata ->> 'size')::bigint, 0)
      from storage.objects o
     where o.bucket_id = 'documentos' and o.name = p_ruta;
  if not found then
    raise exception 'No encontramos el archivo. Vuelve a adjuntarlo' using errcode = 'P0002';
  end if;
end;
$$;

-- Crea el documento con su versión 1 en una sola transacción.
create or replace function public.crear_documento(
  p_categoria_id uuid,
  p_nombre text,
  p_ruta text,
  p_nombre_archivo text,
  p_descripcion text default null,
  p_notas text default null
)
returns public.documentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.documentos;
  f record;
begin
  if not public.tiene_rol('asesor', 'admin') then
    raise exception 'Solo asesores y administradores cargan documentos' using errcode = '42501';
  end if;
  select * into f from public.archivo_documento(p_ruta);

  insert into public.documentos (categoria_id, nombre, descripcion, creado_por)
  values (p_categoria_id, trim(p_nombre), coalesce(trim(p_descripcion), ''), auth.uid())
  returning * into d;

  insert into public.versiones_doc (documento_id, version, ruta, nombre_archivo, tipo_mime, tamano_bytes, notas, subido_por)
  values (d.id, 1, p_ruta, trim(p_nombre_archivo), f.tipo_mime, f.tamano_bytes,
          nullif(trim(coalesce(p_notas, '')), ''), auth.uid());
  return d;
end;
$$;

-- Agrega una versión nueva: la anterior queda en el historial.
create or replace function public.agregar_version_documento(
  p_documento_id uuid,
  p_ruta text,
  p_nombre_archivo text,
  p_notas text default null
)
returns public.versiones_doc
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.documentos;
  v public.versiones_doc;
  f record;
begin
  if not public.tiene_rol('asesor', 'admin') then
    raise exception 'Solo asesores y administradores cargan documentos' using errcode = '42501';
  end if;
  select * into d from public.documentos where id = p_documento_id for update;
  if not found then
    raise exception 'Documento no encontrado' using errcode = 'P0002';
  end if;
  select * into f from public.archivo_documento(p_ruta);

  insert into public.versiones_doc (documento_id, version, ruta, nombre_archivo, tipo_mime, tamano_bytes, notas, subido_por)
  values (d.id, d.version_actual + 1, p_ruta, trim(p_nombre_archivo), f.tipo_mime, f.tamano_bytes,
          nullif(trim(coalesce(p_notas, '')), ''), auth.uid())
  returning * into v;

  update public.documentos set version_actual = v.version where id = d.id;
  return v;
end;
$$;

revoke execute on function public.archivo_documento(text) from public, anon, authenticated;
revoke execute on function public.crear_documento(uuid, text, text, text, text, text) from public, anon;
revoke execute on function public.agregar_version_documento(uuid, text, text, text) from public, anon;
grant execute on function public.crear_documento(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.agregar_version_documento(uuid, text, text, text) to authenticated;

-- ═════════════════════════════════════════════════════════════
-- STORAGE (RNF-06) · buckets privados: se leen con URLs firmadas de corta duración.
-- Sin políticas de update: un archivo subido no se reemplaza (evidencia e historial).
-- ═════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('comprobantes', 'comprobantes', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('documentos', 'documentos', false, 20971520,
   array[
     'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
     'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
   ])
on conflict (id) do nothing;

-- comprobantes: <usuario_id>/<reserva_id>/<archivo>. El cliente solo escribe en su carpeta
-- y en reservas suyas; el asesor y el admin leen todo.
create policy "comprobantes: cliente sube a su reserva"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'comprobantes'
    and (select public.rol_actual()) = 'cliente'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.reservas r
       where r.id::text = (storage.foldername(name))[2] and r.usuario_id = (select auth.uid())
    )
  );

create policy "comprobantes: cliente ve los suyos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'comprobantes'
    and (select public.rol_actual()) = 'cliente'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "comprobantes: asesor y admin ven todos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'comprobantes' and (select public.tiene_rol('asesor', 'admin')));

-- El cliente puede borrar un archivo que subió pero que no quedó registrado en un abono
-- (por ejemplo, si registrar_abono falló). Los comprobantes registrados no se borran.
create policy "comprobantes: cliente borra archivos sin abono"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'comprobantes'
    and (select public.rol_actual()) = 'cliente'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.abonos a where a.comprobante_ruta = name)
  );

create policy "documentos: asesor y admin ven archivos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documentos' and (select public.tiene_rol('asesor', 'admin')));

create policy "documentos: asesor y admin suben archivos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documentos' and (select public.tiene_rol('asesor', 'admin')));

create policy "documentos: admin borra archivos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documentos' and (select public.tiene_rol('admin')));

-- ═════════════════════════════════════════════════════════════
-- RLS (RNF-02)
-- ═════════════════════════════════════════════════════════════
alter table public.reservas enable row level security;
alter table public.viajeros enable row level security;
alter table public.abonos enable row level security;
alter table public.categorias_doc enable row level security;
alter table public.documentos enable row level security;
alter table public.versiones_doc enable row level security;

revoke all on public.reservas, public.viajeros, public.abonos, public.categorias_doc,
  public.documentos, public.versiones_doc from anon, authenticated;
revoke all on sequence public.reservas_consecutivo_seq from anon, authenticated;

-- Reservas y abonos solo cambian con las funciones de arriba.
grant select on public.reservas, public.viajeros, public.abonos to authenticated;
grant select, insert, update, delete on public.categorias_doc to authenticated;
-- Los documentos se crean y versionan con funciones; se editan sus datos y el admin los borra.
grant select, update (categoria_id, nombre, descripcion), delete on public.documentos to authenticated;
grant select on public.versiones_doc to authenticated;

create policy "reservas: ver las propias"
  on public.reservas for select
  to authenticated
  using (usuario_id = (select auth.uid()) and (select public.rol_actual()) <> 'visitante');

create policy "reservas: asesor y admin ven todas"
  on public.reservas for select
  to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));

-- viajeros y abonos: visibles si la reserva lo es (la subconsulta aplica las políticas de reservas).
create policy "viajeros: de reservas visibles"
  on public.viajeros for select
  to authenticated
  using (exists (select 1 from public.reservas r where r.id = reserva_id));

create policy "abonos: de reservas visibles"
  on public.abonos for select
  to authenticated
  using (exists (select 1 from public.reservas r where r.id = reserva_id));

create policy "categorias_doc: asesor y admin ven"
  on public.categorias_doc for select to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));
create policy "categorias_doc: admin crea" on public.categorias_doc for insert to authenticated
  with check ((select public.tiene_rol('admin')));
create policy "categorias_doc: admin actualiza" on public.categorias_doc for update to authenticated
  using ((select public.tiene_rol('admin'))) with check ((select public.tiene_rol('admin')));
create policy "categorias_doc: admin elimina" on public.categorias_doc for delete to authenticated
  using ((select public.tiene_rol('admin')));

create policy "documentos: asesor y admin ven"
  on public.documentos for select to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));
create policy "documentos: asesor y admin editan datos"
  on public.documentos for update to authenticated
  using ((select public.tiene_rol('asesor', 'admin')))
  with check ((select public.tiene_rol('asesor', 'admin')));
create policy "documentos: admin elimina"
  on public.documentos for delete to authenticated
  using ((select public.tiene_rol('admin')));

create policy "versiones_doc: asesor y admin ven"
  on public.versiones_doc for select to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));

-- ═════════════════════════════════════════════════════════════
-- PROGRAMACIÓN (HU-26) · pg_cron llama a la Edge Function liberar-cupos cada 15 minutos.
-- La URL del proyecto y el secreto se guardan una sola vez en Vault (ver docs/sprint-4.md);
-- mientras no existan, la tarea falla sin efectos y crear_reserva sigue liberando cupos.
-- ═════════════════════════════════════════════════════════════
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    perform cron.schedule(
      'liberar-cupos',
      '*/15 * * * *',
      $cron$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
                 || '/functions/v1/liberar-cupos',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
          ),
          body := '{}'::jsonb
        );
      $cron$
    );
  end if;
end;
$$;
