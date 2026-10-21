-- Sprint 1 · Base y gestión de usuarios
-- HU-01 registro · HU-03 roles · HU-04 perfil · HU-06 flota · HU-08 gestión de usuarios
-- RNF-01 Auth JWT · RNF-02 RLS por rol

-- ─────────────────────────────────────────────────────────────
-- roles: catálogo de los cuatro roles del sistema.
-- "visitante" es el rol de quien no ha iniciado sesión (JWT anon);
-- nunca se asigna a un usuario registrado.
-- ─────────────────────────────────────────────────────────────
create table public.roles (
  codigo text primary key,
  nombre text not null,
  descripcion text not null
);

insert into public.roles (codigo, nombre, descripcion) values
  ('visitante', 'Visitante', 'Sin sesión: puede cotizar y ver el catálogo Goldtours'),
  ('cliente', 'Cliente', 'Persona o empresa registrada: solicitudes, reservas y abonos propios'),
  ('asesor', 'Asesor comercial', 'Gestiona solicitudes, verifica abonos y accede al repositorio documental'),
  ('admin', 'Administrador', 'Administra usuarios, flota, rutas, tarifas y paquetes');

-- ─────────────────────────────────────────────────────────────
-- usuarios: una fila por cuenta de Supabase Auth con su rol y estado.
-- ─────────────────────────────────────────────────────────────
create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  rol text not null default 'cliente' references public.roles (codigo),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint usuarios_rol_registrado check (rol <> 'visitante')
);

create index usuarios_rol_idx on public.usuarios (rol);

create trigger usuarios_set_updated_at
  before update on public.usuarios
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- perfiles: datos de la persona natural o de la empresa (NIT).
-- ─────────────────────────────────────────────────────────────
create table public.perfiles (
  usuario_id uuid primary key references public.usuarios (id) on delete cascade,
  tipo_persona text not null check (tipo_persona in ('persona', 'empresa')),
  nombre_completo text not null check (length(trim(nombre_completo)) > 0),
  tipo_documento text check (tipo_documento in ('CC', 'CE', 'PA', 'TI')),
  numero_documento text check (numero_documento ~ '^[0-9A-Za-z]{4,20}$'),
  razon_social text,
  nit text check (nit ~ '^[0-9]{6,15}-[0-9]$'),
  telefono text check (telefono ~ '^\+?[0-9]{7,15}$'),
  ciudad text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint perfiles_empresa_con_nit check (
    tipo_persona <> 'empresa'
    or (nit is not null and length(trim(coalesce(razon_social, ''))) > 0)
  )
);

create unique index perfiles_nit_unico on public.perfiles (nit) where nit is not null;

create trigger perfiles_set_updated_at
  before update on public.perfiles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- vehiculos: flota de la empresa (HU-06).
-- ─────────────────────────────────────────────────────────────
create table public.vehiculos (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique check (placa ~ '^[A-Z]{3}[0-9]{3}$'),
  tipo text not null check (tipo in ('automovil', 'camioneta', 'van', 'microbus', 'buseta', 'bus')),
  marca text not null,
  modelo text not null,
  anio integer not null check (anio between 1990 and 2100),
  capacidad_pasajeros integer not null check (capacidad_pasajeros between 1 and 80),
  estado text not null default 'disponible'
    check (estado in ('disponible', 'mantenimiento', 'inactivo')),
  soat_vence date,
  tecnomecanica_vence date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vehiculos_estado_capacidad_idx on public.vehiculos (estado, capacidad_pasajeros);

create trigger vehiculos_set_updated_at
  before update on public.vehiculos
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Funciones de autorización usadas por las políticas RLS.
-- security definer para poder leer usuarios sin recursión de RLS.
-- Un usuario desactivado no tiene rol: pierde todo acceso aunque su JWT siga vigente.
-- ─────────────────────────────────────────────────────────────
create or replace function public.rol_actual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.rol from public.usuarios u where u.id = auth.uid() and u.activo),
    'visitante'
  );
$$;

create or replace function public.tiene_rol(variadic roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.rol_actual() = any (roles);
$$;

revoke execute on function public.rol_actual() from public;
revoke execute on function public.tiene_rol(text[]) from public;
grant execute on function public.rol_actual() to anon, authenticated;
grant execute on function public.tiene_rol(text[]) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Alta automática: al crear la cuenta en Auth se crean usuario y perfil
-- con los datos enviados en options.data de signUp().
-- El rol SIEMPRE es cliente; no se lee del metadata para evitar escalamiento.
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  tipo text := coalesce(meta ->> 'tipo_persona', 'persona');
begin
  insert into public.usuarios (id, email) values (new.id, new.email);

  insert into public.perfiles (
    usuario_id, tipo_persona, nombre_completo, tipo_documento, numero_documento,
    razon_social, nit, telefono, ciudad
  ) values (
    new.id,
    tipo,
    coalesce(nullif(trim(meta ->> 'nombre_completo'), ''), split_part(new.email, '@', 1)),
    case when tipo = 'persona' then nullif(meta ->> 'tipo_documento', '') end,
    case when tipo = 'persona' then nullif(meta ->> 'numero_documento', '') end,
    case when tipo = 'empresa' then nullif(trim(meta ->> 'razon_social'), '') end,
    case when tipo = 'empresa' then nullif(meta ->> 'nit', '') end,
    nullif(meta ->> 'telefono', ''),
    nullif(trim(meta ->> 'ciudad'), '')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantiene el correo de usuarios sincronizado con Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.usuarios set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Un administrador no puede quitarse a sí mismo el rol ni desactivarse
-- (evita quedarse sin administradores por error).
create or replace function public.proteger_autoadministracion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id = auth.uid() and (new.rol <> old.rol or new.activo <> old.activo) then
    raise exception 'No puedes cambiar tu propio rol ni desactivar tu propia cuenta'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger usuarios_proteger_autoadministracion
  before update on public.usuarios
  for each row execute function public.proteger_autoadministracion();

-- ─────────────────────────────────────────────────────────────
-- RLS (RNF-02)
-- ─────────────────────────────────────────────────────────────
alter table public.roles enable row level security;
alter table public.usuarios enable row level security;
alter table public.perfiles enable row level security;
alter table public.vehiculos enable row level security;

revoke all on public.roles, public.usuarios, public.perfiles, public.vehiculos from anon, authenticated;
grant select on public.roles to anon, authenticated;
-- Permisos por columna: el correo y las llaves no se modifican desde la app.
grant select, update (rol, activo) on public.usuarios to authenticated;
grant select, update (
  tipo_persona, nombre_completo, tipo_documento, numero_documento,
  razon_social, nit, telefono, ciudad
) on public.perfiles to authenticated;
grant select, insert, update, delete on public.vehiculos to authenticated;

-- roles: catálogo público
create policy "roles: lectura pública"
  on public.roles for select
  to anon, authenticated
  using (true);

-- usuarios: cada quien ve su fila; asesor y admin ven todas; solo admin modifica.
create policy "usuarios: ver la propia"
  on public.usuarios for select
  to authenticated
  using (id = (select auth.uid()));

create policy "usuarios: asesor y admin ven todos"
  on public.usuarios for select
  to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));

create policy "usuarios: admin actualiza"
  on public.usuarios for update
  to authenticated
  using ((select public.tiene_rol('admin')))
  with check ((select public.tiene_rol('admin')));

-- perfiles: el dueño (activo) ve y edita el suyo; asesor y admin consultan; admin edita.
create policy "perfiles: ver el propio"
  on public.perfiles for select
  to authenticated
  using (usuario_id = (select auth.uid()) and (select public.rol_actual()) <> 'visitante');

create policy "perfiles: asesor y admin ven todos"
  on public.perfiles for select
  to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));

create policy "perfiles: editar el propio"
  on public.perfiles for update
  to authenticated
  using (usuario_id = (select auth.uid()) and (select public.rol_actual()) <> 'visitante')
  with check (usuario_id = (select auth.uid()));

create policy "perfiles: admin edita"
  on public.perfiles for update
  to authenticated
  using ((select public.tiene_rol('admin')))
  with check ((select public.tiene_rol('admin')));

-- vehiculos: asesor y admin consultan; solo admin administra.
-- (El cotizador del Sprint 2 sugiere vehículo vía Edge Function con service role.)
create policy "vehiculos: asesor y admin ven la flota"
  on public.vehiculos for select
  to authenticated
  using ((select public.tiene_rol('asesor', 'admin')));

create policy "vehiculos: admin crea"
  on public.vehiculos for insert
  to authenticated
  with check ((select public.tiene_rol('admin')));

create policy "vehiculos: admin actualiza"
  on public.vehiculos for update
  to authenticated
  using ((select public.tiene_rol('admin')))
  with check ((select public.tiene_rol('admin')));

create policy "vehiculos: admin elimina"
  on public.vehiculos for delete
  to authenticated
  using ((select public.tiene_rol('admin')));
