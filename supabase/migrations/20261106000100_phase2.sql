-- =============================================================================
-- Tropa · 0007 · Fase 2: cuotas, apto médico, eventos, cumpleaños y recordatorios
-- =============================================================================

create type public.payment_method as enum ('transfer', 'cash', 'mercadopago', 'other');
create type public.payment_status as enum ('pending', 'confirmed', 'rejected');
create type public.event_kind as enum ('road', 'trail', 'track', 'social', 'trip');

-- ---------------------------------------------------------------------------
-- Hoy en la zona horaria del club
-- ---------------------------------------------------------------------------
create or replace function public.club_today(p_club uuid, p_now timestamptz default now())
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (p_now at time zone c.timezone)::date from public.clubs c where c.id = p_club
$$;

-- =============================================================================
-- Cuotas
-- =============================================================================
-- Reglas de monto: general del club (sin turno ni corredor), por turno o por corredor.
-- Prioridad: corredor > turno > club; a igual prioridad gana la vigente más reciente.
create table public.fee_rules (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs (id) on delete cascade,
  shift_id     uuid,
  user_id      uuid,
  amount_cents bigint not null check (amount_cents >= 0 and amount_cents <= 100000000000),
  valid_from   date not null check (extract(day from valid_from) = 1),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  check (not (shift_id is not null and user_id is not null)),
  foreign key (club_id, shift_id) references public.shifts (club_id, id) on delete cascade,
  foreign key (club_id, user_id) references public.memberships (club_id, user_id) on delete cascade
);

create index fee_rules_club_idx on public.fee_rules (club_id, valid_from desc);

create table public.fee_payments (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  period        date not null check (extract(day from period) = 1),
  amount_cents  bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  method        public.payment_method not null,
  receipt_path  text,
  note          text check (char_length(note) <= 300),
  status        public.payment_status not null default 'pending',
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  reject_reason text check (char_length(reject_reason) <= 200),
  created_at    timestamptz not null default now(),
  unique (club_id, id),
  foreign key (club_id, user_id) references public.memberships (club_id, user_id) on delete cascade
);

create index fee_payments_period_idx on public.fee_payments (club_id, period, status);
create index fee_payments_user_idx on public.fee_payments (club_id, user_id, period desc);

-- Monto que le corresponde a un corredor en un período (espejo de resolveFeeAmount en TS)
create or replace function public.fee_amount_due(p_club uuid, p_user uuid, p_period date)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select r.amount_cents
  from public.fee_rules r
  left join public.memberships m on m.club_id = r.club_id and m.user_id = p_user
  where r.club_id = p_club
    and r.valid_from <= p_period
    and (
      r.user_id = p_user
      or (r.user_id is null and r.shift_id is not null and r.shift_id = m.shift_id)
      or (r.user_id is null and r.shift_id is null)
    )
  order by case when r.user_id is not null then 2 when r.shift_id is not null then 1 else 0 end desc,
           r.valid_from desc, r.created_at desc
  limit 1
$$;

-- Estado de la cuota (espejo de feeStatus en TS)
create or replace function public.fee_status_of(p_due bigint, p_confirmed bigint, p_pending int)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_due is null or p_due <= 0 then 'paid'
    when p_confirmed >= p_due then 'paid'
    when p_pending > 0 then 'pending'
    else 'owed'
  end
$$;

-- Estado de cuotas del mes. El staff ve a todos los corredores; un corredor, solo a sí mismo.
-- Cuentan los corredores activos que ya estaban en el club ese mes.
create or replace function public.club_fee_statuses(p_club uuid, p_period date)
returns table (
  user_id uuid, full_name text, avatar_path text, shift_id uuid,
  amount_due bigint, confirmed_cents bigint, pending_count int, status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_staff boolean := public.is_staff(p_club);
begin
  if not public.is_member(p_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  with runners as (
    select m.user_id, m.shift_id from public.memberships m
    where m.club_id = p_club and m.role = 'runner' and m.status = 'active'
      and m.joined_at < (p_period + interval '1 month')
      and (v_staff or m.user_id = auth.uid())
  ),
  pays as (
    select fp.user_id,
           coalesce(sum(fp.amount_cents) filter (where fp.status = 'confirmed'), 0)::bigint as confirmed,
           (count(*) filter (where fp.status = 'pending'))::int as pending
    from public.fee_payments fp
    where fp.club_id = p_club and fp.period = p_period
    group by fp.user_id
  )
  select r.user_id, p.full_name, p.avatar_path, r.shift_id,
         public.fee_amount_due(p_club, r.user_id, p_period),
         coalesce(pays.confirmed, 0), coalesce(pays.pending, 0),
         public.fee_status_of(public.fee_amount_due(p_club, r.user_id, p_period), coalesce(pays.confirmed, 0), coalesce(pays.pending, 0))
  from runners r
  join public.profiles p on p.id = r.user_id
  left join pays on pays.user_id = r.user_id
  order by p.full_name;
end;
$$;

-- Confirmar / rechazar un pago (un toque del coach)
create or replace function public.review_fee_payment(p_payment uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.fee_payments;
begin
  select * into v_pay from public.fee_payments where id = p_payment;
  if not found or not public.is_staff(v_pay.club_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.fee_payments
     set status = case when p_approve then 'confirmed' else 'rejected' end::public.payment_status,
         reviewed_by = auth.uid(), reviewed_at = now(),
         reject_reason = case when p_approve then null else left(p_reason, 200) end
   where id = p_payment;

  insert into public.notifications (club_id, user_id, kind, title, body, url)
  values (v_pay.club_id, v_pay.user_id, 'fee_review',
          case when p_approve then 'Pago confirmado' else 'Pago rechazado' end,
          case when p_approve then 'Tu cuota de ' || to_char(v_pay.period, 'MM/YYYY') || ' está al día. ¡Gracias!'
               else 'Revisá tu pago de ' || to_char(v_pay.period, 'MM/YYYY') || coalesce(': ' || p_reason, '.') end,
          '/cuota');
end;
$$;

revoke execute on function public.review_fee_payment(uuid, boolean, text) from public, anon;
grant execute on function public.review_fee_payment(uuid, boolean, text) to authenticated;

-- El corredor solo edita su pago mientras está pendiente y nunca cambia el estado.
create or replace function public.guard_fee_payments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if new.status is distinct from old.status
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.reject_reason is distinct from old.reject_reason
     or new.user_id is distinct from old.user_id
     or new.club_id is distinct from old.club_id then
    raise exception 'forbidden: use review_fee_payment' using errcode = '42501';
  end if;
  if old.status <> 'pending' then
    raise exception 'forbidden: payment already reviewed' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger fee_payments_guard before update on public.fee_payments
  for each row execute function public.guard_fee_payments();

-- Aviso al staff cuando un corredor declara un pago
create or replace function public.on_fee_payment_declared()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select full_name into v_name from public.profiles where id = new.user_id;
  insert into public.notifications (club_id, user_id, kind, title, body, url)
  select new.club_id, m.user_id, 'fee_declared', 'Pago para confirmar',
         coalesce(v_name, 'Un corredor') || ' declaró su cuota de ' || to_char(new.period, 'MM/YYYY'),
         '/cuotas?periodo=' || to_char(new.period, 'YYYY-MM-DD')
  from public.memberships m
  where m.club_id = new.club_id and m.status = 'active' and m.role in ('owner', 'coach');
  return new;
end;
$$;

create trigger fee_payments_notify after insert on public.fee_payments
  for each row execute function public.on_fee_payment_declared();

-- =============================================================================
-- Apto médico
-- =============================================================================
create table public.medical_certificates (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  file_path   text not null,
  expires_on  date not null,
  uploaded_at timestamptz not null default now(),
  foreign key (club_id, user_id) references public.memberships (club_id, user_id) on delete cascade
);

create index medical_certificates_user_idx on public.medical_certificates (club_id, user_id, uploaded_at desc);

-- Espejo de medicalStatus en TS: vale hasta el día de vencimiento inclusive; "por vencer" = 30 días.
create or replace function public.medical_status_of(p_expires date, p_today date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_expires is null then 'missing'
    when p_expires < p_today then 'expired'
    when p_expires - p_today <= 30 then 'expiring'
    else 'valid'
  end
$$;

create or replace function public.club_medical_statuses(p_club uuid)
returns table (user_id uuid, full_name text, avatar_path text, expires_on date, file_path text, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_staff boolean := public.is_staff(p_club);
  v_today date := public.club_today(p_club);
begin
  if not public.is_member(p_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select m.user_id, p.full_name, p.avatar_path, last.expires_on, last.file_path,
         public.medical_status_of(last.expires_on, v_today)
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  left join lateral (
    select mc.expires_on, mc.file_path from public.medical_certificates mc
    where mc.club_id = m.club_id and mc.user_id = m.user_id
    order by mc.uploaded_at desc limit 1
  ) last on true
  where m.club_id = p_club and m.role = 'runner' and m.status = 'active'
    and (v_staff or m.user_id = auth.uid())
  order by p.full_name;
end;
$$;

-- =============================================================================
-- Eventos
-- =============================================================================
create table public.events (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references public.clubs (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 2 and 100),
  kind             public.event_kind not null default 'road',
  starts_at        timestamptz not null,
  location         text check (char_length(location) <= 160),
  distances        text[] not null default '{}' check (cardinality(distances) <= 10),
  registration_url text check (registration_url ~ '^https?://'),
  price_cents      bigint check (price_cents >= 0),
  notes            text check (char_length(notes) <= 2000),
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (club_id, id)
);

create index events_club_idx on public.events (club_id, starts_at);
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

create table public.event_registrations (
  club_id    uuid not null,
  event_id   uuid not null,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  distance   text,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id),
  foreign key (club_id, event_id) references public.events (club_id, id) on delete cascade,
  foreign key (club_id, user_id) references public.memberships (club_id, user_id) on delete cascade
);

create index event_registrations_user_idx on public.event_registrations (club_id, user_id);

-- La distancia elegida tiene que ser una de las del evento (si el evento tiene distancias)
create or replace function public.check_event_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
begin
  select * into v_event from public.events where id = new.event_id;
  if cardinality(v_event.distances) > 0 and (new.distance is null or not new.distance = any (v_event.distances)) then
    raise exception 'invalid_distance' using errcode = '22023';
  end if;
  if cardinality(v_event.distances) = 0 then
    new.distance := null;
  end if;
  return new;
end;
$$;

create trigger event_registrations_check before insert or update on public.event_registrations
  for each row execute function public.check_event_registration();

create or replace function public.on_event_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.starts_at > now() then
    perform public.notify_members(
      new.club_id, 'club', null, null, new.created_by,
      'event', 'Nuevo evento', new.name || ' · ' || to_char(new.starts_at at time zone c.timezone, 'DD/MM'),
      '/eventos/' || new.id, jsonb_build_object('event_id', new.id)
    )
    from public.clubs c where c.id = new.club_id;
  end if;
  return new;
end;
$$;

create trigger events_notify after insert on public.events
  for each row execute function public.on_event_created();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.fee_rules enable row level security;
alter table public.fee_payments enable row level security;
alter table public.medical_certificates enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;

-- fee_rules: el staff ve todas; el corredor, las generales, las de su turno y las suyas (no las becas de otros)
create policy "read fee rules" on public.fee_rules for select to authenticated
  using (
    club_id in (select public.my_staff_club_ids())
    or (club_id in (select public.my_club_ids())
        and (user_id = (select auth.uid()) or (user_id is null and (shift_id is null or shift_id = public.my_shift(club_id)))))
  );
create policy "staff manage fee rules" on public.fee_rules for all to authenticated
  using (club_id in (select public.my_staff_club_ids()))
  with check (club_id in (select public.my_staff_club_ids()) and public.club_has_feature(club_id, 'fees'));

-- fee_payments
create policy "read own payments or as staff" on public.fee_payments for select to authenticated
  using (user_id = (select auth.uid()) or club_id in (select public.my_staff_club_ids()));
create policy "runner declares payment" on public.fee_payments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and club_id in (select public.my_club_ids())
    and status = 'pending' and reviewed_by is null and reviewed_at is null
    and public.club_has_feature(club_id, 'fees')
    and (receipt_path is null or receipt_path like club_id::text || '/receipts/' || (select auth.uid())::text || '/%')
  );
create policy "runner edits pending payment" on public.fee_payments for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pending')
  with check (user_id = (select auth.uid()));
create policy "runner deletes pending payment" on public.fee_payments for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'pending');

-- medical_certificates
create policy "read own certificates or as staff" on public.medical_certificates for select to authenticated
  using (user_id = (select auth.uid()) or club_id in (select public.my_staff_club_ids()));
create policy "runner uploads certificate" on public.medical_certificates for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and club_id in (select public.my_club_ids())
    and public.club_has_feature(club_id, 'medical')
    and file_path like club_id::text || '/medical/' || (select auth.uid())::text || '/%'
  );
create policy "runner deletes own certificate" on public.medical_certificates for delete to authenticated
  using (user_id = (select auth.uid()));

-- events
create policy "members read events" on public.events for select to authenticated
  using (club_id in (select public.my_club_ids()));
create policy "staff insert events" on public.events for insert to authenticated
  with check (club_id in (select public.my_staff_club_ids()) and created_by = (select auth.uid()));
create policy "staff update events" on public.events for update to authenticated
  using (club_id in (select public.my_staff_club_ids()))
  with check (club_id in (select public.my_staff_club_ids()));
create policy "staff delete events" on public.events for delete to authenticated
  using (club_id in (select public.my_staff_club_ids()));

-- event_registrations: los miembros ven quién va (avatares); cada uno se anota o se baja
create policy "members read registrations" on public.event_registrations for select to authenticated
  using (club_id in (select public.my_club_ids()));
create policy "register myself" on public.event_registrations for insert to authenticated
  with check (user_id = (select auth.uid()) and club_id in (select public.my_club_ids()));
create policy "change my distance" on public.event_registrations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "unregister myself or as staff" on public.event_registrations for delete to authenticated
  using (user_id = (select auth.uid()) or club_id in (select public.my_staff_club_ids()));

-- =============================================================================
-- Recordatorios diarios (pg_cron cada hora; cada club corre a las 9:00 de su zona)
-- Idempotentes gracias a reminder_log: correrlos dos veces no duplica avisos.
-- =============================================================================
create or replace function public.log_reminder(p_club uuid, p_user uuid, p_kind text, p_ref date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reminder_log (club_id, user_id, kind, ref_date) values (p_club, p_user, p_kind, p_ref);
  return true;
exception when unique_violation then
  return false;
end;
$$;

create or replace function public.run_daily_reminders(p_now timestamptz default now(), p_ignore_hour boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  r record;
  v_today date;
  v_period date;
  v_counts jsonb := '{}'::jsonb;
  n_fee int := 0; n_med int := 0; n_evt int := 0; n_bday int := 0;
  v_day int;
begin
  for c in select * from public.clubs where deleted_at is null loop
    if not p_ignore_hour and extract(hour from p_now at time zone c.timezone) <> 9 then
      continue;
    end if;
    v_today := (p_now at time zone c.timezone)::date;
    v_period := date_trunc('month', v_today)::date;

    -- 1. Cuotas: el día configurado, a quienes deben el mes en curso
    v_day := coalesce((c.settings ->> 'fee_reminder_day')::int, 10);
    if public.club_has_feature(c.id, 'fees') and extract(day from v_today) = v_day then
      for r in
        with runners as (
          select m.user_id from public.memberships m
          where m.club_id = c.id and m.role = 'runner' and m.status = 'active' and m.joined_at < v_period + interval '1 month'
        )
        select ru.user_id,
               public.fee_status_of(
                 public.fee_amount_due(c.id, ru.user_id, v_period),
                 coalesce((select sum(fp.amount_cents) from public.fee_payments fp
                           where fp.club_id = c.id and fp.user_id = ru.user_id and fp.period = v_period and fp.status = 'confirmed'), 0)::bigint,
                 (select count(*) from public.fee_payments fp
                  where fp.club_id = c.id and fp.user_id = ru.user_id and fp.period = v_period and fp.status = 'pending')::int
               ) as status
        from runners ru
      loop
        if r.status = 'owed' and public.log_reminder(c.id, r.user_id, 'fee', v_period) then
          insert into public.notifications (club_id, user_id, kind, title, body, url)
          values (c.id, r.user_id, 'fee_reminder', 'Recordatorio de cuota',
                  'Tu cuota de ' || to_char(v_period, 'MM/YYYY') || ' figura pendiente. Si ya pagaste, cargá el comprobante.', '/cuota');
          n_fee := n_fee + 1;
        end if;
      end loop;
    end if;

    -- 2. Apto médico: 30 y 7 días antes, el día que vence y el día siguiente
    if public.club_has_feature(c.id, 'medical') then
      for r in
        select m.user_id, last.expires_on, last.expires_on - v_today as days_left
        from public.memberships m
        join lateral (
          select mc.expires_on from public.medical_certificates mc
          where mc.club_id = m.club_id and mc.user_id = m.user_id order by mc.uploaded_at desc limit 1
        ) last on true
        where m.club_id = c.id and m.role = 'runner' and m.status = 'active'
          and last.expires_on - v_today in (30, 7, 0, -1)
      loop
        if public.log_reminder(c.id, r.user_id, 'medical_' || r.days_left, r.expires_on) then
          insert into public.notifications (club_id, user_id, kind, title, body, url)
          values (c.id, r.user_id, 'medical_reminder',
                  case when r.days_left < 0 then 'Tu apto médico venció' else 'Tu apto médico vence pronto' end,
                  case when r.days_left < 0 then 'Subí el certificado nuevo para seguir entrenando con el club.'
                       when r.days_left = 0 then 'Vence hoy. Subí el certificado nuevo.'
                       else 'Vence en ' || r.days_left || ' días (' || to_char(r.expires_on, 'DD/MM') || ').' end,
                  '/apto');
          n_med := n_med + 1;
        end if;
      end loop;
    end if;

    -- 3. Eventos de mañana: a los inscriptos
    for r in
      select e.id, e.name, e.starts_at, er.user_id, er.distance
      from public.events e
      join public.event_registrations er on er.event_id = e.id
      where e.club_id = c.id and (e.starts_at at time zone c.timezone)::date = v_today + 1
    loop
      if public.log_reminder(c.id, r.user_id, 'event:' || r.id, v_today) then
        insert into public.notifications (club_id, user_id, kind, title, body, url)
        values (c.id, r.user_id, 'event_reminder', '¡Mañana es el día!',
                r.name || ' · ' || to_char(r.starts_at at time zone c.timezone, 'HH24:MI') || ' h' || coalesce(' · ' || r.distance, ''),
                '/eventos/' || r.id);
        n_evt := n_evt + 1;
      end if;
    end loop;

    -- 4. Cumpleaños: aviso al staff y, si está activado, saludo del club al corredor
    if public.club_has_feature(c.id, 'birthdays') then
      for r in
        select m.user_id, p.full_name
        from public.memberships m
        join public.profiles p on p.id = m.user_id
        join public.profile_private pp on pp.user_id = m.user_id
        where m.club_id = c.id and m.status = 'active'
          and pp.birth_date is not null
          and to_char(pp.birth_date, 'MM-DD') = to_char(v_today, 'MM-DD')
      loop
        if public.log_reminder(c.id, r.user_id, 'birthday', v_today) then
          insert into public.notifications (club_id, user_id, kind, title, body, url)
          select c.id, s.user_id, 'birthday_staff', 'Cumpleaños 🎂', 'Hoy cumple ' || r.full_name || '. ¡Saludalo!', '/corredores/' || r.user_id
          from public.memberships s
          where s.club_id = c.id and s.status = 'active' and s.role in ('owner', 'coach') and s.user_id <> r.user_id;
          if coalesce((c.settings ->> 'birthday_greeting')::boolean, false) then
            insert into public.notifications (club_id, user_id, kind, title, body, url)
            values (c.id, r.user_id, 'birthday_greeting', '¡Feliz cumple! 🎉',
                    '¡Feliz cumpleaños, ' || split_part(r.full_name, ' ', 1) || '! Te saluda todo ' || c.name || '.', '/');
          end if;
          n_bday := n_bday + 1;
        end if;
      end loop;
    end if;
  end loop;

  return jsonb_build_object('fees', n_fee, 'medical', n_med, 'events', n_evt, 'birthdays', n_bday);
end;
$$;

revoke execute on function public.run_daily_reminders(timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.log_reminder(uuid, uuid, text, date) from public, anon, authenticated;

-- Agenda: cada hora (cada club corre cuando son las 9:00 en su zona)
do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('daily-reminders', '5 * * * *', $$select public.run_daily_reminders()$$);
  end if;
end;
$cron$;
