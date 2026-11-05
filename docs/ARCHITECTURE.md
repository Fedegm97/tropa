# Arquitectura

## Multi-tenancy

- **Resolución del club:** `src/proxy.ts` lee el host (`{slug}.tropa.app`) y reescribe internamente a `/c/{slug}/…`. La URL que ve el usuario no cambia. `/auth/*` y `/api/*` no se reescriben (funcionan en cualquier host). Entrar directo a `/c/…` devuelve 404.
- **Server Actions:** el club se toma del header `host`, **nunca** de un parámetro enviado por el cliente (`actionClub()` / `actionStaff()` en `src/lib/club.ts`). Igual, la autorización real la hace RLS.
- **Datos:** toda tabla de negocio tiene `club_id NOT NULL` + RLS. Las tablas hijas usan FK compuestas `(club_id, parent_id) → parent(club_id, id)`, así una fila de un club no puede apuntar a datos de otro.
- **Usuarios en varios clubes:** `memberships(club_id, user_id, role)`. Cada club es un origen distinto → una PWA y una suscripción push por club.

## Esquema (Fase 1)

| Tabla | Clave | Notas |
|-------|-------|-------|
| `platform_plans` | `code` | Catálogo: límites (`max_runners`, `max_staff`) y `features[]` |
| `clubs` | `id`, `slug` único | Branding, plan, `invite_code`, `onboarding_step`, `timezone`. Un trigger impide que el owner toque plan/facturación; el slug se bloquea después del onboarding (cambiarlo rompería las PWAs instaladas) |
| `profiles` | `id = auth.users.id` | Nombre y foto. Visible para quienes comparten club |
| `profile_private` | `user_id` | Nacimiento, teléfono, contacto de emergencia. Solo el usuario y el staff de sus clubes |
| `memberships` | `(club_id, user_id)` | Rol, estado, turno, nivel, **ritmo de referencia (por club)** |
| `shifts` | `id` | Días `smallint[]` (1 = lunes), horario, lugar, coach |
| `staff_invitations` | `token` | Invitaciones de coaches por email |
| `session_templates` | `id` | Biblioteca |
| `training_sessions` | `id` | `blocks jsonb` (validado con Zod), audiencia `club / shift / runners`, `published_at` (null = borrador) |
| `training_session_targets` | `(session_id, user_id)` | Destinatarios puntuales |
| `session_completions` | `(session_id, user_id)` | Sensación 1–5 + comentario |
| `announcements` (+ `_views`, `_reactions`) | `id` | Audiencia club o turno, fijados, "Visto por N" |
| `push_subscriptions` | `endpoint` único | Una por dispositivo y club |
| `notifications` | `id` | Bandeja in-app **y** outbox de push (`push_status`) |
| `reminder_log` | `(club, user, kind, ref_date)` | Idempotencia de recordatorios (Fase 2) |
| `audit_log` | `id` | Altas, cambios de plan, etc. |

### RLS

Helpers `SECURITY DEFINER` (leen `memberships` sin recursión):
`my_club_ids()`, `my_staff_club_ids()`, `is_member()`, `is_staff()`, `is_owner()`, `is_superadmin()`, `my_shift()`, `shares_club()`, `is_staff_of_user()`.

Las políticas usan `club_id in (select my_club_ids())`, que Postgres evalúa una sola vez por query (initplan), así escala sin hacer un lookup por fila.

| Tipo de tabla | Lectura | Escritura |
|---|---|---|
| Del staff (turnos, sesiones, avisos, biblioteca) | Miembros (+ filtro de audiencia para corredores; borradores solo staff) | Staff |
| Del corredor (completadas, vistas, reacciones) | Dueño o staff | El propio usuario, si puede ver el recurso |
| `memberships` | Miembros del club | Staff (turno, nivel); owner (roles); el corredor solo su ritmo (trigger) |
| `clubs` | Miembros (branding público vía RPC `club_public_by_slug`) | Owner, salvo columnas de facturación |
| Storage | `branding/{club}` y `avatars/{user}` públicos; `club-files/{club}/{categoría}/{user}` privado con URLs firmadas | Según carpeta |

Altas solo por RPC: `create_club`, `join_club(code)` (valida el límite del plan), `accept_staff_invitation(token)`.

### Tests de aislamiento (`tests/rls`)

Crean dos clubes completos y verifican, como cada rol, que:
- todas las tablas con `club_id` devuelven 0 filas del otro club (la lista de tablas se descubre sola desde `information_schema`, así una tabla nueva queda cubierta automáticamente);
- toda tabla de `public` tiene RLS y al menos una política;
- INSERT / UPDATE / DELETE cruzados fallan o no afectan filas, incluidas las FK compuestas y Storage;
- dentro del club, cada rol ve solo lo que le corresponde.

## Fase 2: cuotas, apto, eventos y recordatorios

| Tabla | Notas |
|-------|-------|
| `fee_rules` | Monto mensual general, por turno o por corredor (0 = becado), con `valid_from` (día 1). Gana la más específica y, a igual prioridad, la más reciente. El corredor no ve las becas de otros |
| `fee_payments` | Pago informado por el corredor (monto, medio, comprobante). Solo el staff lo confirma o rechaza, vía RPC `review_fee_payment` (un trigger impide tocar el estado desde el cliente). Editable/borrable solo mientras está pendiente |
| `medical_certificates` | Historial de aptos; vale el último cargado |
| `events` / `event_registrations` | Eventos del club e inscripciones con distancia (validada contra las del evento) |

Los estados se calculan, no se guardan:

- `club_fee_statuses(club, period)` → Al día / Pendiente de confirmar / Debe por corredor (el staff ve a todos; un corredor, solo a sí mismo). Usa `fee_amount_due()` y `fee_status_of()`, que son el espejo exacto de `resolveFeeAmount()` y `feeStatus()` en TypeScript; un test verifica la paridad caso por caso.
- `club_medical_statuses(club)` → Vigente / Por vencer / Vencido / Sin cargar, con `medical_status_of()` (espejo de `medicalStatus()`).

Las funciones por plan se aplican también en la base: `fee_payments`, `fee_rules` y `medical_certificates` exigen `club_has_feature()` para **insertar**, nunca para leer.

### Recordatorios

`run_daily_reminders()` corre cada hora (pg_cron) y procesa los clubes donde son las 9:00 en su zona horaria:

1. **Cuotas:** el día `settings.fee_reminder_day` (10 por defecto), a quienes deben el mes.
2. **Apto:** 30 y 7 días antes, el día del vencimiento y el día después.
3. **Eventos:** a los inscriptos, el día anterior.
4. **Cumpleaños:** aviso al staff y, si `settings.birthday_greeting`, saludo del club al corredor.

Cada aviso se registra en `reminder_log` (clave única), así correrlo dos veces no duplica nada. Las notificaciones las envía el worker de push en el siguiente minuto.

## Ritmos (`src/lib/domain/pace.ts`)

- El ancla es el **ritmo de umbral**. Si el corredor cargó su 5K, se estima con Riegel (`T2 = T1 · (D2/D1)^1.06`) como el ritmo sostenible 60 minutos.
- **Los % son sobre la velocidad:** 100 % = umbral, 90 % = más lento, 105 % = más rápido.
- Zonas (en % de la velocidad de umbral): Z1 65–78 · Z2 78–88 · Z3 88–95 · Z4 95–102 · Z5 102–110.
- Sin ritmo cargado se muestra la descripción ("Z2 · Aeróbico") y un aviso para completarlo.

## Push

```
acción (aviso / publicar sesión)
  └─ INSERT announcements  ──trigger──►  INSERT notifications (1 por destinatario, push_status='pending')
  └─ after(dispatchPushInBackground)     ◄── corre después de responder al usuario
pg_cron (cada minuto) ──► POST /api/jobs/push ──► dispatchPendingPush()
       claim_push_batch()  (FOR UPDATE SKIP LOCKED, reintentos)
       web-push → sent / skipped (sin dispositivos) / failed
       404/410 → borra la suscripción
```

El payload lleva el nombre del club como título y sus íconos (`/icon/192`, `/icon/badge`).

## PWA

- `public/sw.js`: push, click en la notificación (enfoca o abre la app) y página offline.
- `c/[club]/manifest.webmanifest`: nombre, `theme_color` del club, íconos.
- `c/[club]/icon/[variant]`: PNG generados con `next/og` (logo o iniciales sobre el color del club). La variante maskable respeta la zona segura.
- `/instalar`: guía según el dispositivo (iOS Safari, Android con `beforeinstallprompt`, escritorio).

## Decisiones

| Decisión | Por qué |
|---|---|
| Ritmo de referencia por club (en `memberships`) | Cada coach lo calibra a su manera; un corredor en dos clubes puede tener dos referencias |
| Outbox en `notifications` en lugar de pgmq | Misma garantía (cola transaccional con `SKIP LOCKED`), sin extensión extra, testeable en cualquier Postgres y con historial in-app gratis |
| `blocks jsonb` | Se leen/escriben como unidad y se mapean directo al formato de workouts de Garmin (Fase 3) |
| Cookie de sesión en `.tropa.app` | El owner crea el club en el dominio raíz y entra directo a su subdominio |
| Sin ORM | Las migraciones SQL son la fuente de verdad; los tipos se generan con `supabase gen types` |
