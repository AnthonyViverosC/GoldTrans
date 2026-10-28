-- Sprint 4 · Reservas, abonos, liberación de cupos y repositorio documental con RLS por rol
-- Ejecutar con: npx supabase test db   (requiere `npx supabase start`)
begin;
create extension if not exists pgtap with schema extensions;
select plan(60);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000004c1', 'cliente1@s4.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","nombre_completo":"Cliente Uno"}'),
  ('00000000-0000-0000-0000-0000000004c2', 'cliente2@s4.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","nombre_completo":"Cliente Dos"}'),
  ('00000000-0000-0000-0000-0000000004a5', 'asesor@s4.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","nombre_completo":"Asesor"}'),
  ('00000000-0000-0000-0000-0000000004ad', 'admin@s4.co', '{"autoriza_datos":true,"version_aviso_privacidad":"test","nombre_completo":"Admin"}');
update public.usuarios set rol = 'asesor' where email = 'asesor@s4.co';
update public.usuarios set rol = 'admin' where email = 'admin@s4.co';

-- Paquete publicado (activo y con foto) a 500.000 por persona.
insert into public.paquetes (id, nombre, destino, duracion_dias, precio_por_persona, activo) values
  ('4b4b4b4b-0000-0000-0000-000000000001', 'Ruta del Putumayo', 'Mocoa', 2, 500000, true);
insert into public.imagenes_paquete (paquete_id, ruta) values ('4b4b4b4b-0000-0000-0000-000000000001', 'test/s4.jpg');
insert into public.fechas_salida (id, paquete_id, fecha_salida, fecha_regreso, cupos_totales, estado) values
  ('4a4a4a4a-0000-0000-0000-000000000001', '4b4b4b4b-0000-0000-0000-000000000001', '2099-03-01', '2099-03-02', 3, 'abierta'),
  ('4a4a4a4a-0000-0000-0000-000000000002', '4b4b4b4b-0000-0000-0000-000000000001', '2099-04-01', '2099-04-02', 10, 'cerrada'),
  ('4a4a4a4a-0000-0000-0000-000000000003', '4b4b4b4b-0000-0000-0000-000000000001', '2099-05-01', '2099-05-02', 10, 'abierta');

select is((select public from storage.buckets where id = 'comprobantes'), false, 'RNF-06: el bucket de comprobantes es privado');
select is((select public from storage.buckets where id = 'documentos'), false, 'RNF-06: el bucket de documentos es privado');

-- ═══ HU-22 · Reserva del cliente 1 ════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004c1","role":"authenticated"}', true);

select lives_ok(
  $$select public.crear_reserva('4a4a4a4a-0000-0000-0000-000000000001',
    '[{"nombre_completo":"Ana","tipo_documento":"CC","numero_documento":"1001","fecha_nacimiento":"1990-01-01"},
      {"nombre_completo":"Luis","tipo_documento":"TI","numero_documento":"1002","fecha_nacimiento":"2012-06-01"}]',
    '3101234567')$$,
  'HU-22: el cliente reserva con los datos de sus viajeros');
select results_eq(
  $$select estado, cupos, valor_total, abono_minimo, saldo, fecha_limite_pago from public.reservas$$,
  $$values ('prerreserva'::text, 2, 1000000, 300000, 1000000, '2099-02-21'::date)$$,
  'HU-22/25: prerreserva con total, abono mínimo del 30 % y saldo hasta 8 días antes');
select ok((select vence_at <= now() + interval '48 hours' and vence_at > now() from public.reservas),
  'HU-26: la prerreserva aparta los cupos por 48 horas');
select is((select count(*)::int from public.viajeros), 2, 'HU-22: guarda un registro por viajero');
select is((select cupos_disponibles from public.fechas_salida where id = '4a4a4a4a-0000-0000-0000-000000000001'),
  1, 'HU-22: la reserva descuenta los cupos de la fecha');
select throws_ok(
  $$select public.crear_reserva('4a4a4a4a-0000-0000-0000-000000000001',
    '[{"nombre_completo":"A","tipo_documento":"CC","numero_documento":"2001","fecha_nacimiento":"1990-01-01"},
      {"nombre_completo":"B","tipo_documento":"CC","numero_documento":"2002","fecha_nacimiento":"1990-01-01"}]',
    '3101234567')$$,
  '55000', null, 'no se reservan más cupos de los disponibles');
select throws_ok(
  $$select public.crear_reserva('4a4a4a4a-0000-0000-0000-000000000002',
    '[{"nombre_completo":"A","tipo_documento":"CC","numero_documento":"2001","fecha_nacimiento":"1990-01-01"}]',
    '3101234567')$$,
  '55000', null, 'una salida cerrada no admite reservas');
select throws_ok(
  $$select public.crear_reserva('4a4a4a4a-0000-0000-0000-000000000003',
    '[{"nombre_completo":"A","tipo_documento":"CC","numero_documento":"2001","fecha_nacimiento":"1990-01-01"},
      {"nombre_completo":"B","tipo_documento":"CC","numero_documento":"2001","fecha_nacimiento":"1991-01-01"}]',
    '3101234567')$$,
  '23505', null, 'un documento no se repite en la misma reserva');
select throws_ok(
  $$update public.reservas set estado = 'pagada'$$,
  '42501', null, 'el cliente no cambia el estado de la reserva directamente');

-- ═══ HU-23 · Abonos ═══════════════════════════════════════════
select throws_ok(
  $$select public.registrar_abono((select id from public.reservas), 100000, '2000-01-01', 'x/y/z.jpg')$$,
  '22023', null, 'HU-23: el primer abono debe cubrir el mínimo');
select throws_ok(
  $$select public.registrar_abono((select id from public.reservas), 300000, '2000-01-01',
    '00000000-0000-0000-0000-0000000004c2/' || (select id from public.reservas) || '/c.jpg')$$,
  '42501', null, 'RNF-06: el comprobante debe estar en la carpeta del cliente');
select throws_ok(
  $$select public.registrar_abono((select id from public.reservas), 300000, '2000-01-01',
    '00000000-0000-0000-0000-0000000004c1/' || (select id from public.reservas) || '/no-subido.jpg')$$,
  'P0002', null, 'RNF-06: el comprobante debe existir en Storage');

-- Storage: el cliente sube comprobantes solo a la carpeta de su reserva.
select lives_ok(
  $$insert into storage.objects (bucket_id, name, metadata)
    select 'comprobantes', '00000000-0000-0000-0000-0000000004c1/' || id || '/c.jpg', '{"mimetype":"image/jpeg","size":1000}'
      from public.reservas$$,
  'RNF-06: el cliente sube el comprobante a su reserva');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, metadata)
    select 'comprobantes', '00000000-0000-0000-0000-0000000004c1/' || id || '/saldo.pdf', '{"mimetype":"application/pdf","size":2000}'
      from public.reservas$$,
  'RNF-06: también acepta PDF');
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    select 'comprobantes', '00000000-0000-0000-0000-0000000004c2/' || id || '/x.jpg' from public.reservas$$,
  '42501', null, 'RNF-06: no sube archivos a la carpeta de otro usuario');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('documentos', 'x/rut.pdf')$$,
  '42501', null, 'RNF-06: el cliente no sube al repositorio documental');

select lives_ok(
  $$select public.registrar_abono((select id from public.reservas), 300000, '2000-01-01',
    '00000000-0000-0000-0000-0000000004c1/' || (select id from public.reservas) || '/c.jpg', 'REF-77')$$,
  'HU-23: registra el abono con su comprobante');
select results_eq(
  $$select estado, comprobante_tipo from public.abonos$$,
  $$values ('pendiente'::text, 'image/jpeg'::text)$$,
  'HU-23: el abono queda en revisión y el tipo se toma de Storage');
select throws_ok(
  $$select public.verificar_abono((select id from public.abonos), 'aprobar')$$,
  '42501', null, 'el cliente no aprueba sus propios abonos');

-- ═══ Aislamiento: cliente 2 ═══════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004c2","role":"authenticated"}', true);
select is((select count(*)::int from public.reservas), 0, 'otro cliente no ve reservas ajenas');
select is((select count(*)::int from public.abonos), 0, 'otro cliente no ve abonos ajenos');
select is((select count(*)::int from public.viajeros), 0, 'otro cliente no ve viajeros ajenos');
select is((select count(*)::int from storage.objects where bucket_id = 'comprobantes'), 0,
  'RNF-06: otro cliente no ve comprobantes ajenos');
select throws_ok(
  $$select public.cancelar_reserva((select id from public.reservas where usuario_id = '00000000-0000-0000-0000-0000000004c1'))$$,
  'P0002', null, 'otro cliente no cancela reservas ajenas');

-- ═══ HU-24 · Verificación del asesor ══════════════════════════
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004a5","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'comprobantes'), 2,
  'HU-24: el asesor ve los comprobantes antes de aprobar');
select throws_ok(
  $$select public.verificar_abono((select id from public.abonos), 'rechazar', '  ')$$,
  '22023', null, 'HU-24: rechazar exige motivo');
select lives_ok(
  $$select public.verificar_abono((select id from public.abonos), 'aprobar')$$,
  'HU-24: el asesor aprueba el abono');
select results_eq(
  $$select estado, valor_abonado, saldo from public.reservas$$,
  $$values ('confirmada'::text, 300000, 700000)$$,
  'HU-24/25: el abono mínimo confirma la reserva y descuenta el saldo');
select results_eq(
  $$select estado, asesor_id from public.abonos$$,
  $$values ('aprobado'::text, '00000000-0000-0000-0000-0000000004a5'::uuid)$$,
  'HU-24: registra quién aprobó');
select throws_ok(
  $$select public.verificar_abono((select id from public.abonos), 'rechazar', 'otra vez')$$,
  '55000', null, 'un abono se verifica una sola vez');

-- ═══ HU-25 · Pago del saldo ═══════════════════════════════════
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004c1","role":"authenticated"}', true);
select throws_ok(
  $$select public.cancelar_reserva((select id from public.reservas))$$,
  '55000', null, 'el cliente no cancela una reserva con abonos aprobados');
select throws_ok(
  $$select public.registrar_abono((select id from public.reservas), 700001, '2000-01-01',
    '00000000-0000-0000-0000-0000000004c1/' || (select id from public.reservas) || '/saldo.pdf')$$,
  '22023', null, 'HU-25: el abono no puede superar el saldo');
select lives_ok(
  $$select public.registrar_abono((select id from public.reservas), 700000, '2000-01-01',
    '00000000-0000-0000-0000-0000000004c1/' || (select id from public.reservas) || '/saldo.pdf')$$,
  'HU-25: el cliente paga el saldo');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004a5","role":"authenticated"}', true);
select lives_ok(
  $$select public.verificar_abono((select id from public.abonos where valor = 700000), 'aprobar')$$,
  'HU-25: el asesor aprueba el saldo');
select results_eq(
  $$select estado, saldo from public.reservas$$,
  $$values ('pagada'::text, 0)$$,
  'HU-25: con el saldo en cero la reserva queda pagada');

-- ═══ HU-26 · Prerreservas vencidas y cancelación ══════════════
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004c2","role":"authenticated"}', true);
select lives_ok(
  $$select public.crear_reserva('4a4a4a4a-0000-0000-0000-000000000003',
    '[{"nombre_completo":"Sin abono","tipo_documento":"CC","numero_documento":"3001","fecha_nacimiento":"1990-01-01"}]',
    '3109876543')$$,
  'cliente 2: prerreserva sin abono');
select lives_ok(
  $$select public.crear_reserva('4a4a4a4a-0000-0000-0000-000000000003',
    '[{"nombre_completo":"Con abono","tipo_documento":"CC","numero_documento":"3002","fecha_nacimiento":"1990-01-01"}]',
    '3109876543')$$,
  'cliente 2: prerreserva que tendrá un abono en revisión');

reset role;
insert into storage.objects (bucket_id, name, metadata)
select 'comprobantes', '00000000-0000-0000-0000-0000000004c2/' || reserva_id || '/c.png', '{"mimetype":"image/png","size":500}'
  from public.viajeros where numero_documento = '3002';

set local role authenticated;
select lives_ok(
  $$select public.registrar_abono((select reserva_id from public.viajeros where numero_documento = '3002'), 150000,
    '2000-01-01', '00000000-0000-0000-0000-0000000004c2/' || (select reserva_id from public.viajeros where numero_documento = '3002') || '/c.png')$$,
  'cliente 2: registra el abono de la segunda prerreserva');

-- Simula que pasaron las 48 horas.
reset role;
update public.reservas set vence_at = now() - interval '1 minute'
 where usuario_id = '00000000-0000-0000-0000-0000000004c2';

set local role authenticated;
select throws_ok(
  $$select public.registrar_abono((select reserva_id from public.viajeros where numero_documento = '3001'), 150000,
    '2000-01-01', 'x/y/z.jpg')$$,
  '55000', null, 'HU-26: una prerreserva vencida no admite abonos');
select throws_ok(
  $$select * from public.vencer_prerreservas()$$,
  '42501', null, 'HU-26: la app no ejecuta la liberación de cupos (solo la Edge Function)');

set local role service_role;
select results_eq(
  $$select * from public.vencer_prerreservas('4a4a4a4a-0000-0000-0000-000000000003')$$,
  $$values (1, 1)$$,
  'HU-26: vence la prerreserva sin abono y devuelve su cupo');

reset role;
select is(
  (select estado from public.reservas r join public.viajeros v on v.reserva_id = r.id where v.numero_documento = '3001'),
  'vencida', 'HU-26: la prerreserva sin abono queda vencida');
select is(
  (select estado from public.reservas r join public.viajeros v on v.reserva_id = r.id where v.numero_documento = '3002'),
  'prerreserva', 'HU-26: con un abono en revisión no vence');
select is((select cupos_reservados from public.fechas_salida where id = '4a4a4a4a-0000-0000-0000-000000000003'),
  1, 'HU-26: la fecha recupera el cupo vencido');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004a5","role":"authenticated"}', true);
select throws_ok(
  $$select public.cancelar_reserva((select reserva_id from public.viajeros where numero_documento = '3002'))$$,
  '22023', null, 'HU-26: el asesor cancela solo con motivo');
select lives_ok(
  $$select public.cancelar_reserva((select reserva_id from public.viajeros where numero_documento = '3002'), 'El cliente desistió')$$,
  'HU-26: el asesor cancela la reserva');
select results_eq(
  $$select r.estado, a.estado from public.reservas r join public.abonos a on a.reserva_id = r.id
     where r.id = (select reserva_id from public.viajeros where numero_documento = '3002')$$,
  $$values ('cancelada'::text, 'rechazado'::text)$$,
  'HU-26: la reserva queda cancelada y su abono en revisión se rechaza');
select is((select cupos_reservados from public.fechas_salida where id = '4a4a4a4a-0000-0000-0000-000000000003'),
  0, 'HU-26: cancelar devuelve los cupos');

-- ═══ HU-27 · Repositorio documental ═══════════════════════════
select lives_ok(
  $$insert into storage.objects (bucket_id, name, metadata) values
    ('documentos', 'legales/rut-v1.pdf', '{"mimetype":"application/pdf","size":120000}'),
    ('documentos', 'legales/rut-v2.pdf', '{"mimetype":"application/pdf","size":130000}')$$,
  'HU-27: el asesor sube archivos al repositorio');
select lives_ok(
  $$select public.crear_documento((select id from public.categorias_doc where nombre = 'Legales'), 'RUT',
    'legales/rut-v1.pdf', 'rut.pdf')$$,
  'HU-27: el asesor carga un documento en una categoría');
select throws_ok(
  $$select public.crear_documento((select id from public.categorias_doc where nombre = 'Legales'), 'Otro',
    'legales/no-existe.pdf', 'x.pdf')$$,
  'P0002', null, 'HU-27: el archivo debe existir en Storage');
select lives_ok(
  $$select public.agregar_version_documento((select id from public.documentos where nombre = 'RUT'),
    'legales/rut-v2.pdf', 'rut-2026.pdf', 'Actualizado')$$,
  'HU-27: sube una versión nueva');
select results_eq(
  $$select v.version, v.tamano_bytes, d.version_actual from public.versiones_doc v
      join public.documentos d on d.id = v.documento_id order by v.version$$,
  $$values (1, 120000::bigint, 2), (2, 130000::bigint, 2)$$,
  'HU-27: conserva el historial de versiones con el tamaño real del archivo');
select throws_ok(
  $$insert into public.categorias_doc (nombre) values ('Nueva')$$,
  '42501', null, 'HU-27: solo el admin crea categorías');

delete from public.documentos;
select is((select count(*)::int from public.documentos), 1, 'HU-27: el asesor no elimina documentos');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004c1","role":"authenticated"}', true);
select is((select count(*)::int from public.documentos) + (select count(*)::int from public.versiones_doc)
  + (select count(*)::int from public.categorias_doc), 0, 'HU-27: el cliente no ve el repositorio documental');
select throws_ok(
  $$select public.crear_documento((select id from public.categorias_doc limit 1), 'X', 'legales/rut-v1.pdf', 'x.pdf')$$,
  '42501', null, 'HU-27: el cliente no carga documentos');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004ad","role":"authenticated"}', true);
delete from public.documentos where nombre = 'RUT';
select is((select count(*)::int from public.versiones_doc), 0, 'HU-27: el admin elimina el documento con sus versiones');

select * from finish();
rollback;
