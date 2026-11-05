-- =============================================================================
-- Tropa · 0002 · Núcleo multi-tenant: planes, clubes, perfiles, memberships,
-- turnos, invitaciones de staff y auditoría.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Planes de la plataforma (catálogo; feature flags + límites)
-- ---------------------------------------------------------------------------
create table public.platform_plans (
  code            text primary key,
  name            text not null,
  price_usd_cents int  not null default 0,
  max_runners     int,           -- null = ilimitado
  max_staff       int,           -- owner + coaches; null = ilimitado
  features        text[] not null default '{}',
  sort            smallint not null default 0
);

insert into public.platform_plans (code, name, price_usd_cents, max_runners, max_staff, features, sort) values
  ('free',  'Free',  0,    10,   1,    array['training','events','announcements','shifts'], 0),
  ('coach', 'Coach', 1499, 30,   1,    array['training','events','announcements','shifts','fees','medical','birthdays'], 1),
  ('team',  'Team',  3999, 150,  5,    array['training','events','announcements','shifts','fees','medical','birthdays','store','priority_support'], 2),
  ('club',  'Club',  0,    null, null, array['training','events','announcements','shifts','fees','medical','birthdays','store','priority_support'], 3);

alter table public.platform_plans enable row level security;
create policy "plans are public" on public.platform_plans for select using (true);

-- ---------------------------------------------------------------------------
-- Clubes (tenants)
-- ---------------------------------------------------------------------------
create table public.clubs (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique
                  check (slug ~ '^[a-z0-9]([a-z0-9-]{1,30})[a-z0-9]$' and slug !~ '--'),
  name            text not null check (char_length(btrim(name)) between 2 and 60),
  primary_color   text not null default '#FF5A1F' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_path       text,
  plan_code       text not null default 'free' references public.platform_plans (code),
  plan_status     public.plan_status not null default 'active',
  trial_ends_at   timestamptz,
  plan_override   boolean not null default false, -- pilotos: plan fijado a mano
  timezone        text not null default 'America/Argentina/Buenos_Aires',
  currency        char(3) not null default 'ARS',
  invite_code     text not null unique default public.gen_code(8),
  onboarding_step smallint not null default 1 check (onboarding_step between 1 and 4), -- 4 = completo
  settings        jsonb not null default '{}'::jsonb,
  custom_domain   text unique check (custom_domain = lower(custom_domain)),
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create trigger clubs_updated_at before update on public.clubs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Perfiles: público (nombre, foto) y privado (datos sensibles)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null default '' check (char_length(full_name) <= 80),
  avatar_path   text,
  is_superadmin boolean not null default false,
  completed_at  timestamptz, -- completó el perfil inicial
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.profile_private (
  user_id         uuid primary key references public.profiles (id) on delete cascade,
  birth_date      date check (birth_date between date '1920-01-01' and current_date),
  phone           text check (char_length(phone) <= 30),
  emergency_name  text check (char_length(emergency_name) <= 80),
  emergency_phone text check (char_length(emergency_phone) <= 30),
  updated_at      timestamptz not null default now()
);

create trigger profile_private_updated_at before update on public.profile_private
  for each row execute function public.set_updated_at();

-- Alta automática de perfil al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_path)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80),
    null
  )
  on conflict (id) do nothing;
  insert into public.profile_private (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Memberships (usuario ↔ club, con rol). Un usuario puede estar en N clubes.
-- ---------------------------------------------------------------------------
create table public.memberships (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references public.clubs (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  role              public.member_role not null default 'runner',
  status            public.member_status not null default 'active',
  shift_id          uuid,
  level             public.runner_level,
  ref_pace_s_per_km int check (ref_pace_s_per_km between 150 and 900),
  ref_pace_kind     public.pace_kind not null default '5k',
  joined_at         timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (club_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id) where status = 'active';
create index memberships_club_role_idx on public.memberships (club_id, role) where status = 'active';
create index memberships_club_shift_idx on public.memberships (club_id, shift_id);

create trigger memberships_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers de autorización (SECURITY DEFINER: leen memberships sin RLS)
-- ---------------------------------------------------------------------------
create or replace function public.my_club_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.club_id from public.memberships m
  where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

create or replace function public.my_staff_club_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.club_id from public.memberships m
  where m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'coach')
$$;

create or replace function public.is_member(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.club_id = p_club and m.user_id = (select auth.uid()) and m.status = 'active'
  )
$$;

create or replace function public.is_staff(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.club_id = p_club and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role in ('owner', 'coach')
  )
$$;

create or replace function public.is_owner(p_club uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.club_id = p_club and m.user_id = (select auth.uid())
      and m.status = 'active' and m.role = 'owner'
  )
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_superadmin from public.profiles p where p.id = (select auth.uid())), false)
$$;

create or replace function public.my_shift(p_club uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.shift_id from public.memberships m
  where m.club_id = p_club and m.user_id = (select auth.uid()) and m.status = 'active'
$$;

-- ¿Comparto algún club activo con este usuario?
create or replace function public.shares_club(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.club_id = mine.club_id
    where mine.user_id = (select auth.uid()) and mine.status = 'active'
      and theirs.user_id = p_user and theirs.status = 'active'
  )
$$;

-- ¿Soy staff de algún club donde está este usuario?
create or replace function public.is_staff_of_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.club_id = mine.club_id
    where mine.user_id = (select auth.uid()) and mine.status = 'active'
      and mine.role in ('owner', 'coach')
      and theirs.user_id = p_user
  )
$$;

-- Plan efectivo: un trial vencido o una suscripción cancelada vuelven a Free.
create or replace function public.club_effective_plan(p_club uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.plan_override then c.plan_code
    when c.plan_status = 'canceled' then 'free'
    when c.plan_status = 'trialing' and c.trial_ends_at is not null and c.trial_ends_at < now() then 'free'
    else c.plan_code
  end
  from public.clubs c where c.id = p_club
$$;

create or replace function public.club_has_feature(p_club uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_feature = any (p.features), false)
  from public.platform_plans p
  where p.code = public.club_effective_plan(p_club)
$$;

-- ---------------------------------------------------------------------------
-- Turnos
-- ---------------------------------------------------------------------------
create table public.shifts (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 40),
  days          smallint[] not null check (cardinality(days) between 1 and 7 and days <@ array[1,2,3,4,5,6,7]::smallint[]),
  starts_at     time not null,
  ends_at       time not null,
  location      text check (char_length(location) <= 120),
  coach_user_id uuid,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (club_id, id),
  check (ends_at > starts_at),
  foreign key (club_id, coach_user_id) references public.memberships (club_id, user_id) on delete set null (coach_user_id)
);

create index shifts_club_idx on public.shifts (club_id) where archived_at is null;

create trigger shifts_updated_at before update on public.shifts
  for each row execute function public.set_updated_at();

alter table public.memberships
  add constraint memberships_shift_fk foreign key (club_id, shift_id)
  references public.shifts (club_id, id) on delete set null (shift_id);

-- ---------------------------------------------------------------------------
-- Invitaciones de staff (coaches). Los corredores entran con clubs.invite_code.
-- ---------------------------------------------------------------------------
create table public.staff_invitations (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs (id) on delete cascade,
  email       text not null check (email = lower(email)),
  role        public.member_role not null default 'coach' check (role = 'coach'),
  token       text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  invited_by  uuid references public.profiles (id) on delete set null,
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index staff_invitations_club_idx on public.staff_invitations (club_id);

-- ---------------------------------------------------------------------------
-- Auditoría
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  club_id    uuid references public.clubs (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  entity     text,
  entity_id  text,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_club_idx on public.audit_log (club_id, created_at desc);

-- =============================================================================
-- Guard triggers (columnas que no se tocan desde el cliente)
-- =============================================================================
create or replace function public.guard_clubs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged() or public.is_superadmin() then
    return new;
  end if;
  if new.plan_code is distinct from old.plan_code
     or new.plan_status is distinct from old.plan_status
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.plan_override is distinct from old.plan_override
     or new.custom_domain is distinct from old.custom_domain
     or new.created_by is distinct from old.created_by
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'forbidden: billing columns are managed by the platform' using errcode = '42501';
  end if;
  -- Cambiar el slug rompe las PWAs instaladas (cambia el origen): solo durante el onboarding.
  if new.slug is distinct from old.slug and old.onboarding_step >= 2 then
    raise exception 'forbidden: slug is locked after onboarding' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger clubs_guard before update on public.clubs
  for each row execute function public.guard_clubs();

create or replace function public.guard_profiles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_privileged() and new.is_superadmin is distinct from old.is_superadmin then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profiles();

create or replace function public.guard_memberships()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_privileged() then
    return new;
  end if;

  if new.club_id is distinct from old.club_id or new.user_id is distinct from old.user_id then
    raise exception 'forbidden: immutable columns' using errcode = '42501';
  end if;

  -- Un corredor solo puede editar su propio ritmo de referencia.
  if not public.is_staff(old.club_id) then
    if old.user_id <> (select auth.uid())
       or new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.shift_id is distinct from old.shift_id
       or new.level is distinct from old.level then
      raise exception 'forbidden: runners can only edit their reference pace' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Staff: los roles solo los cambia el owner, y nadie se vuelve owner desde acá.
  if new.role is distinct from old.role then
    if not public.is_owner(old.club_id) or new.role = 'owner' or old.role = 'owner' then
      raise exception 'forbidden: only the owner can change roles' using errcode = '42501';
    end if;
  end if;
  if old.role = 'owner' and new.status is distinct from old.status then
    raise exception 'forbidden: the owner cannot be deactivated' using errcode = '42501';
  end if;
  if old.role = 'coach' and new.status is distinct from old.status and not public.is_owner(old.club_id) then
    raise exception 'forbidden: only the owner manages coaches' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger memberships_guard before update on public.memberships
  for each row execute function public.guard_memberships();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.clubs enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.memberships enable row level security;
alter table public.shifts enable row level security;
alter table public.staff_invitations enable row level security;
alter table public.audit_log enable row level security;

-- clubs: lo ven sus miembros (el branding público sale por club_public_by_slug)
create policy "members read club" on public.clubs for select to authenticated
  using (id in (select public.my_club_ids()));
create policy "owner updates club" on public.clubs for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));
-- INSERT/DELETE: solo por RPC (create_club) o la plataforma.

-- profiles
create policy "read own or club mates profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_club(id));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- profile_private: yo y el staff de mis clubes
create policy "read own or as staff" on public.profile_private for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff_of_user(user_id));
create policy "update own private profile" on public.profile_private for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- memberships
create policy "members read club memberships" on public.memberships for select to authenticated
  using (club_id in (select public.my_club_ids()) or user_id = (select auth.uid()));
create policy "staff or self update membership" on public.memberships for update to authenticated
  using (club_id in (select public.my_staff_club_ids()) or user_id = (select auth.uid()))
  with check (club_id in (select public.my_staff_club_ids()) or user_id = (select auth.uid()));
create policy "remove members" on public.memberships for delete to authenticated
  using (
    role <> 'owner' and (
      public.is_owner(club_id)
      or (role = 'runner' and club_id in (select public.my_staff_club_ids()))
      or user_id = (select auth.uid())
    )
  );
-- INSERT: solo por RPC (create_club, join_club, accept_staff_invitation).

-- shifts
create policy "members read shifts" on public.shifts for select to authenticated
  using (club_id in (select public.my_club_ids()));
create policy "staff insert shifts" on public.shifts for insert to authenticated
  with check (club_id in (select public.my_staff_club_ids()));
create policy "staff update shifts" on public.shifts for update to authenticated
  using (club_id in (select public.my_staff_club_ids()))
  with check (club_id in (select public.my_staff_club_ids()));
create policy "staff delete shifts" on public.shifts for delete to authenticated
  using (club_id in (select public.my_staff_club_ids()));

-- staff_invitations: solo el owner
create policy "owner reads invitations" on public.staff_invitations for select to authenticated
  using (public.is_owner(club_id));
create policy "owner creates invitations" on public.staff_invitations for insert to authenticated
  with check (public.is_owner(club_id) and invited_by = (select auth.uid()));
create policy "owner deletes invitations" on public.staff_invitations for delete to authenticated
  using (public.is_owner(club_id));

-- audit_log: lo lee el owner; escribe el staff (como sí mismo)
create policy "owner reads audit" on public.audit_log for select to authenticated
  using (public.is_owner(club_id));
create policy "staff writes audit" on public.audit_log for insert to authenticated
  with check (club_id in (select public.my_staff_club_ids()) and actor_id = (select auth.uid()));

-- =============================================================================
-- RPCs
-- =============================================================================

-- Slugs reservados para la plataforma
create or replace function public.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(p_slug) = any (array[
    'www','app','api','admin','auth','login','ingresar','registro','static','assets','cdn','img',
    'mail','email','smtp','help','ayuda','soporte','support','blog','status','docs','dev','staging',
    'test','tropa','billing','pagos','dashboard','panel','superadmin','root','m','beta','demo','club','clubs'
  ])
$$;

create or replace function public.is_slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_slug ~ '^[a-z0-9]([a-z0-9-]{1,30})[a-z0-9]$'
     and p_slug !~ '--'
     and not public.is_reserved_slug(p_slug)
     and not exists (select 1 from public.clubs c where c.slug = lower(p_slug))
$$;

-- Branding público para el manifest, la pantalla de login y los íconos
create or replace function public.club_public_by_slug(p_slug text)
returns table (id uuid, slug text, name text, primary_color text, logo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.slug, c.name, c.primary_color, c.logo_path
  from public.clubs c
  where c.slug = lower(p_slug) and c.deleted_at is null
$$;

-- Datos mínimos para la pantalla "Te invitaron a ..."
create or replace function public.club_public_by_invite(p_code text)
returns table (id uuid, slug text, name text, primary_color text, logo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.slug, c.name, c.primary_color, c.logo_path
  from public.clubs c
  where c.invite_code = upper(p_code) and c.deleted_at is null
$$;

create or replace function public.create_club(p_name text, p_slug text, p_color text)
returns public.clubs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_club public.clubs;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.is_slug_available(lower(p_slug)) then
    raise exception 'slug_unavailable' using errcode = '23505';
  end if;

  insert into public.clubs (slug, name, primary_color, created_by, onboarding_step)
  values (lower(p_slug), btrim(p_name), upper(p_color), v_uid, 2)
  returning * into v_club;

  insert into public.memberships (club_id, user_id, role)
  values (v_club.id, v_uid, 'owner');

  insert into public.audit_log (club_id, actor_id, action, entity, entity_id)
  values (v_club.id, v_uid, 'club.created', 'club', v_club.id::text);

  return v_club;
end;
$$;

-- Límite de corredores según el plan. Nunca bloquea lo ya cargado: solo altas nuevas.
create or replace function public.club_can_add(p_club uuid, p_role public.member_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with plan as (
    select p.max_runners, p.max_staff
    from public.platform_plans p
    where p.code = public.club_effective_plan(p_club)
  ),
  counts as (
    select
      count(*) filter (where m.role = 'runner') as runners,
      count(*) filter (where m.role in ('owner','coach')) as staff
    from public.memberships m
    where m.club_id = p_club and m.status = 'active'
  )
  select case
    when p_role = 'runner' then plan.max_runners is null or counts.runners < plan.max_runners
    else plan.max_staff is null or counts.staff < plan.max_staff
  end
  from plan, counts
$$;

create or replace function public.join_club(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_club uuid;
  v_existing public.memberships;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select c.id into v_club from public.clubs c
  where c.invite_code = upper(p_code) and c.deleted_at is null;
  if v_club is null then
    raise exception 'invalid_invite_code' using errcode = 'P0002';
  end if;

  select * into v_existing from public.memberships m where m.club_id = v_club and m.user_id = v_uid;
  if found and v_existing.status = 'active' then
    return v_club; -- idempotente
  end if;

  if not public.club_can_add(v_club, 'runner') then
    raise exception 'plan_limit_runners' using errcode = 'P0001';
  end if;

  if found then
    update public.memberships set status = 'active' where id = v_existing.id;
  else
    insert into public.memberships (club_id, user_id, role) values (v_club, v_uid, 'runner');
  end if;

  return v_club;
end;
$$;

create or replace function public.regenerate_invite_code(p_club uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_staff(p_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.clubs set invite_code = public.gen_code(8) where id = p_club returning invite_code into v_code;
  return v_code;
end;
$$;

create or replace function public.accept_staff_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_inv public.staff_invitations;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_inv from public.staff_invitations i
  where i.token = p_token and i.accepted_at is null and i.expires_at > now();
  if not found then
    raise exception 'invalid_invitation' using errcode = 'P0002';
  end if;
  if v_inv.email <> v_email then
    raise exception 'invitation_email_mismatch' using errcode = '42501';
  end if;
  if not public.club_can_add(v_inv.club_id, 'coach') then
    raise exception 'plan_limit_staff' using errcode = 'P0001';
  end if;

  insert into public.memberships (club_id, user_id, role)
  values (v_inv.club_id, v_uid, 'coach')
  on conflict (club_id, user_id) do update set role = 'coach', status = 'active'
  where public.memberships.role <> 'owner';

  update public.staff_invitations set accepted_at = now() where id = v_inv.id;
  return v_inv.club_id;
end;
$$;

-- Lo que puede ver de una invitación alguien que todavía no es miembro
create or replace function public.staff_invitation_preview(p_token text)
returns table (club_name text, club_slug text, primary_color text, email text, expired boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.name, c.slug, c.primary_color, i.email,
         (i.expires_at < now() or i.accepted_at is not null)
  from public.staff_invitations i join public.clubs c on c.id = i.club_id
  where i.token = p_token
$$;

-- =============================================================================
-- Superadmin
-- =============================================================================
create or replace function public.admin_clubs_overview()
returns table (
  id uuid, slug text, name text, plan_code text, effective_plan text, plan_status public.plan_status,
  plan_override boolean, trial_ends_at timestamptz, runners bigint, staff bigint,
  sessions_30d bigint, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select c.id, c.slug, c.name, c.plan_code, public.club_effective_plan(c.id), c.plan_status,
         c.plan_override, c.trial_ends_at,
         (select count(*) from public.memberships m where m.club_id = c.id and m.status = 'active' and m.role = 'runner'),
         (select count(*) from public.memberships m where m.club_id = c.id and m.status = 'active' and m.role <> 'runner'),
         0::bigint,
         c.created_at
  from public.clubs c
  where c.deleted_at is null
  order by c.created_at desc;
end;
$$;

create or replace function public.admin_set_club_plan(
  p_club uuid, p_plan text, p_status public.plan_status, p_override boolean, p_trial_ends_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.clubs
     set plan_code = p_plan, plan_status = p_status, plan_override = p_override, trial_ends_at = p_trial_ends_at
   where id = p_club;
  insert into public.audit_log (club_id, actor_id, action, entity, entity_id, meta)
  values (p_club, auth.uid(), 'club.plan_changed', 'club', p_club::text,
          jsonb_build_object('plan', p_plan, 'status', p_status, 'override', p_override));
end;
$$;

-- Funciones internas: no se exponen a clientes anónimos.
revoke execute on function public.create_club(text, text, text) from public, anon;
revoke execute on function public.join_club(text) from public, anon;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
revoke execute on function public.accept_staff_invitation(text) from public, anon;
revoke execute on function public.admin_clubs_overview() from public, anon;
revoke execute on function public.admin_set_club_plan(uuid, text, public.plan_status, boolean, timestamptz) from public, anon;
grant execute on function public.create_club(text, text, text) to authenticated;
grant execute on function public.join_club(text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
grant execute on function public.accept_staff_invitation(text) to authenticated;
grant execute on function public.admin_clubs_overview() to authenticated;
grant execute on function public.admin_set_club_plan(uuid, text, public.plan_status, boolean, timestamptz) to authenticated;
