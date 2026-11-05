-- =============================================================================
-- Tropa · 0001 · Base: extensiones, enums y utilidades
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums (códigos en inglés; las etiquetas en español viven en la UI)
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'coach', 'runner');
create type public.member_status as enum ('active', 'inactive');
create type public.runner_level as enum ('beginner', 'intermediate', 'advanced');
create type public.pace_kind as enum ('5k', 'threshold');
create type public.plan_status as enum ('trialing', 'active', 'past_due', 'canceled');
create type public.session_type as enum (
  'easy_run',  -- rodaje
  'intervals', -- pasadas
  'long_run',  -- fondo
  'fartlek',
  'hills',     -- cuestas
  'strength',  -- fuerza
  'rest'       -- descanso
);
create type public.audience_kind as enum ('club', 'shift', 'runners');
create type public.push_status as enum ('pending', 'processing', 'sent', 'failed', 'skipped');

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- ¿La sesión actual es "privilegiada"? (service role, migraciones, funciones
-- SECURITY DEFINER que corren como el owner). Se usa en triggers que protegen
-- columnas sensibles (plan, rol, etc.).
-- ---------------------------------------------------------------------------
create or replace function public.is_privileged()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('postgres', 'service_role', 'supabase_admin')
$$;

-- ---------------------------------------------------------------------------
-- Códigos aleatorios legibles (sin 0/O/1/I/L) para invitaciones
-- ---------------------------------------------------------------------------
create or replace function public.gen_code(p_len int default 8)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(p_len);
  result text := '';
begin
  for i in 0 .. p_len - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

-- Path de storage → club_id (primer segmento), sin romper si no es uuid.
create or replace function public.club_id_from_path(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;
