import pg from "pg";
import { randomUUID } from "node:crypto";

export const DB_URL = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export type Db = pg.Client;

export async function connect(): Promise<Db> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  return client;
}

export type TestUser = { id: string; email: string };

export async function createUser(db: Db, label: string): Promise<TestUser> {
  const id = randomUUID();
  const email = `${label}-${id.slice(0, 8)}@rls.test`;
  await db.query(
    `insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, $3, now(), now())`,
    [id, email, JSON.stringify({ full_name: label })],
  );
  return { id, email };
}

export class RlsError extends Error {
  constructor(
    message: string,
    public code: string | undefined,
  ) {
    super(message);
  }
}

/**
 * Ejecuta `fn` como un usuario autenticado (rol `authenticated` + claims JWT),
 * igual que PostgREST. Siempre hace ROLLBACK: los tests no dejan rastros.
 */
export async function asUser<T>(db: Db, user: TestUser | null, fn: (q: Query) => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    if (user) {
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: user.id, email: user.email, role: "authenticated" }),
      ]);
      await db.query("set local role authenticated");
    } else {
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "anon" })]);
      await db.query("set local role anon");
    }
    return await fn(makeQuery(db));
  } finally {
    await db.query("rollback");
  }
}

export type Query = {
  rows: <R = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<R[]>;
  count: (sql: string, params?: unknown[]) => Promise<number>;
  /** Ejecuta y devuelve filas afectadas */
  exec: (sql: string, params?: unknown[]) => Promise<number>;
  /** Espera que falle; devuelve el código SQLSTATE */
  fails: (sql: string, params?: unknown[]) => Promise<string>;
};

function makeQuery(db: Db): Query {
  let n = 0;
  return {
    rows: async (sql, params) => (await db.query(sql, params)).rows,
    count: async (sql, params) => Number((await db.query(sql, params)).rows[0]?.count ?? 0),
    exec: async (sql, params) => (await db.query(sql, params)).rowCount ?? 0,
    fails: async (sql, params) => {
      const sp = `sp_${n++}`;
      await db.query(`savepoint ${sp}`);
      try {
        await db.query(sql, params);
      } catch (e) {
        await db.query(`rollback to savepoint ${sp}`);
        return (e as { code?: string }).code ?? "unknown";
      }
      await db.query(`release savepoint ${sp}`);
      throw new Error(`Expected query to fail but it succeeded: ${sql}`);
    },
  };
}

export type ClubFixture = {
  clubId: string;
  inviteCode: string;
  owner: TestUser;
  coach: TestUser;
  runner1: TestUser; // en el turno
  runner2: TestUser; // sin turno, destinatario puntual
  shiftId: string;
  sessionClub: string;
  sessionShift: string;
  sessionTargeted: string;
  sessionDraft: string;
  announcementId: string;
  announcementShift: string;
  paymentId: string;
  eventId: string;
  variantId: string;
  orderId: string;
};

/** Crea un club completo con datos en todas las tablas (como superusuario). */
export async function createClubFixture(db: Db, label: string): Promise<ClubFixture> {
  const owner = await createUser(db, `${label}-owner`);
  const coach = await createUser(db, `${label}-coach`);
  const runner1 = await createUser(db, `${label}-runner1`);
  const runner2 = await createUser(db, `${label}-runner2`);
  const slug = `rls${label}${randomUUID().slice(0, 6)}`.toLowerCase();

  const { rows: [club] } = await db.query(
    `insert into public.clubs (slug, name, created_by, plan_code, plan_override) values ($1, $2, $3, 'team', true)
     returning id, invite_code`,
    [slug, `Club ${label}`, owner.id],
  );
  const clubId: string = club.id;

  const one = async (sql: string, params: unknown[]) => (await db.query(sql, params)).rows[0];

  const shift = await one(
    `insert into public.shifts (club_id, name, days, starts_at, ends_at, location)
     values ($1, 'Mañana', '{1,3,5}', '07:00', '08:00', 'Parque') returning id`,
    [clubId],
  );
  await db.query(
    `insert into public.memberships (club_id, user_id, role, shift_id, ref_pace_s_per_km) values
       ($1, $2, 'owner', null, null), ($1, $3, 'coach', null, null),
       ($1, $4, 'runner', $6, 300), ($1, $5, 'runner', null, 330)`,
    [clubId, owner.id, coach.id, runner1.id, runner2.id, shift.id],
  );
  await db.query(`update public.profile_private set phone = '+54 11 5555-' || substr(user_id::text, 1, 4) where user_id = any($1)`, [
    [owner.id, coach.id, runner1.id, runner2.id],
  ]);

  const template = await one(
    `insert into public.session_templates (club_id, title, type, created_by) values ($1, 'Pasadas 6x1000', 'intervals', $2) returning id`,
    [clubId, coach.id],
  );
  const mk = (audience: string, shiftId: string | null, published: boolean) =>
    one(
      `insert into public.training_sessions (club_id, date, title, type, audience, shift_id, template_id, created_by, published_at)
       values ($1, current_date, $2, 'easy_run', $3, $4, $5, $6, $7) returning id`,
      [clubId, `${audience}-${published}`, audience, shiftId, template.id, coach.id, published ? new Date() : null],
    );
  const sClub = await mk("club", null, true);
  const sShift = await mk("shift", shift.id, true);
  const sTarget = await mk("runners", null, true);
  const sDraft = await mk("club", null, false);
  await db.query(`insert into public.training_session_targets (club_id, session_id, user_id) values ($1, $2, $3)`, [
    clubId,
    sTarget.id,
    runner2.id,
  ]);
  await db.query(
    `insert into public.session_completions (club_id, session_id, user_id, feeling) values ($1, $2, $3, 4), ($1, $2, $4, 3)`,
    [clubId, sClub.id, runner1.id, runner2.id],
  );

  const ann = await one(
    `insert into public.announcements (club_id, author_id, body) values ($1, $2, 'Mañana corremos en el lago') returning id`,
    [clubId, coach.id],
  );
  const annShift = await one(
    `insert into public.announcements (club_id, author_id, body, audience, shift_id) values ($1, $2, 'Solo turno mañana', 'shift', $3) returning id`,
    [clubId, coach.id, shift.id],
  );
  await db.query(`insert into public.announcement_views (club_id, announcement_id, user_id) values ($1, $2, $3)`, [
    clubId,
    ann.id,
    runner1.id,
  ]);
  await db.query(`insert into public.announcement_reactions (club_id, announcement_id, user_id, emoji) values ($1, $2, $3, '🔥')`, [
    clubId,
    ann.id,
    runner1.id,
  ]);
  await db.query(
    `insert into public.push_subscriptions (club_id, user_id, endpoint, p256dh, auth) values ($1, $2, $3, 'k', 'a')`,
    [clubId, runner1.id, `https://push.example/${randomUUID()}`],
  );
  await db.query(`insert into public.staff_invitations (club_id, email, invited_by) values ($1, $2, $3)`, [
    clubId,
    `nuevo-coach-${label}@rls.test`,
    owner.id,
  ]);
  await db.query(`insert into public.audit_log (club_id, actor_id, action) values ($1, $2, 'test')`, [clubId, owner.id]);
  await db.query(`insert into public.reminder_log (club_id, user_id, kind, ref_date) values ($1, $2, 'test', current_date)`, [
    clubId,
    runner1.id,
  ]);
  // Fase 2
  await db.query(`insert into public.fee_rules (club_id, amount_cents, valid_from) values ($1, 2000000, date_trunc('month', current_date))`, [clubId]);
  await db.query(`insert into public.fee_rules (club_id, user_id, amount_cents, valid_from) values ($1, $2, 0, date_trunc('month', current_date))`, [
    clubId,
    runner2.id,
  ]);
  const payment = await one(
    `insert into public.fee_payments (club_id, user_id, period, amount_cents, method) values ($1, $2, date_trunc('month', current_date), 2000000, 'transfer') returning id`,
    [clubId, runner1.id],
  );
  await db.query(`insert into public.medical_certificates (club_id, user_id, file_path, expires_on) values ($1, $2, $3, current_date + 100)`, [
    clubId,
    runner1.id,
    `${clubId}/medical/${runner1.id}/apto.pdf`,
  ]);
  const event = await one(
    `insert into public.events (club_id, name, starts_at, distances, created_by) values ($1, 'Carrera', now() + interval '10 days', '{10K}', $2) returning id`,
    [clubId, coach.id],
  );
  await db.query(`insert into public.event_registrations (club_id, event_id, user_id, distance) values ($1, $2, $3, '10K')`, [clubId, event.id, runner1.id]);

  // Fase 3
  const product = await one(`insert into public.products (club_id, name, price_cents) values ($1, 'Remera', 1500000) returning id`, [clubId]);
  const variant = await one(`insert into public.product_variants (club_id, product_id, size, stock) values ($1, $2, 'M', 5) returning id`, [clubId, product.id]);
  const order = await one(
    `insert into public.orders (club_id, number, user_id, total_cents) values ($1, 1, $2, 1500000) returning id`,
    [clubId, runner1.id],
  );
  await db.query(
    `insert into public.order_items (club_id, order_id, variant_id, product_name, size, quantity, unit_price_cents) values ($1, $2, $3, 'Remera', 'M', 1, 1500000)`,
    [clubId, order.id, variant.id],
  );
  await db.query(`insert into public.club_counters (club_id, key, value) values ($1, 'order', 1)`, [clubId]);
  await db.query(`insert into public.platform_subscriptions (club_id, provider, external_id, plan_code) values ($1, 'fake', $2, 'team')`, [
    clubId,
    `sub-${clubId}`,
  ]);
  await db.query(`insert into public.watch_connections (user_id, provider, access_token) values ($1, 'fake', 'secret-token') on conflict do nothing`, [runner1.id]);
  await db.query(`insert into public.watch_syncs (club_id, session_id, user_id, provider) values ($1, $2, $3, 'fake')`, [clubId, sClub.id, runner1.id]);

  await db.query(
    `insert into storage.objects (bucket_id, name, owner_id) values
       ('club-files', $1, $3), ('club-files', $2, $4), ('branding', $5, $3)`,
    [
      `${clubId}/receipts/${runner1.id}/comprobante.webp`,
      `${clubId}/announcements/${coach.id}/foto.webp`,
      runner1.id,
      coach.id,
      `${clubId}/logo.webp`,
    ],
  );

  return {
    clubId,
    inviteCode: club.invite_code,
    owner,
    coach,
    runner1,
    runner2,
    shiftId: shift.id,
    sessionClub: sClub.id,
    sessionShift: sShift.id,
    sessionTargeted: sTarget.id,
    sessionDraft: sDraft.id,
    announcementId: ann.id,
    announcementShift: annShift.id,
    paymentId: payment.id,
    eventId: event.id,
    variantId: variant.id,
    orderId: order.id,
  };
}

export async function dropClubFixture(db: Db, f: ClubFixture) {
  await db.query("begin");
  await db.query("set local storage.allow_delete_query = 'true'");
  await db.query(`delete from storage.objects where name like $1`, [`${f.clubId}/%`]);
  await db.query("commit");
  await db.query(`delete from public.clubs where id = $1`, [f.clubId]);
  await db.query(`delete from auth.users where id = any($1)`, [[f.owner.id, f.coach.id, f.runner1.id, f.runner2.id]]);
}
