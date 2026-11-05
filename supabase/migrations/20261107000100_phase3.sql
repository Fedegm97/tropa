-- =============================================================================
-- Tropa · 0008 · Fase 3: tienda, suscripciones de la plataforma y envío al reloj
-- =============================================================================

-- Planes: precio en pesos para Mercado Pago (lo edita el superadmin) y la nueva feature
-- de envío al reloj (planes pagos).
alter table public.platform_plans add column price_ars_cents bigint;
update public.platform_plans set price_ars_cents = case code when 'coach' then 1999900 when 'team' then 4999900 else null end;
update public.platform_plans set features = features || array['watch_sync'] where code in ('coach', 'team', 'club');

alter table public.clubs add column trial_used boolean not null default false;

create type public.order_status as enum ('pending_payment', 'paid', 'delivered', 'canceled');
create type public.subscription_status as enum ('pending', 'authorized', 'paused', 'cancelled');
create type public.watch_sync_status as enum ('queued', 'sending', 'on_watch', 'failed');

-- =============================================================================
-- Tienda
-- =============================================================================
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  description text check (char_length(description) <= 1000),
  photo_path  text,
  price_cents bigint not null check (price_cents >= 0),
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (club_id, id)
);

create index products_club_idx on public.products (club_id, sort, name);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null,
  product_id uuid not null,
  size       text check (char_length(size) <= 20), -- null = talle único
  stock      int not null default 0 check (stock >= 0),
  sort       int not null default 0,
  unique (club_id, id),
  unique nulls not distinct (product_id, size),
  foreign key (club_id, product_id) references public.products (club_id, id) on delete cascade
);

create table public.club_counters (
  club_id uuid not null references public.clubs (id) on delete cascade,
  key     text not null,
  value   bigint not null default 0,
  primary key (club_id, key)
);

create table public.orders (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null,
  number      int not null,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  status      public.order_status not null default 'pending_payment',
  total_cents bigint not null check (total_cents >= 0),
  note        text check (char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (club_id, id),
  unique (club_id, number),
  foreign key (club_id, user_id) references public.memberships (club_id, user_id) on delete cascade
);

create index orders_club_status_idx on public.orders (club_id, status, created_at desc);
create index orders_user_idx on public.orders (club_id, user_id, created_at desc);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null,
  order_id         uuid not null,
  variant_id       uuid,
  product_name     text not null,  -- copia: el pedido no cambia si después se edita el producto
  size             text,
  quantity         int not null check (quantity between 1 and 20),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  foreign key (club_id, order_id) references public.orders (club_id, id) on delete cascade,
  foreign key (club_id, variant_id) references public.product_variants (club_id, id) on delete set null (variant_id)
);

create index order_items_order_idx on public.order_items (order_id);

create or replace function public.next_counter(p_club uuid, p_key text)
returns bigint
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.club_counters (club_id, key, value) values (p_club, p_key, 1)
  on conflict (club_id, key) do update set value = public.club_counters.value + 1
  returning value
$$;
revoke execute on function public.next_counter(uuid, text) from public, anon, authenticated;

-- Hacer un pedido: precios y stock salen de la base (nunca del cliente), con lock por variante.
-- p_items: [{"variant_id": "...", "quantity": 2}, ...]
create or replace function public.place_order(p_club uuid, p_items jsonb, p_note text default null)
returns table (order_id uuid, order_number int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_order uuid;
  v_number int;
  v_total bigint := 0;
  v_name text;
  it record;
begin
  if not public.is_member(p_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public.club_has_feature(p_club, 'store') then
    raise exception 'feature_not_in_plan' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 20 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  v_number := public.next_counter(p_club, 'order')::int;
  insert into public.orders (club_id, number, user_id, total_cents, note)
  values (p_club, v_number, v_uid, 0, left(nullif(btrim(p_note), ''), 300))
  returning id into v_order;

  for it in
    select v.id as variant_id, v.size, v.stock, p.name, p.price_cents, p.active, (x ->> 'quantity')::int as qty
    from jsonb_array_elements(p_items) x
    join public.product_variants v on v.id = (x ->> 'variant_id')::uuid and v.club_id = p_club
    join public.products p on p.id = v.product_id
    order by v.id
    for update of v
  loop
    if not it.active then
      raise exception 'product_inactive' using errcode = '22023';
    end if;
    if it.qty is null or it.qty < 1 or it.qty > 20 then
      raise exception 'invalid_quantity' using errcode = '22023';
    end if;
    if it.stock < it.qty then
      raise exception 'out_of_stock:%', it.name using errcode = 'P0001';
    end if;
    update public.product_variants set stock = stock - it.qty where id = it.variant_id;
    insert into public.order_items (club_id, order_id, variant_id, product_name, size, quantity, unit_price_cents)
    values (p_club, v_order, it.variant_id, it.name, it.size, it.qty, it.price_cents);
    v_total := v_total + it.price_cents * it.qty;
  end loop;

  if not exists (select 1 from public.order_items oi where oi.order_id = v_order) then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  if (select count(*) from public.order_items oi where oi.order_id = v_order) <> jsonb_array_length(p_items) then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  update public.orders set total_cents = v_total where id = v_order;

  select full_name into v_name from public.profiles where id = v_uid;
  insert into public.notifications (club_id, user_id, kind, title, body, url)
  select p_club, m.user_id, 'order_new', 'Nuevo pedido #' || v_number,
         coalesce(v_name, 'Un corredor') || ' · $' || replace(to_char(v_total / 100, 'FM999,999,990'), ',', '.'),
         '/tienda/pedidos'
  from public.memberships m
  where m.club_id = p_club and m.status = 'active' and m.role in ('owner', 'coach');

  return query select v_order, v_number;
end;
$$;

revoke execute on function public.place_order(uuid, jsonb, text) from public, anon;
grant execute on function public.place_order(uuid, jsonb, text) to authenticated;

-- Cambiar estado: staff (pagado / entregado / cancelado) o el propio corredor (solo cancelar si está pendiente).
-- Cancelar devuelve el stock.
create or replace function public.set_order_status(p_order uuid, p_status public.order_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_staff boolean;
begin
  select * into o from public.orders where id = p_order for update;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_staff := public.is_staff(o.club_id);
  if not v_staff and not (o.user_id = auth.uid() and p_status = 'canceled' and o.status = 'pending_payment') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if o.status = p_status then
    return;
  end if;
  if o.status = 'canceled' then
    raise exception 'order_canceled' using errcode = '22023';
  end if;

  if p_status = 'canceled' then
    update public.product_variants v set stock = v.stock + oi.quantity
    from public.order_items oi where oi.order_id = o.id and oi.variant_id = v.id;
  end if;

  update public.orders set status = p_status where id = o.id;

  if v_staff and o.user_id <> auth.uid() then
    insert into public.notifications (club_id, user_id, kind, title, body, url)
    values (o.club_id, o.user_id, 'order_status', 'Pedido #' || o.number,
            case p_status when 'paid' then 'Recibimos tu pago. ¡Gracias!'
                          when 'delivered' then 'Tu pedido fue entregado.'
                          when 'canceled' then 'Tu pedido fue cancelado.'
                          else 'Tu pedido cambió de estado.' end,
            '/tienda/pedidos');
  end if;
end;
$$;

revoke execute on function public.set_order_status(uuid, public.order_status) from public, anon;
grant execute on function public.set_order_status(uuid, public.order_status) to authenticated;

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.club_counters enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "members read active products" on public.products for select to authenticated
  using (club_id in (select public.my_staff_club_ids()) or (active and club_id in (select public.my_club_ids())));
create policy "staff insert products" on public.products for insert to authenticated
  with check (club_id in (select public.my_staff_club_ids()) and public.club_has_feature(club_id, 'store'));
create policy "staff update products" on public.products for update to authenticated
  using (club_id in (select public.my_staff_club_ids()))
  with check (club_id in (select public.my_staff_club_ids()));
create policy "staff delete products" on public.products for delete to authenticated
  using (club_id in (select public.my_staff_club_ids()));

create policy "members read variants" on public.product_variants for select to authenticated
  using (club_id in (select public.my_club_ids()));
create policy "staff manage variants" on public.product_variants for all to authenticated
  using (club_id in (select public.my_staff_club_ids()))
  with check (club_id in (select public.my_staff_club_ids()));

create policy "staff read counters" on public.club_counters for select to authenticated
  using (club_id in (select public.my_staff_club_ids()));

-- Pedidos: solo por RPC. Lectura: el dueño o el staff.
create policy "read own orders or as staff" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or club_id in (select public.my_staff_club_ids()));
create policy "read items of visible orders" on public.order_items for select to authenticated
  using (
    club_id in (select public.my_staff_club_ids())
    or exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = (select auth.uid()))
  );

-- =============================================================================
-- Suscripciones de la plataforma (Mercado Pago hoy, Stripe después)
-- =============================================================================
create table public.platform_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references public.clubs (id) on delete cascade,
  provider           text not null check (provider in ('mercadopago', 'stripe', 'fake')),
  external_id        text not null,
  plan_code          text not null references public.platform_plans (code),
  status             public.subscription_status not null default 'pending',
  current_period_end timestamptz,
  payer_email        text,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  raw                jsonb not null default '{}'::jsonb,
  unique (provider, external_id)
);

create index platform_subscriptions_club_idx on public.platform_subscriptions (club_id, created_at desc);
create trigger platform_subscriptions_updated_at before update on public.platform_subscriptions
  for each row execute function public.set_updated_at();

-- Webhooks recibidos (idempotencia + auditoría). Sin acceso desde clientes.
create table public.billing_events (
  id           bigint generated always as identity primary key,
  provider     text not null,
  event_id     text not null,
  type         text,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text,
  unique (provider, event_id)
);

alter table public.platform_subscriptions enable row level security;
alter table public.billing_events enable row level security;

create policy "owner reads subscriptions" on public.platform_subscriptions for select to authenticated
  using (public.is_owner(club_id) or public.is_superadmin());
-- billing_events: sin políticas → solo service_role.

-- Prueba gratis de 30 días, sin tarjeta, una vez por club.
create or replace function public.start_trial(p_club uuid, p_plan text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club public.clubs;
  v_end timestamptz := now() + interval '30 days';
begin
  if not public.is_owner(p_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_plan not in ('coach', 'team') then
    raise exception 'invalid_plan' using errcode = '22023';
  end if;
  select * into v_club from public.clubs where id = p_club for update;
  if v_club.trial_used then
    raise exception 'trial_already_used' using errcode = 'P0001';
  end if;
  if public.club_effective_plan(p_club) <> 'free' then
    raise exception 'already_on_paid_plan' using errcode = 'P0001';
  end if;
  update public.clubs
     set plan_code = p_plan, plan_status = 'trialing', trial_ends_at = v_end, trial_used = true
   where id = p_club;
  insert into public.audit_log (club_id, actor_id, action, entity, entity_id, meta)
  values (p_club, auth.uid(), 'club.trial_started', 'club', p_club::text, jsonb_build_object('plan', p_plan, 'ends_at', v_end));
  return v_end;
end;
$$;

revoke execute on function public.start_trial(uuid, text) from public, anon;
grant execute on function public.start_trial(uuid, text) to authenticated;

-- Aplica el estado de una suscripción (lo llama el webhook con service_role, después de
-- consultar el estado real al proveedor). Un club con plan "piloto" no se toca.
create or replace function public.apply_subscription(
  p_provider text, p_external_id text, p_club uuid, p_plan text,
  p_status public.subscription_status, p_period_end timestamptz default null,
  p_payer_email text default null, p_raw jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club public.clubs;
begin
  select * into v_club from public.clubs where id = p_club for update;
  if not found then
    raise exception 'club_not_found' using errcode = 'P0002';
  end if;

  insert into public.platform_subscriptions (club_id, provider, external_id, plan_code, status, current_period_end, payer_email, raw)
  values (p_club, p_provider, p_external_id, p_plan, p_status, p_period_end, p_payer_email, coalesce(p_raw, '{}'::jsonb))
  on conflict (provider, external_id) do update
    set status = excluded.status, plan_code = excluded.plan_code, current_period_end = excluded.current_period_end,
        payer_email = coalesce(excluded.payer_email, public.platform_subscriptions.payer_email), raw = excluded.raw;

  if v_club.plan_override then
    return;
  end if;

  if p_status = 'authorized' then
    update public.clubs set plan_code = p_plan, plan_status = 'active', trial_ends_at = null where id = p_club;
  elsif p_status = 'paused' then
    update public.clubs set plan_status = 'past_due' where id = p_club and plan_code = p_plan;
  elsif p_status = 'cancelled' then
    -- Solo baja el plan si no hay otra suscripción activa del club
    if not exists (select 1 from public.platform_subscriptions s
                   where s.club_id = p_club and s.status = 'authorized' and not (s.provider = p_provider and s.external_id = p_external_id)) then
      update public.clubs set plan_status = 'canceled' where id = p_club and plan_status <> 'trialing';
    end if;
  end if;

  insert into public.audit_log (club_id, action, entity, entity_id, meta)
  values (p_club, 'subscription.' || p_status, 'subscription', p_external_id, jsonb_build_object('provider', p_provider, 'plan', p_plan));
end;
$$;

revoke execute on function public.apply_subscription(text, text, uuid, text, public.subscription_status, timestamptz, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_subscription(text, text, uuid, text, public.subscription_status, timestamptz, text, jsonb) to service_role;

-- =============================================================================
-- Envío de sesiones al reloj (Garmin Connect Training API)
-- =============================================================================
create table public.watch_connections (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  provider         text not null check (provider in ('garmin', 'fake')),
  external_user_id text,
  access_token     text,
  refresh_token    text,
  expires_at       timestamptz,
  connected_at     timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.watch_connections enable row level security;
create policy "read own watch connection" on public.watch_connections for select to authenticated
  using (user_id = (select auth.uid()));
create policy "disconnect own watch" on public.watch_connections for delete to authenticated
  using (user_id = (select auth.uid()));
-- Los tokens nunca se exponen a clientes (ni siquiera al dueño): solo service_role los lee.
revoke select on public.watch_connections from authenticated, anon;
grant select (user_id, provider, external_user_id, connected_at) on public.watch_connections to authenticated;

create table public.watch_syncs (
  id                  uuid primary key default gen_random_uuid(),
  club_id             uuid not null,
  session_id          uuid not null,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  provider            text not null,
  status              public.watch_sync_status not null default 'queued',
  external_workout_id text,
  error               text,
  attempts            smallint not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (session_id, user_id, provider),
  foreign key (club_id, session_id) references public.training_sessions (club_id, id) on delete cascade,
  foreign key (club_id, user_id) references public.memberships (club_id, user_id) on delete cascade
);

create index watch_syncs_status_idx on public.watch_syncs (status, created_at) where status in ('queued', 'sending');
create trigger watch_syncs_updated_at before update on public.watch_syncs
  for each row execute function public.set_updated_at();

alter table public.watch_syncs enable row level security;
create policy "read own syncs or as staff" on public.watch_syncs for select to authenticated
  using (user_id = (select auth.uid()) or club_id in (select public.my_staff_club_ids()));

-- Pedir el envío: el corredor, para una sesión que puede ver, con el reloj conectado.
create or replace function public.request_watch_sync(p_session uuid, p_provider text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_club uuid;
  v_id uuid;
begin
  select club_id into v_club from public.training_sessions where id = p_session;
  if v_club is null or not public.can_view_session(p_session) or not public.is_member(v_club) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not public.club_has_feature(v_club, 'watch_sync') then
    raise exception 'feature_not_in_plan' using errcode = '42501';
  end if;
  if not exists (select 1 from public.watch_connections w where w.user_id = auth.uid() and w.provider = p_provider) then
    raise exception 'watch_not_connected' using errcode = 'P0001';
  end if;
  insert into public.watch_syncs (club_id, session_id, user_id, provider)
  values (v_club, p_session, auth.uid(), p_provider)
  on conflict (session_id, user_id, provider) do update
    set status = 'queued', error = null, attempts = 0
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.request_watch_sync(uuid, text) from public, anon;
grant execute on function public.request_watch_sync(uuid, text) to authenticated;

-- El worker reclama envíos pendientes (service_role)
create or replace function public.claim_watch_syncs(p_limit int default 20)
returns setof public.watch_syncs
language sql
volatile
security definer
set search_path = ''
as $$
  update public.watch_syncs w
     set status = 'sending', attempts = w.attempts + 1
   where w.id in (
     select id from public.watch_syncs
     where status = 'queued' or (status = 'sending' and updated_at < now() - interval '5 minutes' and attempts < 3)
     order by created_at
     limit p_limit
     for update skip locked
   )
  returning w.*
$$;

revoke execute on function public.claim_watch_syncs(int) from public, anon, authenticated;
grant execute on function public.claim_watch_syncs(int) to service_role;

-- =============================================================================
-- Aviso al owner 3 días antes de que termine la prueba gratis (se suma a los recordatorios)
-- =============================================================================
create or replace function public.run_trial_reminders(p_now timestamptz default now())
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  n int := 0;
begin
  for c in
    select cl.id, cl.trial_ends_at, cl.plan_code, m.user_id
    from public.clubs cl
    join public.memberships m on m.club_id = cl.id and m.role = 'owner' and m.status = 'active'
    where cl.plan_status = 'trialing' and not cl.plan_override
      and (cl.trial_ends_at at time zone cl.timezone)::date - (p_now at time zone cl.timezone)::date in (3, 0)
  loop
    if public.log_reminder(c.id, c.user_id, 'trial_end', (c.trial_ends_at)::date) then
      insert into public.notifications (club_id, user_id, kind, title, body, url)
      values (c.id, c.user_id, 'trial_ending', 'Tu prueba gratis termina pronto',
              'Suscribite para seguir usando cuotas, aptos y el resto de las funciones del plan.', '/ajustes/plan');
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

revoke execute on function public.run_trial_reminders(timestamptz) from public, anon, authenticated;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('trial-reminders', '20 12 * * *', $$select public.run_trial_reminders()$$);
    perform cron.schedule('watch-dispatch', '* * * * *', $$select public.invoke_app_job('/api/jobs/watch')$$);
  end if;
end;
$cron$;

-- Superadmin: estado de la suscripción
drop function public.admin_clubs_overview();
create function public.admin_clubs_overview()
returns table (
  id uuid, slug text, name text, plan_code text, effective_plan text, plan_status public.plan_status,
  plan_override boolean, trial_ends_at timestamptz, runners bigint, staff bigint,
  sessions_30d bigint, created_at timestamptz, subscription_status public.subscription_status, subscription_provider text
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
         c.created_at,
         s.status, s.provider
  from public.clubs c
  left join lateral (
    select ps.status, ps.provider from public.platform_subscriptions ps
    where ps.club_id = c.id order by ps.created_at desc limit 1
  ) s on true
  where c.deleted_at is null
  order by c.created_at desc;
end;
$$;
revoke execute on function public.admin_clubs_overview() from public, anon;
grant execute on function public.admin_clubs_overview() to authenticated;

-- El guard de clubs también protege trial_used
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
     or new.trial_used is distinct from old.trial_used
     or new.plan_override is distinct from old.plan_override
     or new.custom_domain is distinct from old.custom_domain
     or new.created_by is distinct from old.created_by
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'forbidden: billing columns are managed by the platform' using errcode = '42501';
  end if;
  if new.slug is distinct from old.slug and old.onboarding_step >= 2 then
    raise exception 'forbidden: slug is locked after onboarding' using errcode = '42501';
  end if;
  return new;
end;
$$;
