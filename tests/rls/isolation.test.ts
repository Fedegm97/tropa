/**
 * Aislamiento entre clubes (RLS).
 *
 * Requiere Supabase local (`pnpm db:start`) con las migraciones aplicadas.
 * Crea dos clubes completos (A y B) y verifica que ningún usuario de A pueda
 * leer, escribir, modificar ni borrar datos de B, tabla por tabla.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, connect, createClubFixture, createUser, dropClubFixture, type ClubFixture, type Db, type TestUser } from "./helpers";

let db: Db;
let A: ClubFixture;
let B: ClubFixture;
let outsider: TestUser;
let clubTables: string[];

beforeAll(async () => {
  db = await connect();
  A = await createClubFixture(db, "a");
  B = await createClubFixture(db, "b");
  outsider = await createUser(db, "outsider");
  const { rows } = await db.query<{ table_name: string }>(
    `select c.table_name from information_schema.columns c
     join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
     where c.table_schema = 'public' and c.column_name = 'club_id' and t.table_type = 'BASE TABLE'
     order by 1`,
  );
  clubTables = rows.map((r) => r.table_name);
});

afterAll(async () => {
  if (A) await dropClubFixture(db, A);
  if (B) await dropClubFixture(db, B);
  if (outsider) await db.query("delete from auth.users where id = $1", [outsider.id]);
  await db?.end();
});

describe("cobertura de RLS", () => {
  it("todas las tablas de public tienen RLS habilitado", async () => {
    const { rows } = await db.query(
      `select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it("toda tabla con club_id tiene al menos una política", async () => {
    const { rows } = await db.query(
      `select t from unnest($1::text[]) t
       where not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t)`,
      [clubTables],
    );
    expect(rows).toEqual([]);
  });

  it("detecta las tablas de negocio esperadas", () => {
    for (const t of ["clubs", "memberships", "shifts", "training_sessions", "session_completions", "announcements", "notifications"]) {
      if (t !== "clubs") expect(clubTables).toContain(t);
    }
  });
});

describe("lectura cruzada: nadie de A ve nada de B", () => {
  const roles = ["owner", "coach", "runner1", "runner2"] as const;

  for (const role of roles) {
    it(`${role} de A: 0 filas de B en todas las tablas con club_id`, async () => {
      const leaks = await asUser(db, A[role], async (q) => {
        const found: Record<string, number> = {};
        for (const table of clubTables) {
          const n = await q.count(`select count(*) from public.${table} where club_id = $1`, [B.clubId]);
          if (n > 0) found[table] = n;
        }
        found.clubs = await q.count(`select count(*) from public.clubs where id = $1`, [B.clubId]);
        if (found.clubs === 0) delete found.clubs;
        return found;
      });
      expect(leaks).toEqual({});
    });
  }

  it("un usuario sin club no ve datos de ningún club", async () => {
    const leaks = await asUser(db, outsider, async (q) => {
      let total = 0;
      for (const table of clubTables) {
        total += await q.count(`select count(*) from public.${table} where club_id = any($1)`, [[A.clubId, B.clubId]]);
      }
      return total + (await q.count(`select count(*) from public.clubs`));
    });
    expect(leaks).toBe(0);
  });

  it("anónimo no ve nada (salvo el catálogo de planes)", async () => {
    const leaks = await asUser(db, null, async (q) => {
      let total = 0;
      for (const table of [...clubTables, "clubs", "profiles", "profile_private"]) {
        total += await q.count(`select count(*) from public.${table}`);
      }
      return total;
    });
    expect(leaks).toBe(0);
  });

  it("perfiles: no veo nombres ni datos privados de corredores de otro club", async () => {
    await asUser(db, A.coach, async (q) => {
      expect(await q.count(`select count(*) from public.profiles where id = $1`, [B.runner1.id])).toBe(0);
      expect(await q.count(`select count(*) from public.profile_private where user_id = $1`, [B.runner1.id])).toBe(0);
      // pero sí los de mi club
      expect(await q.count(`select count(*) from public.profile_private where user_id = $1`, [A.runner1.id])).toBe(1);
    });
  });

  it("storage: no puedo leer archivos de otro club", async () => {
    await asUser(db, A.owner, async (q) => {
      expect(
        await q.count(`select count(*) from storage.objects where bucket_id = 'club-files' and name like $1`, [`${B.clubId}/%`]),
      ).toBe(0);
    });
  });
});

describe("escritura cruzada: A no puede modificar B", () => {
  it("no puede crear turnos, sesiones ni avisos en B", async () => {
    await asUser(db, A.owner, async (q) => {
      expect(
        await q.fails(
          `insert into public.shifts (club_id, name, days, starts_at, ends_at) values ($1, 'X', '{1}', '07:00', '08:00')`,
          [B.clubId],
        ),
      ).toBe("42501");
      expect(
        await q.fails(`insert into public.training_sessions (club_id, date, title, type) values ($1, current_date, 'X', 'rest')`, [
          B.clubId,
        ]),
      ).toBe("42501");
      expect(
        await q.fails(`insert into public.announcements (club_id, author_id, body) values ($1, $2, 'hack')`, [B.clubId, A.owner.id]),
      ).toBe("42501");
    });
  });

  it("UPDATE y DELETE sobre B no afectan ninguna fila", async () => {
    await asUser(db, A.owner, async (q) => {
      expect(await q.exec(`update public.clubs set name = 'hackeado' where id = $1`, [B.clubId])).toBe(0);
      expect(await q.exec(`update public.memberships set role = 'coach' where club_id = $1`, [B.clubId])).toBe(0);
      expect(await q.exec(`delete from public.training_sessions where club_id = $1`, [B.clubId])).toBe(0);
      expect(await q.exec(`delete from public.announcements where club_id = $1`, [B.clubId])).toBe(0);
      expect(await q.exec(`delete from public.memberships where club_id = $1`, [B.clubId])).toBe(0);
      expect(await q.exec(`update public.shifts set name = 'x' where club_id = $1`, [B.clubId])).toBe(0);
    });
  });

  it("no puedo meter filas de mi club que apunten a datos de B (FK compuesta)", async () => {
    await asUser(db, A.coach, async (q) => {
      // Sesión de A asignada a un corredor de B
      const [{ id }] = await q.rows<{ id: string }>(
        `insert into public.training_sessions (club_id, date, title, type, audience) values ($1, current_date, 'X', 'rest', 'runners') returning id`,
        [A.clubId],
      );
      expect(
        await q.fails(`insert into public.training_session_targets (club_id, session_id, user_id) values ($1, $2, $3)`, [
          A.clubId,
          id,
          B.runner1.id,
        ]),
      ).toBe("23503");
      // Sesión de A segmentada a un turno de B
      expect(
        await q.fails(
          `insert into public.training_sessions (club_id, date, title, type, audience, shift_id) values ($1, current_date, 'X', 'rest', 'shift', $2)`,
          [A.clubId, B.shiftId],
        ),
      ).toBe("23503");
    });
  });

  it("un corredor de A no puede completar, reaccionar ni marcar visto en B", async () => {
    await asUser(db, A.runner1, async (q) => {
      expect(
        await q.fails(`insert into public.session_completions (club_id, session_id, user_id) values ($1, $2, $3)`, [
          B.clubId,
          B.sessionClub,
          A.runner1.id,
        ]),
      ).toMatch(/42501|23503/);
      expect(
        await q.fails(`insert into public.session_completions (club_id, session_id, user_id) values ($1, $2, $3)`, [
          A.clubId,
          B.sessionClub,
          A.runner1.id,
        ]),
      ).toMatch(/42501|23503/);
      expect(
        await q.fails(`insert into public.announcement_reactions (club_id, announcement_id, user_id, emoji) values ($1, $2, $3, '🔥')`, [
          B.clubId,
          B.announcementId,
          A.runner1.id,
        ]),
      ).toBe("42501");
      expect(
        await q.fails(`insert into public.announcement_views (club_id, announcement_id, user_id) values ($1, $2, $3)`, [
          B.clubId,
          B.announcementId,
          A.runner1.id,
        ]),
      ).toBe("42501");
    });
  });

  it("no puedo suscribirme a push ni regenerar el código de otro club", async () => {
    await asUser(db, A.owner, async (q) => {
      expect(
        await q.fails(`select public.upsert_push_subscription($1, 'https://push.example/x', 'k', 'a')`, [B.clubId]),
      ).toBe("42501");
      expect(await q.fails(`select public.regenerate_invite_code($1)`, [B.clubId])).toBe("42501");
      expect(await q.fails(`select public.publish_session($1)`, [B.sessionDraft])).toBe("42501");
    });
  });

  it("storage: no puedo subir archivos a la carpeta de otro club", async () => {
    await asUser(db, A.owner, async (q) => {
      expect(
        await q.fails(`insert into storage.objects (bucket_id, name) values ('branding', $1)`, [`${B.clubId}/logo-hack.webp`]),
      ).toBe("42501");
      expect(
        await q.fails(`insert into storage.objects (bucket_id, name) values ('club-files', $1)`, [
          `${B.clubId}/announcements/${A.owner.id}/x.webp`,
        ]),
      ).toBe("42501");
    });
  });
});

describe("permisos dentro del club", () => {
  it("el corredor solo ve las sesiones publicadas que le tocan", async () => {
    const r1 = await asUser(db, A.runner1, (q) =>
      q.rows<{ id: string }>(`select id from public.training_sessions where club_id = $1`, [A.clubId]),
    );
    expect(r1.map((r) => r.id).sort()).toEqual([A.sessionClub, A.sessionShift].sort());

    const r2 = await asUser(db, A.runner2, (q) =>
      q.rows<{ id: string }>(`select id from public.training_sessions where club_id = $1`, [A.clubId]),
    );
    expect(r2.map((r) => r.id).sort()).toEqual([A.sessionClub, A.sessionTargeted].sort());

    const coach = await asUser(db, A.coach, (q) =>
      q.count(`select count(*) from public.training_sessions where club_id = $1`, [A.clubId]),
    );
    expect(coach).toBe(4); // incluye el borrador
  });

  it("avisos por turno: solo los ve ese turno y el staff", async () => {
    expect(
      await asUser(db, A.runner1, (q) => q.count(`select count(*) from public.announcements where id = $1`, [A.announcementShift])),
    ).toBe(1);
    expect(
      await asUser(db, A.runner2, (q) => q.count(`select count(*) from public.announcements where id = $1`, [A.announcementShift])),
    ).toBe(0);
  });

  it("un corredor no ve datos privados ni completadas de otro corredor", async () => {
    await asUser(db, A.runner1, async (q) => {
      expect(await q.count(`select count(*) from public.profile_private where user_id = $1`, [A.runner2.id])).toBe(0);
      expect(await q.count(`select count(*) from public.session_completions where user_id = $1`, [A.runner2.id])).toBe(0);
      expect(await q.count(`select count(*) from public.notifications where user_id <> $1`, [A.runner1.id])).toBe(0);
      // Sí ve el nombre de sus compañeros (para avatares y eventos)
      expect(await q.count(`select count(*) from public.profiles where id = $1`, [A.runner2.id])).toBe(1);
    });
  });

  it("un corredor no puede leer el comprobante de otro corredor", async () => {
    const n = await asUser(db, A.runner2, (q) =>
      q.count(`select count(*) from storage.objects where name like $1`, [`${A.clubId}/receipts/%`]),
    );
    expect(n).toBe(0);
    const own = await asUser(db, A.runner1, (q) =>
      q.count(`select count(*) from storage.objects where name like $1`, [`${A.clubId}/receipts/%`]),
    );
    expect(own).toBe(1);
  });

  it("un corredor edita su ritmo pero no su rol, turno ni nivel", async () => {
    await asUser(db, A.runner1, async (q) => {
      expect(
        await q.exec(`update public.memberships set ref_pace_s_per_km = 290 where club_id = $1 and user_id = $2`, [A.clubId, A.runner1.id]),
      ).toBe(1);
      expect(
        await q.fails(`update public.memberships set role = 'coach' where club_id = $1 and user_id = $2`, [A.clubId, A.runner1.id]),
      ).toBe("42501");
      expect(
        await q.fails(`update public.memberships set level = 'advanced' where club_id = $1 and user_id = $2`, [A.clubId, A.runner1.id]),
      ).toBe("42501");
      // No puede editar el ritmo de otro
      expect(
        await q.exec(`update public.memberships set ref_pace_s_per_km = 200 where club_id = $1 and user_id = $2`, [A.clubId, A.runner2.id]),
      ).toBe(0);
      // Ni crear sesiones
      expect(
        await q.fails(`insert into public.training_sessions (club_id, date, title, type) values ($1, current_date, 'X', 'rest')`, [A.clubId]),
      ).toBe("42501");
    });
  });

  it("el coach no puede cambiar roles; el owner sí (pero nadie se hace owner)", async () => {
    await asUser(db, A.coach, async (q) => {
      expect(
        await q.fails(`update public.memberships set role = 'coach' where club_id = $1 and user_id = $2`, [A.clubId, A.runner1.id]),
      ).toBe("42501");
    });
    await asUser(db, A.owner, async (q) => {
      expect(
        await q.exec(`update public.memberships set role = 'coach' where club_id = $1 and user_id = $2`, [A.clubId, A.runner1.id]),
      ).toBe(1);
      expect(
        await q.fails(`update public.memberships set role = 'owner' where club_id = $1 and user_id = $2`, [A.clubId, A.runner2.id]),
      ).toBe("42501");
    });
  });

  it("nadie del club puede tocar el plan ni hacerse superadmin", async () => {
    await asUser(db, A.owner, async (q) => {
      expect(await q.fails(`update public.clubs set plan_code = 'club' where id = $1`, [A.clubId])).toBe("42501");
      expect(await q.fails(`update public.profiles set is_superadmin = true where id = $1`, [A.owner.id])).toBe("42501");
      expect(await q.fails(`select * from public.admin_clubs_overview()`)).toBe("42501");
      expect(await q.fails(`select public.admin_set_club_plan($1, 'club', 'active', true)`, [A.clubId])).toBe("42501");
      // Sí puede cambiar nombre y color
      expect(await q.exec(`update public.clubs set name = 'Nuevo nombre', primary_color = '#00AAFF' where id = $1`, [A.clubId])).toBe(1);
    });
  });

  it("la cola de push no es accesible desde clientes", async () => {
    await asUser(db, A.owner, async (q) => {
      expect(await q.fails(`select * from public.claim_push_batch(10)`)).toBe("42501");
      expect(await q.fails(`update public.notifications set push_status = 'sent' where user_id = $1`, [A.owner.id])).toBe("42501");
    });
  });
});

describe("altas por invitación", () => {
  it("join_club con un código inválido falla y con uno válido suma como corredor", async () => {
    await asUser(db, outsider, async (q) => {
      expect(await q.fails(`select public.join_club('NOEXISTE')`)).toBe("P0002");
      const [{ join_club }] = await q.rows<{ join_club: string }>(`select public.join_club($1)`, [A.inviteCode.toLowerCase()]);
      expect(join_club).toBe(A.clubId);
      const [m] = await q.rows<{ role: string }>(`select role from public.memberships where club_id = $1 and user_id = $2`, [
        A.clubId,
        outsider.id,
      ]);
      expect(m.role).toBe("runner");
      // Unirse a A no le da acceso a B
      expect(await q.count(`select count(*) from public.training_sessions where club_id = $1`, [B.clubId])).toBe(0);
    });
  });

  it("respeta el límite del plan Free sin tocar a los que ya están", async () => {
    await db.query(`update public.clubs set plan_code = 'free', plan_override = false where id = $1`, [A.clubId]);
    try {
      // A ya tiene 2 corredores; llenamos hasta 10
      const extra: TestUser[] = [];
      for (let i = 0; i < 8; i++) extra.push(await createUser(db, `extra${i}`));
      await db.query(`insert into public.memberships (club_id, user_id) select $1, unnest($2::uuid[])`, [A.clubId, extra.map((u) => u.id)]);
      await asUser(db, outsider, async (q) => {
        expect(await q.fails(`select public.join_club($1)`, [A.inviteCode])).toBe("P0001");
      });
      // Los existentes siguen viendo sus sesiones
      expect(
        await asUser(db, A.runner1, (q) => q.count(`select count(*) from public.training_sessions where club_id = $1`, [A.clubId])),
      ).toBe(2);
      await db.query(`delete from auth.users where id = any($1)`, [extra.map((u) => u.id)]);
    } finally {
      await db.query(`update public.clubs set plan_code = 'team', plan_override = true where id = $1`, [A.clubId]);
    }
  });
});
