/**
 * Fase 2: cuotas, apto médico, eventos y recordatorios.
 * Permisos dentro del club, paridad de la lógica SQL con la de TypeScript e idempotencia de los jobs.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { feeStatus, type FeePayment } from "@/lib/domain/fees";
import { medicalStatus } from "@/lib/domain/medical";
import { asUser, connect, createClubFixture, dropClubFixture, type ClubFixture, type Db } from "./helpers";

let db: Db;
let A: ClubFixture;
let B: ClubFixture;

beforeAll(async () => {
  db = await connect();
  A = await createClubFixture(db, "p2a");
  B = await createClubFixture(db, "p2b");
});

afterAll(async () => {
  if (A) await dropClubFixture(db, A);
  if (B) await dropClubFixture(db, B);
  await db?.end();
});

describe("cuotas", () => {
  it("el corredor no puede confirmar su propio pago ni el de otro", async () => {
    await asUser(db, A.runner1, async (q) => {
      expect(await q.fails(`update public.fee_payments set status = 'confirmed' where id = $1`, [A.paymentId])).toBe("42501");
      expect(await q.fails(`select public.review_fee_payment($1, true)`, [A.paymentId])).toBe("42501");
      // sí puede corregir el monto mientras está pendiente
      expect(await q.exec(`update public.fee_payments set amount_cents = 2100000 where id = $1`, [A.paymentId])).toBe(1);
    });
  });

  it("el corredor no ve pagos ni becas de otros corredores", async () => {
    await asUser(db, A.runner2, async (q) => {
      expect(await q.count(`select count(*) from public.fee_payments where user_id = $1`, [A.runner1.id])).toBe(0);
      expect(await q.count(`select count(*) from public.fee_rules where user_id is not null and user_id <> $1`, [A.runner2.id])).toBe(0);
    });
    await asUser(db, A.runner1, async (q) => {
      // la beca del runner2 no es visible para runner1
      expect(await q.count(`select count(*) from public.fee_rules where user_id = $1`, [A.runner2.id])).toBe(0);
      const rows = await q.rows(`select * from public.club_fee_statuses($1, date_trunc('month', current_date)::date)`, [A.clubId]);
      expect(rows).toHaveLength(1); // solo él
    });
  });

  it("el coach confirma con un toque y el corredor recibe la notificación", async () => {
    await asUser(db, A.coach, async (q) => {
      await q.exec(`select public.review_fee_payment($1, true)`, [A.paymentId]);
      const [p] = await q.rows<{ status: string }>(`select status from public.fee_payments where id = $1`, [A.paymentId]);
      expect(p.status).toBe("confirmed");
      const statuses = await q.rows<{ user_id: string; status: string }>(
        `select user_id, status from public.club_fee_statuses($1, date_trunc('month', current_date)::date)`,
        [A.clubId],
      );
      expect(statuses.find((s) => s.user_id === A.runner1.id)?.status).toBe("paid");
      expect(statuses.find((s) => s.user_id === A.runner2.id)?.status).toBe("paid"); // becado

      // Misma transacción, ahora como el corredor
      await q.exec(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: A.runner1.id, role: "authenticated" })]);
      // un pago ya revisado no se puede editar ni borrar
      expect(await q.exec(`update public.fee_payments set amount_cents = 1 where id = $1`, [A.paymentId])).toBe(0);
      expect(await q.exec(`delete from public.fee_payments where id = $1`, [A.paymentId])).toBe(0);
      expect(await q.count(`select count(*) from public.notifications where kind = 'fee_review'`)).toBe(1);
    });
  });

  it("el coach de A no puede revisar pagos de B", async () => {
    await asUser(db, A.coach, async (q) => {
      expect(await q.fails(`select public.review_fee_payment($1, true)`, [B.paymentId])).toBe("42501");
      expect(await q.fails(`select * from public.club_fee_statuses($1, current_date)`, [B.clubId])).toBe("42501");
    });
  });

  it("no se puede declarar un pago con comprobante en la carpeta de otro", async () => {
    await asUser(db, A.runner1, async (q) => {
      expect(
        await q.fails(
          `insert into public.fee_payments (club_id, user_id, period, amount_cents, method, receipt_path) values ($1, $2, date_trunc('month', current_date), 100, 'cash', $3)`,
          [A.clubId, A.runner1.id, `${A.clubId}/receipts/${A.runner2.id}/x.webp`],
        ),
      ).toBe("42501");
    });
  });

  it("sin la feature 'fees' (plan Free) no se pueden declarar pagos, pero los datos cargados se siguen viendo", async () => {
    await db.query(`update public.clubs set plan_code = 'free', plan_override = false where id = $1`, [A.clubId]);
    try {
      await asUser(db, A.runner1, async (q) => {
        expect(
          await q.fails(
            `insert into public.fee_payments (club_id, user_id, period, amount_cents, method) values ($1, $2, date_trunc('month', current_date), 100, 'cash')`,
            [A.clubId, A.runner1.id],
          ),
        ).toBe("42501");
        expect(await q.count(`select count(*) from public.fee_payments where user_id = $1`, [A.runner1.id])).toBe(1);
      });
    } finally {
      await db.query(`update public.clubs set plan_code = 'team', plan_override = true where id = $1`, [A.clubId]);
    }
  });
});

describe("paridad SQL ↔ TypeScript", () => {
  const cases: { due: number | null; payments: FeePayment[] }[] = [
    { due: 20000, payments: [] },
    { due: 20000, payments: [{ amountCents: 20000, status: "pending" }] },
    { due: 20000, payments: [{ amountCents: 20000, status: "confirmed" }] },
    { due: 20000, payments: [{ amountCents: 5000, status: "confirmed" }] },
    { due: 20000, payments: [{ amountCents: 5000, status: "confirmed" }, { amountCents: 15000, status: "pending" }] },
    { due: 20000, payments: [{ amountCents: 20000, status: "rejected" }] },
    { due: 0, payments: [] },
    { due: null, payments: [] },
  ];

  it("fee_status_of() da lo mismo que feeStatus()", async () => {
    for (const c of cases) {
      const confirmed = c.payments.filter((p) => p.status === "confirmed").reduce((s, p) => s + p.amountCents, 0);
      const pending = c.payments.filter((p) => p.status === "pending").length;
      const { rows } = await db.query(`select public.fee_status_of($1, $2, $3) as s`, [c.due, confirmed, pending]);
      expect(rows[0].s).toBe(feeStatus(c.due, c.payments));
    }
  });

  it("medical_status_of() da lo mismo que medicalStatus()", async () => {
    const today = "2026-11-05";
    for (const exp of [null, "2026-11-04", "2026-11-05", "2026-12-05", "2026-12-06", "2027-06-01"]) {
      const { rows } = await db.query(`select public.medical_status_of($1::date, $2::date) as s`, [exp, today]);
      expect(rows[0].s).toBe(medicalStatus(exp, today));
    }
  });

  it("fee_amount_due(): corredor > turno > club, la más reciente gana", async () => {
    await db.query("begin");
    try {
      await db.query(`delete from public.fee_rules where club_id = $1`, [A.clubId]);
      await db.query(
        `insert into public.fee_rules (club_id, shift_id, user_id, amount_cents, valid_from) values
          ($1, null, null, 100, '2026-01-01'), ($1, null, null, 200, '2026-07-01'),
          ($1, $2, null, 150, '2026-01-01'), ($1, null, $3, 0, '2026-03-01')`,
        [A.clubId, A.shiftId, A.runner2.id],
      );
      const due = async (user: string, period: string) =>
        Number((await db.query(`select public.fee_amount_due($1, $2, $3) as d`, [A.clubId, user, period])).rows[0].d);
      expect(await due(A.coach.id, "2026-06-01")).toBe(100);
      expect(await due(A.coach.id, "2026-11-01")).toBe(200);
      expect(await due(A.runner1.id, "2026-11-01")).toBe(150); // turno
      expect(await due(A.runner2.id, "2026-11-01")).toBe(0); // beca
      expect(await due(A.runner2.id, "2026-02-01")).toBe(100); // la beca todavía no regía
    } finally {
      await db.query("rollback");
    }
  });
});

describe("apto médico y eventos", () => {
  it("el corredor sube su apto solo a su carpeta y el staff ve el estado de todos", async () => {
    await asUser(db, A.runner2, async (q) => {
      expect(
        await q.fails(`insert into public.medical_certificates (club_id, user_id, file_path, expires_on) values ($1, $2, $3, current_date + 10)`, [
          A.clubId,
          A.runner2.id,
          `${A.clubId}/medical/${A.runner1.id}/x.pdf`,
        ]),
      ).toBe("42501");
      expect(await q.count(`select count(*) from public.medical_certificates where user_id = $1`, [A.runner1.id])).toBe(0);
    });
    const rows = await asUser(db, A.coach, (q) => q.rows<{ user_id: string; status: string }>(`select * from public.club_medical_statuses($1)`, [A.clubId]));
    expect(rows.find((r) => r.user_id === A.runner1.id)?.status).toBe("valid");
    expect(rows.find((r) => r.user_id === A.runner2.id)?.status).toBe("missing");
  });

  it("solo se puede elegir una distancia del evento y anotarse uno mismo", async () => {
    await asUser(db, A.runner2, async (q) => {
      expect(await q.fails(`insert into public.event_registrations (club_id, event_id, user_id, distance) values ($1, $2, $3, '42K')`, [A.clubId, A.eventId, A.runner2.id])).toBe("22023");
      expect(await q.fails(`insert into public.event_registrations (club_id, event_id, user_id, distance) values ($1, $2, $3, '10K')`, [A.clubId, A.eventId, A.runner1.id])).toBe("42501");
      expect(await q.exec(`insert into public.event_registrations (club_id, event_id, user_id, distance) values ($1, $2, $3, '10K')`, [A.clubId, A.eventId, A.runner2.id])).toBe(1);
      expect(await q.fails(`insert into public.event_registrations (club_id, event_id, user_id, distance) values ($1, $2, $3, '10K')`, [B.clubId, B.eventId, A.runner2.id])).toMatch(/42501|23503/);
      // Los corredores ven quién va (avatares), pero no pueden crear eventos
      expect(await q.count(`select count(*) from public.event_registrations where event_id = $1`, [A.eventId])).toBe(2);
      expect(await q.fails(`insert into public.events (club_id, name, starts_at, created_by) values ($1, 'X', now(), $2)`, [A.clubId, A.runner2.id])).toBe("42501");
    });
  });
});

describe("recordatorios diarios (run_daily_reminders)", () => {
  it("avisa a quien debe, al que se le vence el apto, a los inscriptos de mañana y al staff por cumpleaños — una sola vez", async () => {
    await db.query("begin");
    try {
      const today = (await db.query(`select public.club_today($1) as t`, [A.clubId])).rows[0].t as Date;
      const day = today.getDate();
      await db.query(`update public.clubs set settings = jsonb_build_object('fee_reminder_day', $2::int, 'birthday_greeting', true) where id = $1`, [A.clubId, day]);
      await db.query(`update public.clubs set settings = jsonb_build_object('fee_reminder_day', 1 + ($2::int % 27)) where id = $1`, [B.clubId, day]);
      // runner1 debe (borramos su pago), apto vence en 7 días, cumple hoy y está anotado a un evento de mañana
      await db.query(`delete from public.fee_payments where club_id = $1`, [A.clubId]);
      await db.query(`update public.medical_certificates set expires_on = public.club_today(club_id) + 7 where club_id = $1`, [A.clubId]);
      await db.query(`update public.profile_private set birth_date = public.club_today($1) - interval '30 years' where user_id = $2`, [A.clubId, A.runner1.id]);
      await db.query(`update public.events set starts_at = (public.club_today(club_id) + 1 + time '08:00') at time zone 'America/Argentina/Buenos_Aires' where id = $1`, [A.eventId]);
      await db.query(`delete from public.notifications where club_id = any($1)`, [[A.clubId, B.clubId]]);

      const first = (await db.query(`select public.run_daily_reminders(now(), true) as r`)).rows[0].r;
      expect(first.fees).toBeGreaterThanOrEqual(1);

      const kinds = async (user: string) =>
        (await db.query(`select kind from public.notifications where club_id = $1 and user_id = $2 order by kind`, [A.clubId, user])).rows.map((r) => r.kind);
      expect(await kinds(A.runner1.id)).toEqual(["birthday_greeting", "event_reminder", "fee_reminder", "medical_reminder"]);
      expect(await kinds(A.runner2.id)).toEqual([]); // becado, sin apto, sin evento
      expect(await kinds(A.coach.id)).toEqual(["birthday_staff"]);
      expect(await kinds(A.owner.id)).toEqual(["birthday_staff"]);
      // En B no era el día de recordar cuotas
      expect((await db.query(`select count(*)::int as n from public.notifications where club_id = $1 and kind = 'fee_reminder'`, [B.clubId])).rows[0].n).toBe(0);

      // Idempotente: correrlo otra vez no duplica nada
      const before = (await db.query(`select count(*)::int as n from public.notifications`)).rows[0].n;
      await db.query(`select public.run_daily_reminders(now(), true)`);
      const after = (await db.query(`select count(*)::int as n from public.notifications`)).rows[0].n;
      expect(after).toBe(before);
    } finally {
      await db.query("rollback");
    }
  });

  it("no es ejecutable por clientes", async () => {
    await asUser(db, A.owner, async (q) => {
      expect(await q.fails(`select public.run_daily_reminders()`)).toBe("42501");
    });
  });
});
