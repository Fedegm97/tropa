-- =============================================================================
-- Tropa · 0003 · Planes de entrenamiento
-- Los bloques se guardan como jsonb (se leen/escriben como unidad). El esquema
-- de validación vive en src/features/training/blocks.ts (Zod).
-- =============================================================================

create table public.session_templates (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  title      text not null check (char_length(btrim(title)) between 1 and 80),
  type       public.session_type not null,
  blocks     jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  notes      text check (char_length(notes) <= 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, id)
);

create index session_templates_club_idx on public.session_templates (club_id, title);
create trigger session_templates_updated_at before update on public.session_templates
  for each row execute function public.set_updated_at();

create table public.training_sessions (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs (id) on delete cascade,
  date         date not null,
  title        text not null check (char_length(btrim(title)) between 1 and 80),
  type         public.session_type not null,
  blocks       jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks) = 'array'),
  notes        text check (char_length(notes) <= 2000),
  audience     public.audience_kind not null default 'club',
  shift_id     uuid,
  template_id  uuid,
  created_by   uuid references public.profiles (id) on delete set null,
  published_at timestamptz, -- null = borrador
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (club_id, id),
  check ((audience = 'shift') = (shift_id is not null)),
  foreign key (club_id, shift_id) references public.shifts (club_id, id) on delete cascade,
  foreign key (club_id, template_id) references public.session_templates (club_id, id) on delete set null (template_id)
);

create index training_sessions_club_date_idx on public.training_sessions (club_id, date);
create trigger training_sessions_updated_at before update on public.training_sessions
  for each row execute function public.set_updated_at();

create table public.training_session_targets (
  club_id    uuid not null,
  session_id uuid not null,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  primary key (session_id, user_id),
  foreign key (club_id, session_id) references public.training_sessions (club_id, id) on delete cascade,
  foreign key (club_id, user_id) references public.memberships (club_id, user_id) on delete cascade
);

create index training_session_targets_user_idx on public.training_session_targets (club_id, user_id);

create table public.session_completions (
  club_id      uuid not null,
  session_id   uuid not null,
  user_id      uuid not null,
  feeling      smallint check (feeling between 1 and 5),
  comment      text check (char_length(comment) <= 500),
  completed_at timestamptz not null default now(),
  primary key (session_id, user_id),
  foreign key (user_id) references public.profiles (id) on delete cascade,
  foreign key (club_id, session_id) references public.training_sessions (club_id, id) on delete cascade,
  foreign key (club_id, user_id) references public.memberships (club_id, user_id) on delete cascade
);

create index session_completions_user_idx on public.session_completions (club_id, user_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- Visibilidad de una sesión para el usuario actual
-- ---------------------------------------------------------------------------
create or replace function public.can_view_session(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.training_sessions s
    where s.id = p_session
      and (
        public.is_staff(s.club_id)
        or (
          s.published_at is not null
          and public.is_member(s.club_id)
          and (
            s.audience = 'club'
            or (s.audience = 'shift' and s.shift_id = public.my_shift(s.club_id))
            or (s.audience = 'runners' and exists (
              select 1 from public.training_session_targets t
              where t.session_id = s.id and t.user_id = (select auth.uid())
            ))
          )
        )
      )
  )
$$;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.session_templates enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_session_targets enable row level security;
alter table public.session_completions enable row level security;

-- Biblioteca: solo staff
create policy "staff manage templates" on public.session_templates for all to authenticated
  using (club_id in (select public.my_staff_club_ids()))
  with check (club_id in (select public.my_staff_club_ids()));

-- Sesiones: staff todo; corredor solo las publicadas que le tocan
create policy "read visible sessions" on public.training_sessions for select to authenticated
  using (
    club_id in (select public.my_staff_club_ids())
    or (
      published_at is not null
      and club_id in (select public.my_club_ids())
      and (
        audience = 'club'
        or (audience = 'shift' and shift_id = public.my_shift(club_id))
        or (audience = 'runners' and exists (
          select 1 from public.training_session_targets t
          where t.session_id = training_sessions.id and t.user_id = (select auth.uid())
        ))
      )
    )
  );
create policy "staff insert sessions" on public.training_sessions for insert to authenticated
  with check (club_id in (select public.my_staff_club_ids()));
create policy "staff update sessions" on public.training_sessions for update to authenticated
  using (club_id in (select public.my_staff_club_ids()))
  with check (club_id in (select public.my_staff_club_ids()));
create policy "staff delete sessions" on public.training_sessions for delete to authenticated
  using (club_id in (select public.my_staff_club_ids()));

-- Targets: el corredor ve los suyos; staff gestiona
create policy "read own targets or as staff" on public.training_session_targets for select to authenticated
  using (user_id = (select auth.uid()) or club_id in (select public.my_staff_club_ids()));
create policy "staff manage targets" on public.training_session_targets for insert to authenticated
  with check (club_id in (select public.my_staff_club_ids()));
create policy "staff delete targets" on public.training_session_targets for delete to authenticated
  using (club_id in (select public.my_staff_club_ids()));

-- Completadas: el corredor las suyas (solo de sesiones que puede ver); staff lee todas
create policy "read own completions or as staff" on public.session_completions for select to authenticated
  using (user_id = (select auth.uid()) or club_id in (select public.my_staff_club_ids()));
create policy "runner completes visible session" on public.session_completions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and club_id in (select public.my_club_ids())
    and public.can_view_session(session_id)
  );
create policy "runner edits own completion" on public.session_completions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_view_session(session_id));
create policy "runner deletes own completion" on public.session_completions for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Duplicar una semana de sesiones (lunes → lunes) — útil para el coach
-- ---------------------------------------------------------------------------
create or replace function public.duplicate_week(p_club uuid, p_from_monday date, p_to_monday date)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int := 0;
  r record;
  v_new uuid;
begin
  if not public.is_staff(p_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if extract(isodow from p_from_monday) <> 1 or extract(isodow from p_to_monday) <> 1 then
    raise exception 'dates_must_be_mondays' using errcode = '22023';
  end if;

  for r in
    select * from public.training_sessions s
    where s.club_id = p_club and s.date between p_from_monday and p_from_monday + 6
  loop
    insert into public.training_sessions (club_id, date, title, type, blocks, notes, audience, shift_id, template_id, created_by, published_at)
    values (r.club_id, r.date + (p_to_monday - p_from_monday), r.title, r.type, r.blocks, r.notes,
            r.audience, r.shift_id, r.template_id, auth.uid(), null)
    returning id into v_new;

    insert into public.training_session_targets (club_id, session_id, user_id)
    select t.club_id, v_new, t.user_id from public.training_session_targets t where t.session_id = r.id;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Resumen semanal del corredor: planificadas vs. completadas por día
create or replace function public.my_week(p_club uuid, p_monday date)
returns table (day date, planned int, completed int)
language sql
stable
security invoker
set search_path = ''
as $$
  select d::date,
         count(s.id) filter (where s.type <> 'rest')::int,
         count(c.session_id) filter (where s.type <> 'rest')::int
  from generate_series(p_monday, p_monday + 6, interval '1 day') d
  left join public.training_sessions s on s.club_id = p_club and s.date = d::date and s.published_at is not null
  left join public.session_completions c on c.session_id = s.id and c.user_id = (select auth.uid())
  group by d
  order by d
$$;

-- Actualiza el overview del superadmin con actividad real
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
         (select count(*) from public.session_completions sc where sc.club_id = c.id and sc.completed_at > now() - interval '30 days'),
         c.created_at
  from public.clubs c
  where c.deleted_at is null
  order by c.created_at desc;
end;
$$;
