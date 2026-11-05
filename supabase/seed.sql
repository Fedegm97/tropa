-- =============================================================================
-- Seed de desarrollo: "Río Norte Running Team"
--   · 1 superadmin, 2 coaches (owner + coach), 20 corredores, 2 turnos
--   · Sesiones de esta semana y la próxima (fechas relativas a hoy),
--     completadas con sensación y comentarios, biblioteca y avisos.
--   · Contraseña de todos los usuarios: tropa1234
--
-- Se ejecuta solo con `supabase db reset`. NO usar en producción.
-- (Cuotas, eventos y productos se suman al seed en las fases 2 y 3, junto con sus tablas.)
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
