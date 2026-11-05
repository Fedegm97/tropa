import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBlocks } from "@/features/training/blocks";
import { ROOT_DOMAIN } from "@/lib/env";
import { rootOrigin } from "@/lib/hosts";
import { getWatchProvider } from "./providers";
import { toGarminWorkout } from "./workout";

/** Envía al reloj los pedidos pendientes (cola watch_syncs). Seguro de correr en paralelo. */
export async function dispatchWatchSyncs(limit = 20) {
  const admin = createAdminClient();
  const { data: batch, error } = await admin.rpc("claim_watch_syncs", { p_limit: limit });
  if (error) throw error;
  const result = { claimed: batch?.length ?? 0, sent: 0, failed: 0 };

  for (const job of batch ?? []) {
    const fail = async (message: string) => {
      result.failed++;
      await admin.from("watch_syncs").update({ status: "failed", error: message.slice(0, 300) }).eq("id", job.id);
    };
    try {
      const provider = getWatchProvider(job.provider, rootOrigin(ROOT_DOMAIN));
      if (!provider) {
        await fail("Proveedor no configurado");
        continue;
      }
      const [{ data: session }, { data: membership }, { data: conn }] = await Promise.all([
        admin.from("training_sessions").select("title, notes, blocks, date").eq("id", job.session_id).single(),
        admin.from("memberships").select("ref_pace_s_per_km, ref_pace_kind").eq("club_id", job.club_id).eq("user_id", job.user_id).single(),
        admin.from("watch_connections").select("*").eq("user_id", job.user_id).eq("provider", job.provider).maybeSingle(),
      ]);
      if (!session || !membership) {
        await fail("Sesión no encontrada");
        continue;
      }
      if (!conn?.access_token) {
        await fail("Reloj desconectado");
        continue;
      }

      let token = conn.access_token;
      if (conn.expires_at && Date.parse(conn.expires_at) < Date.now() && conn.refresh_token) {
        const t = await provider.refresh(conn.refresh_token);
        token = t.accessToken;
        await admin
          .from("watch_connections")
          .update({ access_token: t.accessToken, refresh_token: t.refreshToken ?? conn.refresh_token, expires_at: t.expiresAt })
          .eq("user_id", job.user_id)
          .eq("provider", job.provider);
      }

      const ref = membership.ref_pace_s_per_km ? { secPerKm: membership.ref_pace_s_per_km, kind: membership.ref_pace_kind } : null;
      const workout = toGarminWorkout({ title: session.title, notes: session.notes, blocks: parseBlocks(session.blocks) }, ref);
      const externalId = await provider.pushWorkout(token, workout, session.date);
      await admin.from("watch_syncs").update({ status: "on_watch", external_workout_id: externalId, error: null }).eq("id", job.id);
      result.sent++;
    } catch (e) {
      console.error("[watch dispatch]", e);
      await fail(e instanceof Error ? e.message : "Error desconocido");
    }
  }
  return result;
}

export async function dispatchWatchInBackground() {
  try {
    await dispatchWatchSyncs(5);
  } catch (e) {
    console.error("[watch dispatch]", e);
  }
}
