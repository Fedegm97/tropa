/**
 * Fase 3: tienda, suscripciones y envío al reloj.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, connect, createClubFixture, dropClubFixture, type ClubFixture, type Db } from "./helpers";

let db: Db;
let A: ClubFixture;
let B: ClubFixture;

beforeAll(async () => {
  db = await connect();
  A = await createClubFixture(db, "p3a");
  B = await createClubFixture(db, "p3b");
});

afterAll(async () => {
  if (A) await dropClubFixture(db, A);
  if (B) await dropClubFixture(db, B);
  await db?.end();
});

const items = (variant: string, quantity: number) => JSON.stringify([{ variant_id: variant, quantity }]);

describe("tienda", () => {
  it("place_order toma precio y stock de la base, numera por club y avisa al staff", async () => {
    await asUser(db, A.runner2, async (q) => {
      const [o] = await q.rows<{ order_id: string; order_number: number }>(`select * from public.place_order($1, $2::jsonb, 'Talle M por favor')`, [
        A.clubId,
        items(A.variantId, 2),
      ]);
      expect(o.order_number).toBe(2); // el fixture ya tenía el #1
      const [order] = await q.rows<{ total_cents: string; status: string }>(`select total_cents, status from public.orders where id = $1`, [o.order_id]);
      expect(Number(order.total_cents)).toBe(3000000);
      expect(order.status).toBe("pending_payment");
      const [v] = await q.rows<{ stock: number }>(`select stock from public.product_variants where id = $1`, [A.variantId]);
      expect(v.stock).toBe(3);
      // Sin stock suficiente
      expect(await q.fails(`select * from public.place_order($1, $2::jsonb)`, [A.clubId, items(A.variantId, 10)])).toBe("P0001");
      // Variante de otro club
      expect(await q.fails(`select * from public.place_order($1, $2::jsonb)`, [A.clubId, items(B.variantId, 1)])).toBe("22023");
      expect(await q.fails(`select * from public.place_order($1, $2::jsonb)`, [B.clubId, items(B.variantId, 1)])).toBe("42501");
    });
  });

  it("no se pueden crear pedidos directo (solo por RPC) ni ver los de otro corredor", async () => {
    await asUser(db, A.runner2, async (q) => {
      expect(
        await q.fails(`insert into public.orders (club_id, number, user_id, total_cents) values ($1, 99, $2, 0)`, [A.clubId, A.runner2.id]),
      ).toBe("42501");
      expect(await q.count(`select count(*) from public.orders where id = $1`, [A.orderId])).toBe(0);
      expect(await q.count(`select count(*) from public.order_items where order_id = $1`, [A.orderId])).toBe(0);
    });
  });

  it("estados: el corredor solo cancela su pedido pendiente (devuelve stock); el staff marca pagado y entregado", async () => {
    await asUser(db, A.runner1, async (q) => {
      expect(await q.fails(`select public.set_order_status($1, 'paid')`, [A.orderId])).toBe("42501");
      await q.exec(`select public.set_order_status($1, 'canceled')`, [A.orderId]);
      const [v] = await q.rows<{ stock: number }>(`select stock from public.product_variants where id = $1`, [A.variantId]);
      expect(v.stock).toBe(6);
    });
    await asUser(db, A.coach, async (q) => {
      await q.exec(`select public.set_order_status($1, 'paid')`, [A.orderId]);
      await q.exec(`select public.set_order_status($1, 'delivered')`, [A.orderId]);
      const [o] = await q.rows<{ status: string }>(`select status from public.orders where id = $1`, [A.orderId]);
      expect(o.status).toBe("delivered");
      expect(await q.fails(`select public.set_order_status($1, 'paid')`, [B.orderId])).toBe("42501");
    });
  });

  it("el corredor no ve productos inactivos ni puede crear productos", async () => {
    await db.query("begin");
    try {
      await db.query(`update public.products set active = false where club_id = $1`, [A.clubId]);
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: A.runner1.id, role: "authenticated" })]);
      await db.query("set local role authenticated");
      expect(Number((await db.query(`select count(*) from public.products where club_id = $1`, [A.clubId])).rows[0].count)).toBe(0);
    } finally {
      await db.query("rollback");
    }
    await asUser(db, A.runner1, async (q) => {
      expect(await q.fails(`insert into public.products (club_id, name, price_cents) values ($1, 'X', 1)`, [A.clubId])).toBe("42501");
    });
  });

  it("sin la feature 'store' no se pueden hacer pedidos", async () => {
    await db.query(`update public.clubs set plan_code = 'coach', plan_override = false where id = $1`, [A.clubId]);
    try {
      await asUser(db, A.runner1, async (q) => {
        expect(await q.fails(`select * from public.place_order($1, $2::jsonb)`, [A.clubId, items(A.variantId, 1)])).toBe("42501");
      });
    } finally {
      await db.query(`update public.clubs set plan_code = 'team', plan_override = true where id = $1`, [A.clubId]);
    }
  });
});

describe("suscripciones y prueba gratis", () => {
  it("la prueba de 30 días la inicia solo el owner, una sola vez y desde Free", async () => {
    await db.query(`update public.clubs set plan_code = 'free', plan_status = 'active', plan_override = false, trial_used = false where id = $1`, [A.clubId]);
    try {
      await asUser(db, A.coach, async (q) => {
        expect(await q.fails(`select public.start_trial($1, 'team')`, [A.clubId])).toBe("42501");
      });
      await asUser(db, A.owner, async (q) => {
        await q.exec(`select public.start_trial($1, 'team')`, [A.clubId]);
        const [c] = await q.rows<{ plan_code: string; plan_status: string; trial_used: boolean }>(
          `select plan_code, plan_status, trial_used from public.clubs where id = $1`,
          [A.clubId],
        );
        expect(c).toEqual({ plan_code: "team", plan_status: "trialing", trial_used: true });
        const [{ club_effective_plan }] = await q.rows<{ club_effective_plan: string }>(`select public.club_effective_plan($1)`, [A.clubId]);
        expect(club_effective_plan).toBe("team");
        // No se puede "resetear" la prueba tocando la tabla
        expect(await q.fails(`update public.clubs set trial_used = false where id = $1`, [A.clubId])).toBe("42501");
      });
    } finally {
      await db.query(`update public.clubs set plan_code = 'team', plan_override = true, trial_used = false where id = $1`, [A.clubId]);
    }
  });

  it("apply_subscription solo con service_role; activa, pausa y cancela el plan", async () => {
    await asUser(db, A.owner, async (q) => {
      expect(
        await q.fails(`select public.apply_subscription('fake', 'x', $1, 'team', 'authorized', null, null, '{}')`, [A.clubId]),
      ).toBe("42501");
      expect(await q.count(`select count(*) from public.platform_subscriptions where club_id = $1`, [A.clubId])).toBe(1);
      expect(await q.count(`select count(*) from public.platform_subscriptions where club_id = $1`, [B.clubId])).toBe(0);
    });
    await db.query("begin");
    try {
      await db.query(`update public.clubs set plan_code = 'free', plan_status = 'active', plan_override = false where id = $1`, [A.clubId]);
      const plan = async () => (await db.query(`select plan_code, plan_status from public.clubs where id = $1`, [A.clubId])).rows[0];
      await db.query(`select public.apply_subscription('fake', 's1', $1, 'coach', 'authorized', now() + interval '1 month', 'a@b.c', '{}')`, [A.clubId]);
      expect(await plan()).toEqual({ plan_code: "coach", plan_status: "active" });
      await db.query(`select public.apply_subscription('fake', 's1', $1, 'coach', 'paused', null, null, '{}')`, [A.clubId]);
      expect(await plan()).toEqual({ plan_code: "coach", plan_status: "past_due" });
      await db.query(`select public.apply_subscription('fake', 's1', $1, 'coach', 'cancelled', null, null, '{}')`, [A.clubId]);
      expect(await plan()).toEqual({ plan_code: "coach", plan_status: "canceled" });
      expect((await db.query(`select public.club_effective_plan($1) as p`, [A.clubId])).rows[0].p).toBe("free");
    } finally {
      await db.query("rollback");
    }
  });

  it("billing_events no es accesible desde clientes", async () => {
    await asUser(db, A.owner, async (q) => {
      expect(await q.count(`select count(*) from public.billing_events`)).toBe(0);
      expect(await q.fails(`insert into public.billing_events (provider, event_id, payload) values ('fake', 'x', '{}')`)).toBe("42501");
    });
  });
});

describe("envío al reloj", () => {
  it("los tokens del reloj no se pueden leer desde el cliente", async () => {
    await asUser(db, A.runner1, async (q) => {
      expect(await q.count(`select count(*) from public.watch_connections where user_id = $1`, [A.runner1.id])).toBe(1);
      expect(await q.fails(`select access_token from public.watch_connections`)).toBe("42501");
    });
  });

  it("request_watch_sync: solo sesiones visibles y con reloj conectado", async () => {
    await asUser(db, A.runner1, async (q) => {
      const [{ request_watch_sync: id }] = await q.rows<{ request_watch_sync: string }>(`select public.request_watch_sync($1, 'fake')`, [A.sessionClub]);
      expect(id).toBeTruthy();
      expect(await q.fails(`select public.request_watch_sync($1, 'fake')`, [A.sessionTargeted])).toBe("42501"); // no le toca
      expect(await q.fails(`select public.request_watch_sync($1, 'fake')`, [B.sessionClub])).toBe("42501");
      expect(await q.fails(`select public.request_watch_sync($1, 'garmin')`, [A.sessionClub])).toBe("P0001"); // no conectado
      expect(await q.fails(`select * from public.claim_watch_syncs(5)`)).toBe("42501");
    });
  });
});
