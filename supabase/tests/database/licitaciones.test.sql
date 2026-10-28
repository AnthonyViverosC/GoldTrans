-- Sprint 5 · Vigencias, alertas de vencimiento, procesos de licitación y lista de verificación (RLS por rol)
-- Ejecutar con: npx supabase test db   (requiere `npx supabase start`)
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000005a1', 'asesor1@s5.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","nombre_completo":"Asesor Uno"}'),
  ('00000000-0000-0000-0000-0000000005a2', 'asesor2@s5.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","nombre_completo":"Asesor Dos"}'),
  ('00000000-0000-0000-0000-0000000005ad', 'admin@s5.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","nombre_completo":"Admin"}'),
  ('00000000-0000-0000-0000-0000000005c1', 'cliente@s5.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","nombre_completo":"Cliente"}');
update public.usuarios set rol = 'asesor' where email in ('asesor1@s5.co', 'asesor2@s5.co');
update public.usuarios set rol = 'admin' where email = 'admin@s5.co';

insert into public.documentos (id, categoria_id, nombre) values
  ('5d5d5d5d-0000-0000-0000-000000000001', (select id from public.categorias_doc where nombre = 'Pólizas'), 'Póliza RCE'),
  ('5d5d5d5d-0000-0000-0000-000000000002', (select id from public.categorias_doc where nombre = 'Vehículos'), 'SOAT TQK123'),
  ('5d5d5d5d-0000-0000-0000-000000000003', (select id from public.categorias_doc where nombre = 'Legales'), 'Cámara de comercio'),
  ('5d5d5d5d-0000-0000-0000-000000000004', (select id from public.categorias_doc where nombre = 'Habilitación'), 'Resolución MinTransporte');

select results_eq(
  $$select public.estado_vigencia(v.vence, '2030-01-01') from (values
      ('2029-12-31'::date), ('2030-03-02'::date), ('2030-03-03'::date), (null::date)) as v (vence)$$,
  $$values ('vencido'::text), ('por_vencer'::text), ('vigente'::text), ('sin_vigencia'::text)$$,
  'HU-29: Vencido / Por vencer (60 días) / Vigente / Sin vencimiento');
select is((select public from storage.buckets where id = 'paquetes-licitacion'), false,
  'RNF-06: el bucket de paquetes de licitación es privado');

-- ═══ HU-28 · Vigencias ════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated"}', true);

select lives_ok(
  $$insert into public.vigencias (documento_id, fecha_vencimiento, responsable_id) values
    ('5d5d5d5d-0000-0000-0000-000000000001', '2030-02-15', '00000000-0000-0000-0000-0000000005a1'),
    ('5d5d5d5d-0000-0000-0000-000000000002', '2030-01-11', '00000000-0000-0000-0000-0000000005a2'),
    ('5d5d5d5d-0000-0000-0000-000000000003', '2030-04-11', '00000000-0000-0000-0000-0000000005a1'),
    ('5d5d5d5d-0000-0000-0000-000000000004', '2029-12-27', '00000000-0000-0000-0000-0000000005a1')$$,
  'HU-28: el asesor registra vigencias con su responsable');
select is((select actualizado_por from public.vigencias where documento_id = '5d5d5d5d-0000-0000-0000-000000000001'),
  '00000000-0000-0000-0000-0000000005a1'::uuid, 'HU-28: queda registrado quién actualizó la vigencia');
select throws_ok(
  $$update public.vigencias set responsable_id = '00000000-0000-0000-0000-0000000005c1'
     where documento_id = '5d5d5d5d-0000-0000-0000-000000000003'$$,
  '23514', null, 'HU-28: el responsable debe ser un asesor o un administrador');
select throws_ok(
  $$update public.vigencias set fecha_expedicion = '2031-01-01' where documento_id = '5d5d5d5d-0000-0000-0000-000000000003'$$,
  '23514', null, 'HU-28: la expedición no puede ser posterior al vencimiento');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005c1","role":"authenticated"}', true);
select is((select count(*)::int from public.vigencias), 0, 'el cliente no ve vigencias');
select throws_ok(
  $$insert into public.vigencias (documento_id, fecha_vencimiento, responsable_id)
    values ('5d5d5d5d-0000-0000-0000-000000000003', '2031-01-01', '00000000-0000-0000-0000-0000000005a1')$$,
  '42501', null, 'el cliente no registra vigencias');
select throws_ok(
  $$select * from public.generar_alertas_vencimiento('2030-01-01')$$,
  '42501', null, 'HU-28: la app no genera alertas (solo la Edge Function)');

-- ═══ HU-28 · Alertas 60/30/15 (cron) ══════════════════════════
-- 2030-01-01: Póliza a 45 días (umbral 60), SOAT a 10 (15), Cámara a 100 (ninguno), Resolución vencida (0).
set local role service_role;
select is((select count(*)::int from public.generar_alertas_vencimiento('2030-01-01')), 3,
  'HU-28: genera una alerta por cada documento que alcanzó un umbral');
select is((select count(*)::int from public.generar_alertas_vencimiento('2030-01-01')), 0,
  'HU-28: ejecutarlo otra vez el mismo día no repite alertas');
select results_eq(
  $$select d.nombre, a.umbral, a.dias_restantes from public.alertas a join public.documentos d on d.id = a.documento_id
     order by a.umbral desc$$,
  $$values ('Póliza RCE'::text, 60, 45), ('SOAT TQK123'::text, 15, 10), ('Resolución MinTransporte'::text, 0, -5)$$,
  'HU-28: umbral más cercano ya alcanzado y días restantes');
select is((select count(*)::int from public.generar_alertas_vencimiento('2030-01-02')), 0,
  'HU-28: al día siguiente no hay alertas nuevas (no se repite el mismo umbral)');
select results_eq(
  $$select d.nombre, g.email from public.generar_alertas_vencimiento('2030-01-16') g
      join public.documentos d on d.nombre = g.documento order by d.nombre$$,
  $$values ('Póliza RCE'::text, 'asesor1@s5.co'::text), ('SOAT TQK123'::text, 'asesor2@s5.co'::text)$$,
  'HU-28: a los 30 días y al vencer llega una nueva alerta, al correo del responsable');
select ok((select mensaje like '«SOAT TQK123» venció el 2030-01-11%' from public.alertas where umbral = 0
            and documento_id = '5d5d5d5d-0000-0000-0000-000000000002'),
  'HU-28: el mensaje dice qué documento venció y cuándo');

-- Cada responsable ve las suyas; el admin, todas.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated"}', true);
select is((select count(*)::int from public.alertas), 3, 'HU-28: el asesor 1 ve sus 3 alertas');
select lives_ok($$update public.alertas set leida_at = now()$$, 'HU-28: el responsable marca sus alertas como leídas');
select throws_ok($$update public.alertas set mensaje = 'x'$$, '42501', null, 'las alertas no se editan, solo se marcan leídas');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005a2","role":"authenticated"}', true);
select results_eq($$select count(*)::int, count(leida_at)::int from public.alertas$$, $$values (2, 0)$$,
  'HU-28: el asesor 2 ve solo las suyas, sin leer');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005ad","role":"authenticated"}', true);
select is((select count(*)::int from public.alertas), 5, 'HU-28: el admin ve todas las alertas');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005c1","role":"authenticated"}', true);
select is((select count(*)::int from public.alertas), 0, 'el cliente no ve alertas');

-- ═══ HU-31 · HU-32 · Procesos y lista de verificación ═════════
select throws_ok(
  $$insert into public.procesos_licitacion (numero, entidad, objeto, fecha_cierre) values ('X', 'Y', 'Z', '2030-02-01')$$,
  '42501', null, 'HU-31: el cliente no registra procesos');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005a1","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.procesos_licitacion (id, numero, entidad, objeto, fecha_cierre, responsable_id) values
    ('5e5e5e5e-0000-0000-0000-000000000001', 'SA-MC-012-2030', 'Alcaldía de Valle del Guamuez',
     'Transporte escolar rural', '2030-02-01', '00000000-0000-0000-0000-0000000005a1')$$,
  'HU-31: el asesor registra un proceso de licitación');
select is((select creado_por from public.procesos_licitacion), '00000000-0000-0000-0000-0000000005a1'::uuid,
  'HU-31: queda registrado quién lo creó');
select throws_ok(
  $$insert into public.procesos_licitacion (numero, entidad, objeto, fecha_cierre)
    values ('sa-mc-012-2030', 'alcaldía de valle del guamuez', 'Otro', '2030-03-01')$$,
  '23505', null, 'HU-31: un número de proceso no se repite en la misma entidad');
select lives_ok(
  $$update public.procesos_licitacion set estado = 'presentada', notas = 'Radicada en SECOP'$$,
  'HU-31: el asesor hace seguimiento (estado y notas)');
select throws_ok(
  $$update public.procesos_licitacion set estado = 'ganada'$$,
  '23514', null, 'HU-31: solo estados válidos');

select lives_ok(
  $$insert into public.items_verificacion (proceso_id, orden, requisito, documento_id, cumplido_manual) values
    ('5e5e5e5e-0000-0000-0000-000000000001', 1, 'Póliza de responsabilidad civil', '5d5d5d5d-0000-0000-0000-000000000001', false),
    ('5e5e5e5e-0000-0000-0000-000000000001', 2, 'Carta de presentación firmada', null, true)$$,
  'HU-32: requisitos con documento del repositorio o marcados a mano');
select throws_ok(
  $$insert into public.items_verificacion (proceso_id, requisito, documento_id, cumplido_manual)
    values ('5e5e5e5e-0000-0000-0000-000000000001', 'X', '5d5d5d5d-0000-0000-0000-000000000003', true)$$,
  '23514', null, 'HU-32: un requisito con documento no se marca a mano');
select throws_ok(
  $$insert into public.bitacora_descargas (proceso_id, documentos, vencidos) values ('5e5e5e5e-0000-0000-0000-000000000001', 1, 0)$$,
  '42501', null, 'HU-33: la bitácora de descargas solo la escribe la Edge Function');

delete from public.procesos_licitacion;
select is((select count(*)::int from public.procesos_licitacion), 1, 'HU-31: el asesor no elimina procesos');

-- El admin borra un documento vinculado: el requisito vuelve a quedar pendiente.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000005ad","role":"authenticated"}', true);
delete from public.documentos where id = '5d5d5d5d-0000-0000-0000-000000000001';
select is((select count(*)::int from public.items_verificacion where documento_id is null and not cumplido_manual), 1,
  'HU-32: si se borra el documento, el requisito queda pendiente (no desaparece)');
delete from public.procesos_licitacion;
select is((select count(*)::int from public.items_verificacion), 0, 'HU-31: el admin elimina el proceso con su lista');

select * from finish();
rollback;
