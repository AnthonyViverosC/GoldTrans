-- Sprint 3 · Solicitudes (flujo de estados) y Goldtours (catálogo, cupos) con RLS por rol
-- Ejecutar con: npx supabase test db   (requiere `npx supabase start`)
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000003c1', 'cliente1@s3.co', '{"nombre_completo":"Cliente Uno"}'),
  ('00000000-0000-0000-0000-0000000003c2', 'cliente2@s3.co', '{"nombre_completo":"Cliente Dos"}'),
  ('00000000-0000-0000-0000-0000000003a5', 'asesor@s3.co', '{"nombre_completo":"Asesor"}'),
  ('00000000-0000-0000-0000-0000000003ad', 'admin@s3.co', '{"nombre_completo":"Admin"}');
update public.usuarios set rol = 'asesor' where email = 'asesor@s3.co';
update public.usuarios set rol = 'admin' where email = 'admin@s3.co';

insert into public.rutas (id, origen, destino, distancia_km) values
  ('cccccccc-0000-0000-0000-000000000001', 'S3 Origen', 'S3 Destino', 10);
insert into public.tarifas (id, tipo_vehiculo, tarifa_base, valor_km, valor_dia, vigencia_desde) values
  ('dddddddd-0000-0000-0000-000000000001', 'camioneta', 1, 1, 1, '2000-01-01');
insert into public.cotizaciones (id, usuario_id, ruta_id, origen, destino, tarifa_id, tipo_servicio,
    fecha_inicio, fecha_fin, dias, pasajeros, tipo_vehiculo, capacidad_vehiculo, distancia_km, valor_total)
select v.id::uuid, v.usuario::uuid, 'cccccccc-0000-0000-0000-000000000001', 'S3 Origen', 'S3 Destino',
       'dddddddd-0000-0000-0000-000000000001', 'ida', v.fecha::date, v.fecha::date, 1, 3, 'camioneta', 6, 10, 800000
from (values
  ('eeeeeeee-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000003c1', '2099-01-01'),
  ('eeeeeeee-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000003c1', '2000-01-01'),
  ('eeeeeeee-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000003c2', '2099-01-01')
) as v(id, usuario, fecha);

-- ─── Solicitudes: cliente 1 ───────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003c1","role":"authenticated"}', true);

select lives_ok(
  $$select public.crear_solicitud('eeeeeeee-0000-0000-0000-000000000001', 'Ana', '3101234567', 'Parque', '06:30')$$,
  'HU-16: el cliente convierte su cotización en solicitud');
select results_eq(
  $$select estado, valor_cotizado from public.solicitudes$$,
  $$values ('pendiente'::text, 800000)$$,
  'HU-16: queda pendiente con el valor de la cotización');
select throws_ok(
  $$select public.crear_solicitud('eeeeeeee-0000-0000-0000-000000000001', 'Ana', '3101234567', 'Parque', '06:30')$$,
  '23505', null, 'una cotización se formaliza una sola vez');
select throws_ok(
  $$select public.crear_solicitud('eeeeeeee-0000-0000-0000-000000000003', 'Ana', '3101234567', 'Parque', '06:30')$$,
  'P0002', null, 'no se puede formalizar la cotización de otro cliente');
select throws_ok(
  $$select public.crear_solicitud('eeeeeeee-0000-0000-0000-000000000002', 'Ana', '3101234567', 'Parque', '06:30')$$,
  '22023', null, 'no se formaliza una cotización con fecha pasada');
select throws_ok(
  $$select public.responder_solicitud((select id from public.solicitudes limit 1), 'confirmar')$$,
  '42501', null, 'el cliente no puede responder solicitudes');
select throws_ok(
  $$update public.solicitudes set estado = 'confirmada'$$,
  '42501', null, 'el cliente no cambia el estado directamente');
select is((select count(*)::int from public.solicitudes), 1, 'cliente: ve su solicitud');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003c2","role":"authenticated"}', true);
select is((select count(*)::int from public.solicitudes), 0, 'otro cliente no ve solicitudes ajenas');

-- ─── Solicitudes: asesor ──────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003a5","role":"authenticated"}', true);
select throws_ok(
  $$select public.crear_solicitud('eeeeeeee-0000-0000-0000-000000000003', 'X', '3101234567', 'Y', '06:30')$$,
  '42501', null, 'el asesor no crea solicitudes');
select throws_ok(
  $$select public.responder_solicitud((select id from public.solicitudes limit 1), 'rechazar', null, '  ')$$,
  '22023', null, 'HU-17: rechazar exige motivo');
select lives_ok(
  $$select public.responder_solicitud((select id from public.solicitudes limit 1), 'ajustar', 900000, 'Peaje adicional')$$,
  'HU-17: el asesor ajusta el valor con motivo');
select results_eq(
  $$select estado, valor_final, motivo, asesor_id from public.solicitudes$$,
  $$values ('ajustada'::text, 900000, 'Peaje adicional'::text, '00000000-0000-0000-0000-0000000003a5'::uuid)$$,
  'HU-17: queda ajustada, con el nuevo valor y quién respondió');
select throws_ok(
  $$select public.responder_solicitud((select id from public.solicitudes limit 1), 'confirmar')$$,
  '55000', null, 'una solicitud se responde una sola vez');

-- ─── Solicitudes: el cliente acepta el ajuste ─────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003c1","role":"authenticated"}', true);
select lives_ok(
  $$select public.decidir_solicitud((select id from public.solicitudes limit 1), 'aceptar')$$,
  'el cliente acepta el valor ajustado');
select is((select estado from public.solicitudes), 'confirmada', 'aceptar el ajuste confirma la solicitud');
select throws_ok(
  $$select public.decidir_solicitud((select id from public.solicitudes limit 1), 'cancelar')$$,
  '55000', null, 'una solicitud confirmada ya no se cancela desde la app');

-- ─── Goldtours: datos base ────────────────────────────────────
reset role;
insert into public.paquetes (id, nombre, destino, duracion_dias, precio_por_persona, activo) values
  ('ffffffff-0000-0000-0000-000000000001', 'Publicado', 'Mocoa', 2, 300000, true),
  ('ffffffff-0000-0000-0000-000000000002', 'Activo sin foto', 'Mocoa', 1, 100000, true),
  ('ffffffff-0000-0000-0000-000000000003', 'Inactivo con foto', 'Pasto', 3, 500000, false);
insert into public.imagenes_paquete (paquete_id, ruta) values
  ('ffffffff-0000-0000-0000-000000000001', 'test/uno.jpg'),
  ('ffffffff-0000-0000-0000-000000000003', 'test/tres.jpg');
insert into public.fechas_salida (id, paquete_id, fecha_salida, fecha_regreso, cupos_totales) values
  ('abababab-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', '2099-01-01', '2099-01-02', 10),
  ('abababab-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000003', '2099-01-01', '2099-01-03', 10);

select throws_ok(
  $$update public.fechas_salida set cupos_reservados = 11 where id = 'abababab-0000-0000-0000-000000000001'$$,
  '23514', null, 'HU-20: no se pueden reservar más cupos de los que hay');
select lives_ok(
  $$update public.fechas_salida set cupos_reservados = 10 where id = 'abababab-0000-0000-0000-000000000001'$$,
  'HU-20: se pueden reservar todos los cupos');
select is(
  (select cupos_disponibles from public.fechas_salida where id = 'abababab-0000-0000-0000-000000000001'),
  0, 'HU-20: la fecha queda agotada (0 disponibles)');
select throws_ok(
  $$insert into public.fechas_salida (paquete_id, fecha_salida, fecha_regreso, cupos_totales)
    values ('ffffffff-0000-0000-0000-000000000001', '2099-02-10', '2099-02-09', 5)$$,
  '23514', null, 'HU-20: el regreso no puede ser antes de la salida');
select is((select public from storage.buckets where id = 'paquetes'), true, 'bucket público de fotos de paquetes');

-- ─── Goldtours: visitante ─────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '', true);
select results_eq($$select nombre from public.paquetes$$, $$values ('Publicado'::text)$$,
  'HU-18: el catálogo muestra solo paquetes activos con foto');
select is((select count(*)::int from public.fechas_salida), 1, 'HU-19: el visitante ve solo las fechas de paquetes publicados');
select throws_ok($$insert into public.paquetes (nombre, destino, duracion_dias, precio_por_persona) values ('x', 'y', 1, 1)$$,
  '42501', null, 'visitante: no crea paquetes');

-- ─── Goldtours: asesor y admin ────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003a5","role":"authenticated"}', true);
select is((select count(*)::int from public.paquetes where nombre in ('Publicado', 'Activo sin foto', 'Inactivo con foto')),
  3, 'asesor: ve todos los paquetes');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000003ad","role":"authenticated"}', true);
select lives_ok(
  $$insert into public.paquetes (nombre, destino, duracion_dias, precio_por_persona) values ('Nuevo', 'Orito', 1, 90000)$$,
  'HU-21: el admin crea paquetes');
select throws_ok(
  $$update public.fechas_salida set cupos_reservados = 0 where id = 'abababab-0000-0000-0000-000000000001'$$,
  '42501', null, 'ni el admin edita los cupos reservados a mano (los mueven las reservas)');

select * from finish();
rollback;
