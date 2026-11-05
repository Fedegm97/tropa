-- =============================================================================
-- Tropa · 0004 · Avisos, notificaciones in-app y cola de push
--
-- Cola: la tabla `notifications` es el outbox. Las mutaciones solo insertan
-- filas (push_status = 'pending'); el envío lo hace un worker en segundo plano
-- (src/lib/push/dispatch.ts) que reclama lotes con FOR UPDATE SKIP LOCKED.
-- Lo disparan `after()` de Next.js y, como red de seguridad, pg_cron.
-- =============================================================================

create table public.announcements (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs (id) on delete cascade,
  author_id    uuid references public.profiles (id) on delete set null,
  body         text not null check (char_length(btrim(body)) between 1 and 2000),
  image_path   text,
  audience     public.audience_kind not null default 'club' check (audience in ('club', 'shift')),
  shift_id     uuid,
  pinned_at    timestamptz,
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (club_id, id),
  check ((audience = 'shift') = (shift_id is not null)),
  foreign key (club_id, shift_id) references public.shifts (club_id, id) on delete cascade
);

create index announcements_club_idx on public.announcements (club_id, published_at desc);
create trigger announcements_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();

create table public.announcement_views (
  club_id         uuid not null,
  announcement_id uuid not null,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  viewed_at       timestamptz not null default now(),
  primary key (announcement_id, user_id),
  foreign key (club_id, announcement_id) references public.announcements (club_id, id) on delete cascade
);

create table public.announcement_reactions (
  club_id         uuid not null,
  announcement_id uuid not null,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  emoji           text not null check (emoji in ('👍', '🔥', '💪', '👏', '❤️', '😂')),
  created_at      timestamptz not null default now(),
  primary key (announcement_id, user_id, emoji),
  foreign key (club_id, announcement_id) references public.announcements (club_id, id) on delete cascade
);

create index announcement_reactions_ann_idx on public.announcement_reactions (club_id, announcement_id);

create or replace function public.can_view_announcement(p_announcement uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.announcements a
    where a.id = p_announcement
      and (
        public.is_staff(a.club_id)
        or (public.is_member(a.club_id)
            and (a.audience = 'club' or a.shift_id = public.my_shift(a.club_id)))
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- Suscripciones Web Push (una por dispositivo y por club: cada subdominio es
-- un origen distinto con su propio service worker)
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  failed_count int not null default 0,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (club_id, user_id);

-- ---------------------------------------------------------------------------
-- Notificaciones (bandeja in-app + outbox de push)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  kind          text not null,
  title         text not null,
  body          text,
  url           text,
  data          jsonb not null default '{}'::jsonb,
  read_at       timestamptz,
  push_status   public.push_status not null default 'pending',
  push_attempts smallint not null default 0,
  push_sent_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (club_id, user_id, created_at desc);
create index notifications_push_queue_idx on public.notifications (created_at) where push_status = 'pending';

-- Registro de recordatorios enviados (idempotencia de los jobs de pg_cron)
create table public.reminder_log (
  club_id  uuid not null references public.clubs (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  kind     text not null,
  ref_date date not null,
  sent_at  timestamptz not null default now(),
  primary key (club_id, user_id, kind, ref_date)
);

-- ---------------------------------------------------------------------------
-- Fan-out: genera una notificación por destinatario (sin el autor)
-- ---------------------------------------------------------------------------
create or replace function public.notify_members(
  p_club uuid, p_audience public.audience_kind, p_shift uuid, p_targets uuid[],
  p_exclude uuid, p_kind text, p_title text, p_body text, p_url text, p_data jsonb default '{}'::jsonb
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  insert into public.notifications (club_id, user_id, kind, title, body, url, data)
  select p_club, m.user_id, p_kind, p_title, p_body, p_url, p_data
  from public.memberships m
  where m.club_id = p_club
    and m.status = 'active'
    and m.user_id is distinct from p_exclude
    and (
      p_audience = 'club'
      or (p_audience = 'shift' and (m.shift_id = p_shift or m.role in ('owner', 'coach')))
      or (p_audience = 'runners' and m.user_id = any (p_targets))
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.notify_members(uuid, public.audience_kind, uuid, uuid[], uuid, text, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.on_announcement_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_members(
    new.club_id, new.audience, new.shift_id, null, new.author_id,
    'announcement', 'Nuevo aviso', left(new.body, 140), '/avisos#' || new.id,
    jsonb_build_object('announcement_id', new.id)
  );
  return new;
end;
$$;

create trigger announcements_notify after insert on public.announcements
  for each row execute function public.on_announcement_published();

-- Al publicar una sesión (published_at pasa de null a un valor) se avisa a quienes la tienen.
-- Los targets se insertan después de la sesión, así que para audiencia 'runners'
-- la app llama a publish_session() una vez cargados.
create or replace function public.publish_session(p_session uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.training_sessions;
  v_targets uuid[];
begin
  select * into s from public.training_sessions where id = p_session;
  if not found or not public.is_staff(s.club_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if s.published_at is not null then
    return 0;
  end if;

  update public.training_sessions set published_at = now() where id = p_session;

  select array_agg(t.user_id) into v_targets from public.training_session_targets t where t.session_id = p_session;

  return public.notify_members(
    s.club_id, s.audience, s.shift_id, v_targets, auth.uid(),
    'session', 'Nuevo entrenamiento',
    s.title || ' · ' || to_char(s.date, 'DD/MM'),
    '/plan/' || s.id,
    jsonb_build_object('session_id', s.id)
  );
end;
$$;

revoke execute on function public.publish_session(uuid) from public, anon;
grant execute on function public.publish_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Cola de push: reclamar lote / marcar resultado (solo service_role)
-- ---------------------------------------------------------------------------
create or replace function public.claim_push_batch(p_limit int default 100)
returns table (
  notification_id uuid, club_id uuid, user_id uuid, title text, body text, url text, kind text,
  club_slug text, club_name text, club_color text
)
language sql
volatile
security definer
set search_path = ''
as $$
  with batch as (
    select n.id from public.notifications n
    where n.push_status = 'pending'
       or (n.push_status = 'processing' and n.push_attempts < 3 and n.created_at < now() - interval '5 minutes')
    order by n.created_at
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update public.notifications n
       set push_status = 'processing', push_attempts = n.push_attempts + 1
      from batch
     where n.id = batch.id
    returning n.*
  )
  select c.id, c.club_id, c.user_id, c.title, c.body, c.url, c.kind, cl.slug, cl.name, cl.primary_color
  from claimed c join public.clubs cl on cl.id = c.club_id
$$;

create or replace function public.complete_push(p_ids uuid[], p_status public.push_status)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.notifications
     set push_status = p_status,
         push_sent_at = case when p_status = 'sent' then now() else push_sent_at end
   where id = any (p_ids)
$$;

revoke execute on function public.claim_push_batch(int) from public, anon, authenticated;
revoke execute on function public.complete_push(uuid[], public.push_status) from public, anon, authenticated;
grant execute on function public.claim_push_batch(int) to service_role;
grant execute on function public.complete_push(uuid[], public.push_status) to service_role;

-- Registrar/actualizar la suscripción del dispositivo actual.
-- Si el endpoint estaba asociado a otro usuario (dispositivo compartido), se reasigna.
create or replace function public.upsert_push_subscription(
  p_club uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_member(p_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (club_id, user_id, endpoint, p256dh, auth, user_agent)
  values (p_club, auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set club_id = excluded.club_id, user_id = excluded.user_id, p256dh = excluded.p256dh,
        auth = excluded.auth, user_agent = excluded.user_agent, failed_count = 0;
end;
$$;

revoke execute on function public.upsert_push_subscription(uuid, text, text, text, text) from public, anon;
grant execute on function public.upsert_push_subscription(uuid, text, text, text, text) to authenticated;

-- "Visto por N" y reacciones agregadas, para cualquier miembro que pueda ver el aviso
create or replace function public.announcement_stats(p_ids uuid[])
returns table (announcement_id uuid, views bigint, reactions jsonb, my_reactions text[])
language sql
stable
security definer
set search_path = ''
as $$
  select a.id,
         (select count(*) from public.announcement_views v where v.announcement_id = a.id),
         coalesce((select jsonb_object_agg(r.emoji, r.n) from (
            select ar.emoji, count(*) n from public.announcement_reactions ar
            where ar.announcement_id = a.id group by ar.emoji) r), '{}'::jsonb),
         coalesce((select array_agg(ar.emoji) from public.announcement_reactions ar
                   where ar.announcement_id = a.id and ar.user_id = (select auth.uid())), '{}')
  from public.announcements a
  where a.id = any (p_ids) and public.can_view_announcement(a.id)
$$;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.announcements enable row level security;
alter table public.announcement_views enable row level security;
alter table public.announcement_reactions enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.reminder_log enable row level security;

create policy "read visible announcements" on public.announcements for select to authenticated
  using (
    club_id in (select public.my_staff_club_ids())
    or (club_id in (select public.my_club_ids())
        and (audience = 'club' or shift_id = public.my_shift(club_id)))
  );
create policy "staff insert announcements" on public.announcements for insert to authenticated
  with check (club_id in (select public.my_staff_club_ids()) and author_id = (select auth.uid()));
create policy "staff update announcements" on public.announcements for update to authenticated
  using (club_id in (select public.my_staff_club_ids()))
  with check (club_id in (select public.my_staff_club_ids()));
create policy "staff delete announcements" on public.announcements for delete to authenticated
  using (club_id in (select public.my_staff_club_ids()));

create policy "read own views or as staff" on public.announcement_views for select to authenticated
  using (user_id = (select auth.uid()) or club_id in (select public.my_staff_club_ids()));
create policy "mark own view" on public.announcement_views for insert to authenticated
  with check (user_id = (select auth.uid()) and club_id in (select public.my_club_ids())
              and public.can_view_announcement(announcement_id));

create policy "members read reactions" on public.announcement_reactions for select to authenticated
  using (club_id in (select public.my_club_ids()));
create policy "react as myself" on public.announcement_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and club_id in (select public.my_club_ids())
              and public.can_view_announcement(announcement_id));
create policy "remove own reaction" on public.announcement_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "own push subscriptions" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "delete own push subscriptions" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "read own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and club_id in (select public.my_club_ids()));
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- reminder_log: solo lo usan los jobs (sin políticas para clientes)
create policy "staff read reminder log" on public.reminder_log for select to authenticated
  using (club_id in (select public.my_staff_club_ids()));

-- Los clientes solo pueden cambiar read_at de sus notificaciones
create or replace function public.guard_notifications()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged() then
    return new;
  end if;
  if (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
    raise exception 'forbidden: only read_at can be updated' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger notifications_guard before update on public.notifications
  for each row execute function public.guard_notifications();
