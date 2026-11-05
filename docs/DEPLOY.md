# Deploy a producción

Supabase Cloud + Vercel, con el dominio `tropa.app` y el wildcard `*.tropa.app`.

## 1. Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com) (región São Paulo para Argentina). Usá el **plan Pro** cuando haya datos reales: incluye backups diarios y PITR opcional.
2. Vinculá y subí las migraciones:
   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push        # aplica supabase/migrations (NO corre el seed)
   ```
3. **Auth → URL Configuration**
   - Site URL: `https://tropa.app`
   - Redirect URLs: `https://tropa.app/**` y `https://*.tropa.app/**`
4. **Auth → Providers**
   - Email: habilitado (mail mágico). Configurá un SMTP propio (Resend, Postmark) en *Auth → SMTP*: el SMTP por defecto tiene límites muy bajos.
   - Google: creá un OAuth Client en Google Cloud con redirect `https://<ref>.supabase.co/auth/v1/callback` y pegá client id/secret.
5. **Plantilla del mail mágico** (*Auth → Email Templates → Magic Link*): texto en español, por ejemplo
   `Tocá el botón para entrar a la app de tu club: {{ .ConfirmationURL }}`.
6. **Jobs (pg_cron)**: la migración `…_cron.sql` agenda `push-dispatch` cada minuto. Cargá los secretos en el SQL editor:
   ```sql
   select vault.create_secret('https://tropa.app', 'app_url');
   select vault.create_secret('<el mismo CRON_SECRET de Vercel>', 'cron_secret');
   ```
   Si las extensiones `pg_cron` / `pg_net` no estaban habilitadas cuando corriste `db push`, habilitalas en *Database → Extensions* y volvé a correr la migración `20261105000600_cron.sql` desde el SQL editor.
7. Superadmin: registrate en `https://tropa.app/ingresar` y después, en el SQL editor:
   ```sql
   update public.profiles set is_superadmin = true where id = (select id from auth.users where email = 'tu@email.com');
   ```

## 2. Vercel

1. Importá el repo. Framework: Next.js. Build: `pnpm build`.
2. **Variables de entorno** (Production y Preview): todas las de `.env.example`, con `NEXT_PUBLIC_ROOT_DOMAIN=tropa.app`.
3. **Dominios**: agregá `tropa.app`, `www.tropa.app` (redirect al apex) y `*.tropa.app`.
   El wildcard requiere que el dominio use los **nameservers de Vercel** (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`), así Vercel emite el certificado wildcard.
4. Deploy. Probá:
   - `https://tropa.app` → landing
   - `https://tropa.app/crear` → alta de un club
   - `https://{slug}.tropa.app/manifest.webmanifest` → manifest con el nombre del club

> Alternativa Cloudflare Pages: funciona con `@opennextjs/cloudflare`, pero `after()` y el runtime de Node para `web-push` requieren configuración extra. Para los pilotos recomendamos Vercel.

## 3. Web Push

1. `pnpm vapid:generate` **una sola vez** y guardá las claves: si cambian, todas las suscripciones existentes dejan de funcionar.
2. iOS solo recibe push con la app instalada en la pantalla de inicio (iOS 16.4+). La guía `/instalar` lo explica.

## 4. Checklist antes de sumar un piloto

- [ ] `pnpm test` y `pnpm test:rls` en verde (CI).
- [ ] Mail mágico llega y el link abre la app del club correcto.
- [ ] Instalación en un iPhone y un Android reales, con push recibido.
- [ ] El club tiene plan asignado desde `/admin` (marcá "Piloto" para fijarlo).
- [ ] Backups activos (plan Pro).
