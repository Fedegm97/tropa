-- =============================================================================
-- Seed de desarrollo: "Río Norte Running Team"
--   · 1 superadmin, 2 coaches (owner + coach), 20 corredores, 2 turnos
--   · Sesiones de esta semana y la próxima (fechas relativas a hoy),
--     completadas con sensación y comentarios, biblioteca y avisos.
--   · Contraseña de todos los usuarios: tropa1234
--
-- Se ejecuta solo con `supabase db reset`. NO usar en producción.

-- =============================================================================

do $seed$
declare
  v_pass text := extensions.crypt('tropa1234', extensions.gen_salt('bf'));
  v_club uuid := '11111111-1111-1111-1111-111111111111';
  v_admin uuid := '00000000-0000-0000-0000-0000000000a0';
  v_owner uuid := '00000000-0000-0000-0000-0000000000a1';
  v_coach uuid := '00000000-0000-0000-0000-0000000000a2';
  v_morning uuid := '22222222-2222-2222-2222-222222222201';
  v_night uuid := '22222222-2222-2222-2222-222222222202';
  v_monday date := date_trunc('week', current_date)::date;
  v_names text[] := array[
    'Lucía Fernández','Martín Gómez','Sofía Rodríguez','Juan Pérez','Valentina López',
    'Matías Díaz','Camila Martínez','Nicolás Romero','Florencia Sosa','Federico Álvarez',
    'Agustina Torres','Tomás Ruiz','Micaela Ramírez','Santiago Flores','Julieta Acosta',
    'Facundo Benítez','Carolina Medina','Ezequiel Herrera','Paula Suárez','Gonzalo Aguirre'];
  v_paces int[] := array[285,300,330,270,345,255,315,290,360,265,325,280,350,240,310,295,375,260,335,305];
  v_comments text[] := array['Salió muy bien, las últimas costaron','Me costó arrancar pero terminé bien',
    'Hacía mucho calor','Excelente grupo hoy 🙌','Me molestó un poco el gemelo','Volando!','Las pausas se me hicieron cortas'];
  v_session uuid;
  v_ann uuid;
  i int;
  d int;
  r record;
begin
  -- ---------------------------------------------------------------- usuarios
  create temporary table seed_users (id uuid, email text, name text, role public.member_role, idx int) on commit drop;
  insert into seed_users values
    (v_admin, 'admin@tropa.test', 'Admin Tropa', null, 0),
    (v_owner, 'laura@rionorte.test', 'Laura Castro', 'owner', 0),
    (v_coach, 'diego@rionorte.test', 'Diego Molina', 'coach', 0);
  for i in 1..20 loop
    insert into seed_users values (
      ('00000000-0000-0000-0000-000000000b' || lpad(i::text, 2, '0'))::uuid,
      'corredor' || i || '@rionorte.test', v_names[i], 'runner', i);
  end loop;

  for r in select * from seed_users loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values (r.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', r.email, v_pass, now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', r.name), now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), r.id, r.id::text, jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;

  update public.profiles set is_superadmin = true where id = v_admin;
  update public.profiles set completed_at = now() where id <> v_admin;

  -- ---------------------------------------------------------------- club
  insert into public.clubs (id, slug, name, primary_color, created_by, plan_code, plan_status, plan_override, onboarding_step, invite_code)
  values (v_club, 'rionorte', 'Río Norte Running Team', '#FF5A1F', v_owner, 'team', 'active', true, 4, 'RIONORTE');

  insert into public.memberships (club_id, user_id, role) values (v_club, v_owner, 'owner'), (v_club, v_coach, 'coach');

  insert into public.shifts (id, club_id, name, days, starts_at, ends_at, location, coach_user_id) values
    (v_morning, v_club, 'Mañana', '{1,3,5}', '07:00', '08:15', 'Parque Tres de Febrero · Planetario', v_owner),
    (v_night,   v_club, 'Noche',  '{2,4}',   '19:30', '21:00', 'Costanera Norte · Club de Pescadores', v_coach);

  for r in select * from seed_users where role = 'runner' loop
    insert into public.memberships (club_id, user_id, role, shift_id, level, ref_pace_s_per_km, ref_pace_kind)
    values (v_club, r.id, 'runner',
            case when r.idx <= 11 then v_morning when r.idx <= 18 then v_night else null end,
            (case when v_paces[r.idx] < 270 then 'advanced' when v_paces[r.idx] < 320 then 'intermediate' else 'beginner' end)::public.runner_level,
            case when r.idx = 20 then null else v_paces[r.idx] end,
            case when r.idx % 4 = 0 then 'threshold' else '5k' end::public.pace_kind);
    update public.profile_private
       set phone = '+54 9 11 5' || lpad((1000000 + r.idx * 7919)::text, 7, '0'),
           birth_date = case when r.idx = 3 then (current_date - interval '29 years')::date
                             else date '1980-01-01' + (r.idx * 523 % 7000) end,
           emergency_name = 'Contacto de ' || split_part(r.name, ' ', 1),
           emergency_phone = '+54 9 11 4' || lpad((2000000 + r.idx * 104729)::text, 7, '0')
     where user_id = r.id;
  end loop;

  -- ---------------------------------------------------------------- biblioteca
  insert into public.session_templates (club_id, title, type, blocks, notes, created_by) values
    (v_club, 'Pasadas 6×1000', 'intervals',
     '[{"kind":"warmup","amount":{"unit":"s","value":900},"target":{"mode":"zone","value":"Z1"}},
       {"kind":"intervals","reps":6,"work":{"unit":"m","value":1000},"target":{"mode":"pct","value":103},"recovery":{"amount":{"unit":"s","value":90},"type":"jog"}},
       {"kind":"cooldown","amount":{"unit":"s","value":600},"target":{"mode":"zone","value":"Z1"}}]', null, v_owner),
    (v_club, 'Fondo progresivo 14 km', 'long_run',
     '[{"kind":"continuous","amount":{"unit":"m","value":8000},"target":{"mode":"zone","value":"Z2"}},
       {"kind":"continuous","amount":{"unit":"m","value":4000},"target":{"mode":"zone","value":"Z3"}},
       {"kind":"continuous","amount":{"unit":"m","value":2000},"target":{"mode":"pct","value":98}}]', 'Hidratación cada 30 minutos.', v_owner),
    (v_club, 'Fartlek 10×1''', 'fartlek',
     '[{"kind":"warmup","amount":{"unit":"s","value":900},"target":{"mode":"zone","value":"Z1"}},
       {"kind":"intervals","reps":10,"work":{"unit":"s","value":60},"target":{"mode":"zone","value":"Z5"},"recovery":{"amount":{"unit":"s","value":60},"type":"jog"}},
       {"kind":"cooldown","amount":{"unit":"s","value":600},"target":{"mode":"zone","value":"Z1"}}]', null, v_coach);

  -- ---------------------------------------------------------------- sesiones (2 semanas)
  for d in 0..13 loop
    v_session := null;
    case extract(isodow from v_monday + d)::int
      when 1 then
        insert into public.training_sessions (club_id, date, title, type, audience, blocks, created_by, published_at)
        values (v_club, v_monday + d, 'Rodaje regenerativo', 'easy_run', 'club',
          '[{"kind":"continuous","amount":{"unit":"s","value":2700},"target":{"mode":"zone","value":"Z2"}}]', v_owner, now())
        returning id into v_session;
      when 2 then
        insert into public.training_sessions (club_id, date, title, type, audience, shift_id, blocks, notes, created_by, published_at)
        values (v_club, v_monday + d, 'Pasadas 8×400', 'intervals', 'shift', v_night,
          '[{"kind":"warmup","amount":{"unit":"s","value":900},"target":{"mode":"zone","value":"Z1"}},
            {"kind":"intervals","reps":8,"work":{"unit":"m","value":400},"target":{"mode":"pct","value":108},"recovery":{"amount":{"unit":"s","value":75},"type":"jog"}},
            {"kind":"cooldown","amount":{"unit":"s","value":600},"target":{"mode":"zone","value":"Z1"}}]',
          'Nos juntamos en la entrada del club de pescadores.', v_coach, now())
        returning id into v_session;
      when 3 then
        insert into public.training_sessions (club_id, date, title, type, audience, shift_id, blocks, created_by, published_at)
        values (v_club, v_monday + d, 'Pasadas 6×1000', 'intervals', 'shift', v_morning,
          '[{"kind":"warmup","amount":{"unit":"s","value":900},"target":{"mode":"zone","value":"Z1"}},
            {"kind":"intervals","reps":6,"work":{"unit":"m","value":1000},"target":{"mode":"pct","value":103},"recovery":{"amount":{"unit":"s","value":90},"type":"jog"}},
            {"kind":"cooldown","amount":{"unit":"s","value":600},"target":{"mode":"zone","value":"Z1"}}]', v_owner, now())
        returning id into v_session;
      when 4 then
        insert into public.training_sessions (club_id, date, title, type, audience, blocks, notes, created_by, published_at)
        values (v_club, v_monday + d, 'Fuerza + core', 'strength', 'club', '[]',
          '3 vueltas: 15 sentadillas, 10 estocadas por pierna, 30" plancha, 15 puentes de glúteo, 20 elevaciones de talón.', v_coach, now())
        returning id into v_session;
      when 5 then
        insert into public.training_sessions (club_id, date, title, type, audience, blocks, created_by, published_at)
        values (v_club, v_monday + d, 'Fartlek 10×1''', 'fartlek', 'club',
          '[{"kind":"warmup","amount":{"unit":"s","value":900},"target":{"mode":"zone","value":"Z1"}},
            {"kind":"intervals","reps":10,"work":{"unit":"s","value":60},"target":{"mode":"zone","value":"Z5"},"recovery":{"amount":{"unit":"s","value":60},"type":"jog"}},
            {"kind":"cooldown","amount":{"unit":"s","value":600},"target":{"mode":"zone","value":"Z1"}}]', v_owner,
          case when d < 7 then now() else null end)  -- el de la semana próxima queda en borrador
        returning id into v_session;
      when 6 then
        insert into public.training_sessions (club_id, date, title, type, audience, blocks, notes, created_by, published_at)
        values (v_club, v_monday + d, 'Fondo progresivo 14 km', 'long_run', 'club',
          '[{"kind":"continuous","amount":{"unit":"m","value":8000},"target":{"mode":"zone","value":"Z2"}},
            {"kind":"continuous","amount":{"unit":"m","value":4000},"target":{"mode":"zone","value":"Z3"}},
            {"kind":"continuous","amount":{"unit":"m","value":2000},"target":{"mode":"pct","value":98}}]',
          'Salimos 8:00 desde el Planetario. Hidratación cada 30 minutos.', v_owner, now())
        returning id into v_session;
      else
        insert into public.training_sessions (club_id, date, title, type, audience, created_by, published_at)
        values (v_club, v_monday + d, 'Descanso', 'rest', 'club', v_owner, now())
        returning id into v_session;
    end case;

    -- Completadas para los días que ya pasaron (≈ 75 % de los corredores a los que les toca)
    if v_monday + d < current_date then
      insert into public.session_completions (club_id, session_id, user_id, feeling, comment, completed_at)
      select v_club, s.id, m.user_id,
             1 + (abs(hashtext(m.user_id::text || s.id::text)) % 5),
             case when abs(hashtext(s.id::text || m.user_id::text)) % 4 = 0
                  then v_comments[1 + abs(hashtext(m.user_id::text)) % array_length(v_comments, 1)] end,
             (s.date + time '09:30')::timestamptz
      from public.training_sessions s
      join public.memberships m on m.club_id = s.club_id and m.role = 'runner'
      where s.id = v_session and s.type <> 'rest' and s.published_at is not null
        and (s.audience = 'club' or m.shift_id = s.shift_id)
        and abs(hashtext(m.user_id::text || s.date::text)) % 4 <> 0;
    end if;
  end loop;

  -- Sesión puntual para dos corredores (vuelta de lesión)
  insert into public.training_sessions (club_id, date, title, type, audience, blocks, notes, created_by, published_at)
  values (v_club, current_date + 1, 'Vuelta progresiva', 'easy_run', 'runners',
    '[{"kind":"continuous","amount":{"unit":"s","value":1200},"target":{"mode":"zone","value":"Z1"}}]',
    'Trote muy suave. Si aparece dolor, cortamos y me avisás.', v_coach, now())
  returning id into v_session;
  insert into public.training_session_targets (club_id, session_id, user_id) values
    (v_club, v_session, '00000000-0000-0000-0000-000000000b05'),
    (v_club, v_session, '00000000-0000-0000-0000-000000000b17');

  -- ---------------------------------------------------------------- avisos
  insert into public.announcements (club_id, author_id, body, pinned_at, published_at)
  values (v_club, v_owner, E'¡Bienvenidos a la app de Río Norte! 🧡\nAcá van a encontrar el plan de cada día con sus ritmos, los avisos del club y más. Instalala en el celular y activá las notificaciones.',
          now() - interval '6 days', now() - interval '6 days')
  returning id into v_ann;
  insert into public.announcement_reactions (club_id, announcement_id, user_id, emoji)
  select v_club, v_ann, m.user_id, (array['🔥','💪','❤️','👏'])[1 + abs(hashtext(m.user_id::text)) % 4]
  from public.memberships m where m.club_id = v_club and m.role = 'runner' and abs(hashtext(m.user_id::text)) % 3 <> 0;
  insert into public.announcement_views (club_id, announcement_id, user_id)
  select v_club, v_ann, m.user_id from public.memberships m where m.club_id = v_club and m.role = 'runner';

  insert into public.announcements (club_id, author_id, body, published_at)
  values (v_club, v_owner, 'Este sábado el fondo es en Costanera Norte. Salimos 8:00 en punto desde el Club de Pescadores. ¡Traigan agua!', now() - interval '1 day')
  returning id into v_ann;
  insert into public.announcement_views (club_id, announcement_id, user_id)
  select v_club, v_ann, m.user_id from public.memberships m where m.club_id = v_club and m.role = 'runner' and abs(hashtext(m.user_id::text)) % 2 = 0;

  insert into public.announcements (club_id, author_id, body, audience, shift_id, published_at)
  values (v_club, v_coach, 'Turno Noche: el jueves entrenamos en la pista del CENARD. Lleven documento para entrar.', 'shift', v_night, now() - interval '3 hours');

  -- Las notificaciones generadas por el seed no se envían por push.
  update public.notifications set push_status = 'skipped', read_at = case when created_at < now() - interval '1 day' then now() end;
end;
$seed$;

-- =============================================================================
-- Fase 2: cuotas (estados mezclados), aptos médicos y eventos
-- =============================================================================
do $seed2$
declare
  v_club uuid := '11111111-1111-1111-1111-111111111111';
  v_owner uuid := '00000000-0000-0000-0000-0000000000a1';
  v_night uuid := '22222222-2222-2222-2222-222222222202';
  v_period date := date_trunc('month', current_date)::date;
  v_prev date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_uid uuid;
  v_event uuid;
  i int;
begin
  update public.clubs set settings = '{"fee_reminder_day": 10, "birthday_greeting": true}' where id = v_club;

  -- Reglas: $25.000 general, $22.000 turno Noche, corredor 9 becado
  insert into public.fee_rules (club_id, shift_id, user_id, amount_cents, valid_from, created_by) values
    (v_club, null, null, 2200000, (v_period - interval '6 months')::date, v_owner),
    (v_club, null, null, 2500000, v_prev, v_owner),
    (v_club, v_night, null, 2200000, v_prev, v_owner),
    (v_club, null, '00000000-0000-0000-0000-000000000b09', 0, v_prev, v_owner);

  for i in 1..20 loop
    v_uid := ('00000000-0000-0000-0000-000000000b' || lpad(i::text, 2, '0'))::uuid;
    -- Mes anterior: todos al día menos el 17
    if i not in (9, 17) then
      insert into public.fee_payments (club_id, user_id, period, amount_cents, method, status, reviewed_by, reviewed_at, created_at)
      values (v_club, v_uid, v_prev, public.fee_amount_due(v_club, v_uid, v_prev),
              (array['transfer','cash','mercadopago'])[1 + i % 3]::public.payment_method, 'confirmed', v_owner,
              v_prev + interval '8 days', v_prev + interval '7 days');
    end if;
    -- Mes actual: 1–12 confirmados, 13–15 pendientes, 16 rechazado, 19 pago parcial, 17/18/20 deben
    if i <= 12 and i <> 9 then
      insert into public.fee_payments (club_id, user_id, period, amount_cents, method, status, reviewed_by, reviewed_at, created_at)
      values (v_club, v_uid, v_period, public.fee_amount_due(v_club, v_uid, v_period),
              (array['transfer','cash','mercadopago'])[1 + i % 3]::public.payment_method, 'confirmed', v_owner, now() - interval '1 day', now() - interval '2 days');
    elsif i between 13 and 15 then
      insert into public.fee_payments (club_id, user_id, period, amount_cents, method, status, note, created_at)
      values (v_club, v_uid, v_period, public.fee_amount_due(v_club, v_uid, v_period), 'transfer', 'pending',
              case when i = 13 then 'Transferí desde la cuenta de mi pareja' end, now() - interval '5 hours');
    elsif i = 16 then
      insert into public.fee_payments (club_id, user_id, period, amount_cents, method, status, reviewed_by, reviewed_at, reject_reason)
      values (v_club, v_uid, v_period, 1500000, 'transfer', 'rejected', v_owner, now() - interval '1 day', 'El comprobante no corresponde a este mes');
    elsif i = 19 then
      insert into public.fee_payments (club_id, user_id, period, amount_cents, method, status, reviewed_by, reviewed_at)
      values (v_club, v_uid, v_period, 1000000, 'cash', 'confirmed', v_owner, now() - interval '1 day');
    end if;

    -- Aptos: 1–10 vigentes, 11–13 por vencer, 14–15 vencidos, 16–20 sin cargar
    if i <= 15 then
      insert into public.medical_certificates (club_id, user_id, file_path, expires_on, uploaded_at)
      values (v_club, v_uid, v_club || '/medical/' || v_uid || '/seed.pdf',
              current_date + case when i <= 10 then 120 + i * 15 when i = 11 then 5 when i = 12 then 12 when i = 13 then 25
                                  when i = 14 then -10 else -40 end,
              now() - interval '30 days');
    end if;
  end loop;

  -- Eventos
  insert into public.events (club_id, name, kind, starts_at, location, distances, registration_url, price_cents, notes, created_by)
  values (v_club, '10K Río Norte', 'road', (current_date + 10 + time '08:00') at time zone 'America/Argentina/Buenos_Aires',
          'Bosques de Palermo', '{5K,10K}', 'https://example.com/inscripcion-10k', 1800000,
          'Nos encontramos 7:15 en la carpa del club para la foto grupal.', v_owner)
  returning id into v_event;
  insert into public.event_registrations (club_id, event_id, user_id, distance)
  select v_club, v_event, m.user_id, case when abs(hashtext(m.user_id::text)) % 3 = 0 then '5K' else '10K' end
  from public.memberships m where m.club_id = v_club and m.role = 'runner' and abs(hashtext(m.user_id::text || 'e1')) % 3 <> 0;

  insert into public.events (club_id, name, kind, starts_at, location, distances, registration_url, price_cents, notes, created_by)
  values (v_club, 'Viaje: Trail de Tandil', 'trip', (current_date + 24 + time '07:30') at time zone 'America/Argentina/Buenos_Aires',
          'Tandil, Buenos Aires', '{12K,25K}', 'https://example.com/trail-tandil', 4500000,
          'Salimos el viernes a la tarde en combi. Cupos limitados.', v_owner)
  returning id into v_event;
  insert into public.event_registrations (club_id, event_id, user_id, distance)
  select v_club, v_event, m.user_id, case when abs(hashtext(m.user_id::text)) % 2 = 0 then '12K' else '25K' end
  from public.memberships m where m.club_id = v_club and m.role = 'runner' and abs(hashtext(m.user_id::text || 'e2')) % 3 = 0;

  insert into public.events (club_id, name, kind, starts_at, location, notes, created_by)
  values (v_club, 'Salida especial: Costanera al amanecer', 'social', (current_date + 1 + time '06:30') at time zone 'America/Argentina/Buenos_Aires',
          'Costanera Norte · Club de Pescadores', 'Rodaje suave de 8 km y desayuno en el club.', '00000000-0000-0000-0000-0000000000a2')
  returning id into v_event;
  insert into public.event_registrations (club_id, event_id, user_id)
  select v_club, v_event, m.user_id from public.memberships m where m.club_id = v_club and m.role = 'runner' and abs(hashtext(m.user_id::text || 'e3')) % 2 = 0;

  insert into public.events (club_id, name, kind, starts_at, location, distances, created_by)
  values (v_club, 'Media Maratón de Buenos Aires', 'road', (current_date - 40 + time '07:00') at time zone 'America/Argentina/Buenos_Aires',
          'Av. de Mayo y 9 de Julio', '{21K}', v_owner)
  returning id into v_event;
  insert into public.event_registrations (club_id, event_id, user_id, distance)
  select v_club, v_event, m.user_id, '21K' from public.memberships m where m.club_id = v_club and m.role = 'runner' and abs(hashtext(m.user_id::text)) % 2 = 1;

  update public.notifications set push_status = 'skipped', read_at = now() where push_status = 'pending';
end;
$seed2$;

-- =============================================================================
-- Fase 3: tienda con stock y pedidos en distintos estados, reloj de prueba
-- =============================================================================
do $seed3$
declare
  v_club uuid := '11111111-1111-1111-1111-111111111111';
  v_p uuid;
  v_remera_m uuid;
  v_buzo_l uuid;
  v_gorra uuid;
  v_order uuid;
  i int;
begin
  insert into public.products (club_id, name, description, price_cents, sort)
  values (v_club, 'Remera técnica Río Norte', 'Tela dry-fit liviana, con el logo del club adelante y "RÍO NORTE" en la espalda.', 1800000, 1)
  returning id into v_p;
  insert into public.product_variants (club_id, product_id, size, stock, sort) values
    (v_club, v_p, 'S', 4, 1), (v_club, v_p, 'M', 6, 2), (v_club, v_p, 'L', 3, 3), (v_club, v_p, 'XL', 0, 4);
  select id into v_remera_m from public.product_variants where product_id = v_p and size = 'M';

  insert into public.products (club_id, name, description, price_cents, sort)
  values (v_club, 'Buzo frisa del club', 'Ideal para la previa de las carreras de invierno.', 3500000, 2)
  returning id into v_p;
  insert into public.product_variants (club_id, product_id, size, stock, sort) values
    (v_club, v_p, 'M', 2, 1), (v_club, v_p, 'L', 5, 2), (v_club, v_p, 'XL', 1, 3);
  select id into v_buzo_l from public.product_variants where product_id = v_p and size = 'L';

  insert into public.products (club_id, name, price_cents, sort) values (v_club, 'Gorra running', 1200000, 3) returning id into v_p;
  insert into public.product_variants (club_id, product_id, size, stock) values (v_club, v_p, null, 12) returning id into v_gorra;

  insert into public.products (club_id, name, price_cents, sort, active) values (v_club, 'Medias edición 10K (próximamente)', 600000, 4, false) returning id into v_p;
  insert into public.product_variants (club_id, product_id, size, stock) values (v_club, v_p, null, 0);

  -- Pedidos: 2 pendientes de pago, 2 pagados, 3 entregados
  for i in 1..7 loop
    insert into public.orders (club_id, number, user_id, status, total_cents, created_at)
    values (v_club, i, ('00000000-0000-0000-0000-000000000b' || lpad((i * 2)::text, 2, '0'))::uuid,
            (case when i <= 3 then 'delivered' when i <= 5 then 'paid' else 'pending_payment' end)::public.order_status,
            0, now() - ((8 - i) || ' days')::interval)
    returning id into v_order;
    insert into public.order_items (club_id, order_id, variant_id, product_name, size, quantity, unit_price_cents)
    values (v_club, v_order,
            case i % 3 when 0 then v_gorra when 1 then v_remera_m else v_buzo_l end,
            case i % 3 when 0 then 'Gorra running' when 1 then 'Remera técnica Río Norte' else 'Buzo frisa del club' end,
            case i % 3 when 0 then null when 1 then 'M' else 'L' end,
            1 + i % 2,
            case i % 3 when 0 then 1200000 when 1 then 1800000 else 3500000 end);
    update public.orders o set total_cents = (select sum(quantity * unit_price_cents) from public.order_items where order_id = o.id) where o.id = v_order;
  end loop;
  insert into public.club_counters (club_id, key, value) values (v_club, 'order', 91)
  on conflict (club_id, key) do update set value = 91; -- el próximo pedido es el #92

  -- Reloj de prueba conectado para corredor1 (solo desarrollo)
  insert into public.watch_connections (user_id, provider, external_user_id, access_token)
  values ('00000000-0000-0000-0000-000000000b01', 'fake', 'fake-user', 'fake-access');
end;
$seed3$;
