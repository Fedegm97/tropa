# Tropa

Plataforma SaaS de marca blanca para running teams. Cada club tiene su propia app (nombre, color, logo y subdominio) que sus corredores instalan como PWA desde el navegador, sin pasar por las stores.

- **Corredor:** ve su plan del día con ritmos calculados para él, marca sesiones como hechas, recibe avisos con push.
- **Coach:** arma planes por bloques, segmenta por turno o corredor, ve quién completó, publica avisos.
- **Owner:** configura la marca, invita coaches y corredores, administra turnos y el plan.

> Estado: **Fase 1 (MVP para pilotos)**. Ver [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript, Tailwind v4, componentes estilo shadcn/ui |
| Formularios | React Hook Form + Zod |
| Backend | Supabase: Postgres + Auth + Storage + RLS + pg_cron |
| PWA | Service worker propio (`public/sw.js`), manifest e íconos generados por club |
| Push | Web Push (VAPID) con cola en Postgres y envío en segundo plano |
| Tests | Vitest (unitarios + aislamiento RLS contra Postgres real) |

## Arquitectura en 30 segundos

```
rionorte.tropa.app/plan ──► src/proxy.ts ──► rewrite ──► app/c/[club]/(app)/plan
tropa.app/…            ──► landing, alta de clubes (/crear), superadmin (/admin)
*/auth/*, */api/*      ──► compartidas (no se reescriben)
```

- **Tenancy:** cada tabla de negocio tiene `club_id` + RLS. Las FK compuestas `(club_id, parent_id)` hacen imposible mezclar datos entre clubes, incluso con un bug en la app.
- **Sesión compartida:** la cookie de Supabase va al dominio `.tropa.app`, así quien crea su club en `tropa.app` entra directo a `{slug}.tropa.app`.
- **Push:** las mutaciones solo insertan filas en `notifications` (outbox). El envío lo hace `dispatchPendingPush()` con `after()` (después de responder) y, como respaldo, pg_cron cada minuto llama a `/api/jobs/push`.

Detalle completo en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Levantar en local

Requisitos: Node 22, pnpm 10, Docker.

```bash
pnpm install
pnpm db:start          # Supabase local: aplica migraciones + seed (imprime las keys)
cp .env.example .env.local
#   completar NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY con lo que imprimió db:start
pnpm vapid:generate    # pegar las claves en NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
pnpm dev
```

Abrí:

| URL | Qué es |
|-----|--------|
| http://lvh.me:3000 | Landing y alta de clubes |
| http://rionorte.lvh.me:3000 | App del club de ejemplo |
| http://lvh.me:3000/admin | Superadmin |
| http://127.0.0.1:54324 | Mailpit (los mails mágicos llegan acá) |

`lvh.me` y sus subdominios resuelven a `127.0.0.1` y permiten compartir la cookie entre subdominios. `*.localhost` también funciona, pero ahí cada subdominio pide login por separado.

### Usuarios del seed (contraseña `tropa1234`)

En la pantalla de ingreso tocá **"Tengo contraseña"**.

| Email | Rol |
|-------|-----|
| `laura@rionorte.test` | Owner + coach de Río Norte (turno Mañana) |
| `diego@rionorte.test` | Coach (turno Noche) |
| `corredor1@rionorte.test` … `corredor20@rionorte.test` | Corredores (1–11 Mañana, 12–18 Noche, 19–20 sin turno) |
| `admin@tropa.test` | Superadmin de la plataforma (sin club) |

Link de invitación del club de ejemplo: http://rionorte.lvh.me:3000/unirme/RIONORTE

## Scripts

| Script | Qué hace |
|--------|----------|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` · `pnpm typecheck` | ESLint · TypeScript |
| `pnpm test` | Tests unitarios (ritmos, cuotas, apto, planes, hosts, colores) |
| `pnpm test:rls` | Tests de aislamiento entre clubes contra la base local (requiere `db:start`) |
| `pnpm db:start` / `db:reset` | Supabase local / reaplicar migraciones + seed |
| `pnpm db:types` | Regenera `src/lib/supabase/database.types.ts` |
| `pnpm vapid:generate` | Claves VAPID para Web Push |

## Variables de entorno

| Variable | Dónde | Descripción |
|----------|-------|-------------|
| `NEXT_PUBLIC_ROOT_DOMAIN` | cliente + servidor | Dominio raíz, con puerto en dev (`lvh.me:3000`, prod `tropa.app`) |
| `NEXT_PUBLIC_PLATFORM_NAME` | cliente | Nombre de la plataforma (firma "con tecnología de …") |
| `NEXT_PUBLIC_SUPABASE_URL` | cliente + servidor | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente + servidor | Clave pública (anon / publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo servidor** | Para el worker de push y jobs. Nunca se usa para leer datos de usuarios |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | cliente + servidor | Clave pública VAPID |
| `VAPID_PRIVATE_KEY` | **solo servidor** | Clave privada VAPID |
| `VAPID_SUBJECT` | servidor | `mailto:` de contacto para los push services |
| `CRON_SECRET` | servidor | Secreto compartido con pg_cron / Vercel Cron para `/api/jobs/*` |
| `SUPABASE_DB_URL` | tests | Opcional; por defecto la base de `supabase start` |

## Deploy

Paso a paso en [`docs/DEPLOY.md`](docs/DEPLOY.md) (Supabase Cloud + Vercel con dominio wildcard).

## Estructura

```
src/
  proxy.ts                    # tenant por subdominio + refresh de sesión
  app/
    (root)/                   # tropa.app: landing, /ingresar, /crear, /admin
    c/[club]/                 # app de cada club (destino del rewrite)
      (app)/                  # requiere sesión + membership: inicio, plan, avisos, corredores, turnos, perfil, ajustes, onboarding
      ingresar/ unirme/[code]/ invitacion/[token]/ instalar/ sin-acceso/
      manifest.webmanifest/   # manifest dinámico
      icon/[variant]/         # íconos PWA generados (192, 512, maskable, apple, favicon, badge)
    auth/                     # callback de mail mágico / Google, logout
    api/jobs/push/            # vaciar cola de push (pg_cron / Vercel Cron)
  features/<módulo>/          # schemas (Zod), actions (Server Actions), componentes
  lib/
    domain/                   # lógica pura y testeada: pace, fees, medical, plans, dates, color, slug
    supabase/                 # clientes server / browser / admin + tipos generados
    push/dispatch.ts          # worker de Web Push
  components/                 # ui, shell, brand, pwa
supabase/
  migrations/                 # esquema + RLS + RPCs + storage + cron
  seed.sql                    # Río Norte Running Team
tests/
  unit/                       # Vitest
  rls/                        # aislamiento entre clubes (Postgres real)
```
