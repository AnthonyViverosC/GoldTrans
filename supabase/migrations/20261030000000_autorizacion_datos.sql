-- RNF-03 · Tratamiento de datos personales según la Ley 1581 de 2012 (SCRUM-27).
-- Autorización previa, expresa e informada del titular al registrarse, con prueba de la
-- autorización: fecha y versión del aviso de privacidad aceptado (Decreto 1377 de 2013, art. 8,
-- compilado en el Decreto 1074 de 2015).

-- ─────────────────────────────────────────────────────────────
-- perfiles: prueba de la autorización
-- ─────────────────────────────────────────────────────────────
-- null en las cuentas creadas antes de esta migración (no tienen autorización registrada).
alter table public.perfiles
  add column autoriza_datos_at timestamptz,
  add column version_aviso_privacidad text;

comment on column public.perfiles.autoriza_datos_at is
  'Ley 1581: fecha y hora en que el titular autorizó el tratamiento de sus datos al registrarse.';
comment on column public.perfiles.version_aviso_privacidad is
  'Ley 1581: versión del aviso de privacidad que aceptó el titular (src/constants/privacidad.ts).';

-- Las columnas nuevas no se agregan al grant de update de perfiles: la app puede leerlas,
-- pero nadie las modifica desde la app.

-- ─────────────────────────────────────────────────────────────
-- Registro: sin autorización no se crea la cuenta
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
  version_aviso text := nullif(trim(meta ->> 'version_aviso_privacidad'), '');
begin
  -- La app valida la casilla, pero la regla se impone aquí para que no se pueda saltar.
  if (meta ->> 'autoriza_datos') is distinct from 'true' or version_aviso is null then
    raise exception 'Se requiere la autorización de tratamiento de datos personales (Ley 1581 de 2012)'
      using errcode = '23514';
  end if;

  insert into public.usuarios (id, email) values (new.id, new.email);

  insert into public.perfiles (
    usuario_id, tipo_persona, nombre_completo, tipo_documento, numero_documento,
    razon_social, nit, telefono, ciudad, autoriza_datos_at, version_aviso_privacidad
  ) values (
    new.id,
    tipo,
    coalesce(nullif(trim(meta ->> 'nombre_completo'), ''), split_part(new.email, '@', 1)),
    case when tipo = 'persona' then nullif(meta ->> 'tipo_documento', '') end,
    case when tipo = 'persona' then nullif(meta ->> 'numero_documento', '') end,
    case when tipo = 'empresa' then nullif(trim(meta ->> 'razon_social'), '') end,
    case when tipo = 'empresa' then nullif(meta ->> 'nit', '') end,
    nullif(meta ->> 'telefono', ''),
    nullif(trim(meta ->> 'ciudad'), ''),
    -- Hora del servidor, no la que envía el cliente.
    now(),
    version_aviso
  );

  return new;
end;
$$;
