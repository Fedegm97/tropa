-- =============================================================================
-- Tropa · 0006 · Jobs programados (pg_cron + pg_net)
--
-- Cada minuto se le pide a la app que vacíe la cola de push (red de seguridad:
-- normalmente se vacía sola con after() justo después de cada mutación).
--
-- Requiere dos secretos en Vault (ver docs/DEPLOY.md):
--   select vault.create_secret('https://tropa.app', 'app_url');
--   select vault.create_secret('<CRON_SECRET>',      'cron_secret');
--
-- Si pg_cron/pg_net no están disponibles (p. ej. el Postgres de los tests),
-- la migración no hace nada.
-- =============================================================================

do $migration$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron/pg_net no disponibles: se omiten los jobs';
    return;
  end if;

  create extension if not exists pg_cron;
  create extension if not exists pg_net with schema extensions;

  execute $fn$
    create or replace function public.invoke_app_job(p_path text)
    returns void
    language plpgsql
    security definer
    set search_path = ''
    as $body$
    declare
      v_url text;
      v_secret text;
    begin
      select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url';
      select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
      if v_url is null or v_secret is null then
        return;
      end if;
      perform net.http_post(
        url := v_url || p_path,
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
        body := '{}'::jsonb
      );
    end;
    $body$;
  $fn$;

  execute 'revoke execute on function public.invoke_app_job(text) from public, anon, authenticated';

  perform cron.schedule('push-dispatch', '* * * * *', $$select public.invoke_app_job('/api/jobs/push')$$);
end;
$migration$;
