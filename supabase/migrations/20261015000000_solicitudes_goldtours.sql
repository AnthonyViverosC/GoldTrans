-- Sprint 3 · Cotización formal y catálogo Goldtours
-- HU-16 solicitud formal · HU-17 gestión del asesor
-- HU-18 catálogo · HU-19 ficha · HU-20 fechas con cupos · HU-21 paquetes

-- ═════════════════════════════════════════════════════════════
-- SOLICITUDES (HU-16 · HU-17)
-- Flujo: pendiente → confirmada | ajustada | rechazada  (asesor)
--        ajustada → confirmada | cancelada               (cliente)
--        pendiente → cancelada                           (cliente)
-- Los cambios de estado solo ocurren por las funciones de abajo.
-- ═════════════════════════════════════════════════════════════
create sequence public.solicitudes_consecutivo_seq;

create table public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique
    default ('SOL-' || lpad(nextval('public.solicitudes_consecutivo_seq')::text, 6, '0')),
  -- Una cotización se formaliza una sola vez.
  cotizacion_id uuid not null unique references public.cotizaciones (id),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'confirmada', 'ajustada', 'rechazada', 'cancelada')),
  nombre_contacto text not null check (length(trim(nombre_contacto)) > 0),
  telefono_contacto text not null check (telefono_contacto ~ '^\+?[0-9]{7,15}$'),
  direccion_recogida text not null check (length(trim(direccion_recogida)) > 0),
  hora_recogida time not null,
  observaciones text,
  -- Valor de la cotización al momento de solicitar; valor_final es el que confirma el asesor.
  valor_cotizado integer not null check (valor_cotizado >= 0),
  valor_final integer check (valor_final >= 0),
  motivo text,
  asesor_id uuid references public.usuarios (id) on delete set null,
  respondida_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint solicitudes_motivo_requerido check (
    estado not in ('rechazada', 'ajustada') or length(trim(coalesce(motivo, ''))) > 0
  ),
  constraint solicitudes_valor_final_requerido check (
    estado not in ('ajustada', 'confirmada') or valor_final is not null
  )
);

alter sequence public.solicitudes_consecutivo_seq owned by public.solicitudes.codigo;

create index solicitudes_estado_idx on public.solicitudes (estado, created_at);
create index solicitudes_usuario_idx on public.solicitudes (usuario_id, created_at desc);
create index solicitudes_asesor_idx on public.solicitudes (asesor_id);

create trigger solicitudes_set_updated_at
  before update on public.solicitudes
  for each row execute function public.set_updated_at();

-- Fecha actual en Colombia.
create or replace function public.hoy_colombia()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Bogota')::date;
$$;

-- HU-16 · El cliente convierte una de sus cotizaciones en solicitud formal.
create or replace function public.crear_solicitud(
  p_cotizacion_id uuid,
  p_nombre_contacto text,
  p_telefono_contacto text,
  p_direccion_recogida text,
  p_hora_recogida time,
  p_observaciones text default null
)
returns public.solicitudes
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cotizaciones;
  s public.solicitudes;
begin
  if public.rol_actual() <> 'cliente' then
    raise exception 'Solo los clientes pueden solicitar servicios' using errcode = '42501';
  end if;

  select * into c from public.cotizaciones where id = p_cotizacion_id and usuario_id = auth.uid();
  if not found then
    raise exception 'Cotización no encontrada' using errcode = 'P0002';
  end if;
  if c.fecha_inicio < public.hoy_colombia() then
    raise exception 'La fecha del servicio ya pasó. Haz una nueva cotización' using errcode = '22023';
  end if;

  insert into public.solicitudes (
    cotizacion_id, usuario_id, nombre_contacto, telefono_contacto, direccion_recogida,
    hora_recogida, observaciones, valor_cotizado
  ) values (
    c.id, c.usuario_id, trim(p_nombre_contacto), p_telefono_contacto, trim(p_direccion_recogida),
    p_hora_recogida, nullif(trim(coalesce(p_observaciones, '')), ''), c.valor_total
  )
  returning * into s;
  return s;
end;
$$;

-- HU-17 · El asesor confirma, ajusta el valor o rechaza (con motivo) una solicitud pendiente.
create or replace function public.responder_solicitud(
  p_solicitud_id uuid,
  p_accion text,
  p_valor integer default null,
  p_motivo text default null
)
returns public.solicitudes
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.solicitudes;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  if not public.tiene_rol('asesor', 'admin') then
    raise exception 'Solo un asesor puede responder solicitudes' using errcode = '42501';
  end if;

  select * into s from public.solicitudes where id = p_solicitud_id for update;
  if not found then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;
  if s.estado <> 'pendiente' then
    raise exception 'La solicitud ya fue respondida' using errcode = '55000';
  end if;

  if p_accion = 'confirmar' then
    s.estado := 'confirmada';
    s.valor_final := s.valor_cotizado;
  elsif p_accion = 'ajustar' then
    if p_valor is null or p_valor <= 0 then
      raise exception 'Indica el nuevo valor' using errcode = '22023';
    end if;
    if v_motivo is null then
      raise exception 'Explica el motivo del ajuste' using errcode = '22023';
    end if;
    s.estado := 'ajustada';
    s.valor_final := p_valor;
  elsif p_accion = 'rechazar' then
    if v_motivo is null then
      raise exception 'Indica el motivo del rechazo' using errcode = '22023';
    end if;
    s.estado := 'rechazada';
  else
    raise exception 'Acción no válida' using errcode = '22023';
  end if;

  update public.solicitudes
     set estado = s.estado, valor_final = s.valor_final, motivo = v_motivo,
         asesor_id = auth.uid(), respondida_at = now()
   where id = s.id
  returning * into s;
  return s;
end;
$$;

-- El cliente acepta un ajuste o cancela su solicitud (pendiente o ajustada).
create or replace function public.decidir_solicitud(p_solicitud_id uuid, p_accion text)
returns public.solicitudes
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.solicitudes;
begin
  if public.rol_actual() = 'visitante' then
    raise exception 'Inicia sesión' using errcode = '42501';
  end if;

  select * into s from public.solicitudes
   where id = p_solicitud_id and usuario_id = auth.uid()
   for update;
  if not found then
    raise exception 'Solicitud no encontrada' using errcode = 'P0002';
  end if;

  if p_accion = 'aceptar' and s.estado = 'ajustada' then
    s.estado := 'confirmada';
  elsif p_accion = 'cancelar' and s.estado in ('pendiente', 'ajustada') then
    s.estado := 'cancelada';
  else
    raise exception 'La solicitud no se puede % en estado %', p_accion, s.estado using errcode = '55000';
  end if;

  update public.solicitudes set estado = s.estado where id = s.id returning * into s;
  return s;
end;
$$;

revoke execute on function public.crear_solicitud(uuid, text, text, text, time, text) from public, anon;
revoke execute on function public.responder_solicitud(uuid, text, integer, text) from public, anon;
revoke execute on function public.decidir_solicitud(uuid, text) from public, anon;
grant execute on function public.crear_solicitud(uuid, text, text, text, time, text) to authenticated;
grant execute on function public.responder_solicitud(uuid, text, integer, text) to authenticated;
grant execute on function public.decidir_solicitud(uuid, text) to authenticated;

-- ═════════════════════════════════════════════════════════════
-- GOLDTOURS (HU-18 a HU-21)
-- ═════════════════════════════════════════════════════════════
create table public.paquetes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  destino text not null check (length(trim(destino)) > 0),
  descripcion text not null default '',
  duracion_dias integer not null check (duracion_dias between 1 and 60),
  duracion_noches integer not null default 0 check (duracion_noches >= 0),
  precio_por_persona integer not null check (precio_por_persona > 0),
  incluye text[] not null default '{}',
  no_incluye text[] not null default '{}',
  -- Se publica en el catálogo solo si está activo y tiene al menos una foto.
  activo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paquetes_noches check (duracion_noches <= duracion_dias)
);

create trigger paquetes_set_updated_at
  before update on public.paquetes
  for each row execute function public.set_updated_at();

-- Fotos en el bucket público "paquetes"; la de menor orden es la portada.
create table public.imagenes_paquete (
  id uuid primary key default gen_random_uuid(),
  paquete_id uuid not null references public.paquetes (id) on delete cascade,
  ruta text not null unique,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index imagenes_paquete_paquete_idx on public.imagenes_paquete (paquete_id, orden);

create table public.itinerario_paquete (
  id uuid primary key default gen_random_uuid(),
  paquete_id uuid not null references public.paquetes (id) on delete cascade,
  dia integer not null check (dia between 1 and 60),
  titulo text not null check (length(trim(titulo)) > 0),
  descripcion text not null default '',
  unique (paquete_id, dia)
);

-- HU-20 · Fechas de salida con cupos. La restricción fechas_salida_cupos impide vender más
-- cupos de los que hay: las reservas (Sprint 4) suman a cupos_reservados.
create table public.fechas_salida (
  id uuid primary key default gen_random_uuid(),
  paquete_id uuid not null references public.paquetes (id) on delete cascade,
  fecha_salida date not null,
  fecha_regreso date not null,
  cupos_totales integer not null check (cupos_totales between 1 and 500),
  cupos_reservados integer not null default 0,
  cupos_disponibles integer generated always as (cupos_totales - cupos_reservados) stored,
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fechas_salida_regreso check (fecha_regreso >= fecha_salida),
  constraint fechas_salida_cupos check (cupos_reservados between 0 and cupos_totales),
  unique (paquete_id, fecha_salida)
);

create index fechas_salida_fecha_idx on public.fechas_salida (fecha_salida);

create trigger fechas_salida_set_updated_at
  before update on public.fechas_salida
  for each row execute function public.set_updated_at();

-- Un paquete es público si está activo y tiene foto. security definer: las políticas de
-- paquetes e imágenes se consultan entre sí y así se evita la recursión de RLS.
create or replace function public.paquete_publicado(p_paquete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.paquetes p
     where p.id = p_paquete_id
       and p.activo
       and exists (select 1 from public.imagenes_paquete i where i.paquete_id = p.id)
  );
$$;

revoke execute on function public.paquete_publicado(uuid) from public;
grant execute on function public.paquete_publicado(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Storage: bucket público de fotos de paquetes (solo admin sube o borra).
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('paquetes', 'paquetes', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "paquetes: admin ve archivos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'paquetes' and (select public.tiene_rol('admin')));

create policy "paquetes: admin sube archivos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'paquetes' and (select public.tiene_rol('admin')));

create policy "paquetes: admin reemplaza archivos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'paquetes' and (select public.tiene_rol('admin')));

create policy "paquetes: admin borra archivos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'paquetes' and (select public.tiene_rol('admin')));

-- ═════════════════════════════════════════════════════════════
-- RLS (RNF-02)
-- ═════════════════════════════════════════════════════════════
alter table public.solicitudes enable row level security;
alter table public.paquetes enable row level security;
alter table public.imagenes_paquete enable row level security;
alter table public.itinerario_paquete enable row level security;
alter table public.fechas_salida enable row level security;

revoke all on public.solicitudes, public.paquetes, public.imagenes_paquete,
  public.itinerario_paquete, public.fechas_salida from anon, authenticated;
revoke all on sequence public.solicitudes_consecutivo_seq from anon, authenticated;

-- Las solicitudes solo se crean y cambian de estado con las funciones de arriba.
grant select on public.solicitudes to authenticated;
grant select on public.paquetes, public.imagenes_paquete, public.itinerario_paquete,
  public.fechas_salida to anon, authenticated;
grant insert, update, delete on public.paquetes, public.imagenes_paquete,
  public.itinerario_paquete to authenticated;
-- cupos_reservados no se edita a mano: lo mueven las reservas (Sprint 4).
grant insert (paquete_id, fecha_salida, fecha_regreso, cupos_totales, estado),
  update (fecha_salida, fecha_regreso, cupos_totales, estado),
  delete on public.fechas_salida to authenticated;

-- solicitudes
create policy "solicitudes: ver las propias"
  on public.solicitudes for select
  to authenticated
  using (usuario_id = (select auth.uid()) and (select public.rol_actual()) <> 'visitante');

create policy "solicitudes: asesor y admin ven todas"
  on public.solicitudes for select
  to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));

-- paquetes y sus tablas hijas: público lo publicado; asesor y admin todo; admin administra.
create policy "paquetes: catálogo público"
  on public.paquetes for select
  to anon, authenticated
  using (public.paquete_publicado(id));

create policy "imagenes_paquete: catálogo público"
  on public.imagenes_paquete for select
  to anon, authenticated
  using (public.paquete_publicado(paquete_id));

create policy "itinerario_paquete: catálogo público"
  on public.itinerario_paquete for select
  to anon, authenticated
  using (public.paquete_publicado(paquete_id));

create policy "fechas_salida: catálogo público"
  on public.fechas_salida for select
  to anon, authenticated
  using (public.paquete_publicado(paquete_id));

create policy "paquetes: asesor y admin ven todos"
  on public.paquetes for select to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));
create policy "imagenes_paquete: asesor y admin ven todas"
  on public.imagenes_paquete for select to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));
create policy "itinerario_paquete: asesor y admin ven todo"
  on public.itinerario_paquete for select to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));
create policy "fechas_salida: asesor y admin ven todas"
  on public.fechas_salida for select to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));

create policy "paquetes: admin crea" on public.paquetes for insert to authenticated
  with check ((select public.tiene_rol('admin')));
create policy "paquetes: admin actualiza" on public.paquetes for update to authenticated
  using ((select public.tiene_rol('admin'))) with check ((select public.tiene_rol('admin')));
create policy "paquetes: admin elimina" on public.paquetes for delete to authenticated
  using ((select public.tiene_rol('admin')));

create policy "imagenes_paquete: admin crea" on public.imagenes_paquete for insert to authenticated
  with check ((select public.tiene_rol('admin')));
create policy "imagenes_paquete: admin actualiza" on public.imagenes_paquete for update to authenticated
  using ((select public.tiene_rol('admin'))) with check ((select public.tiene_rol('admin')));
create policy "imagenes_paquete: admin elimina" on public.imagenes_paquete for delete to authenticated
  using ((select public.tiene_rol('admin')));

create policy "itinerario_paquete: admin crea" on public.itinerario_paquete for insert to authenticated
  with check ((select public.tiene_rol('admin')));
create policy "itinerario_paquete: admin actualiza" on public.itinerario_paquete for update to authenticated
  using ((select public.tiene_rol('admin'))) with check ((select public.tiene_rol('admin')));
create policy "itinerario_paquete: admin elimina" on public.itinerario_paquete for delete to authenticated
  using ((select public.tiene_rol('admin')));

create policy "fechas_salida: admin crea" on public.fechas_salida for insert to authenticated
  with check ((select public.tiene_rol('admin')));
create policy "fechas_salida: admin actualiza" on public.fechas_salida for update to authenticated
  using ((select public.tiene_rol('admin'))) with check ((select public.tiene_rol('admin')));
create policy "fechas_salida: admin elimina" on public.fechas_salida for delete to authenticated
  using ((select public.tiene_rol('admin')));
