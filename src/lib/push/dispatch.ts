import "server-only";
import webpush, { WebPushError } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROOT_DOMAIN } from "@/lib/env";
import { clubOrigin } from "@/lib/hosts";

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hola@tropa.app", pub, priv);
  configured = true;
  return true;
}

export type DispatchResult = { claimed: number; sent: number; skipped: number; failed: number };

/**
 * Vacía la cola de push (tabla notifications con push_status = 'pending').
 * Se llama en segundo plano: con after() tras cada mutación y cada minuto desde pg_cron.
 * Es seguro correrlo en paralelo: claim_push_batch usa FOR UPDATE SKIP LOCKED.
 */
export async function dispatchPendingPush(maxBatches = 5): Promise<DispatchResult> {
  const result: DispatchResult = { claimed: 0, sent: 0, skipped: 0, failed: 0 };
  if (!configure()) return result;
  const admin = createAdminClient();

  for (let i = 0; i < maxBatches; i++) {
    const { data: batch, error } = await admin.rpc("claim_push_batch", { p_limit: 200 });
    if (error) throw error;
    if (!batch || batch.length === 0) break;
    result.claimed += batch.length;

    const userIds = [...new Set(batch.map((n) => n.user_id))];
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, club_id, user_id, endpoint, p256dh, auth, failed_count")
      .in("user_id", userIds);

    const sent: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    const deadSubs: string[] = [];
    const failingSubs: { id: string; failed_count: number }[] = [];

    await Promise.all(
      batch.map(async (n) => {
        const targets = (subs ?? []).filter((s) => s.user_id === n.user_id && s.club_id === n.club_id);
        if (targets.length === 0) return void skipped.push(n.notification_id);

        const origin = clubOrigin(n.club_slug, ROOT_DOMAIN);
        const payload = JSON.stringify({
          title: n.club_name,
          body: n.body ? `${n.title}: ${n.body}` : n.title,
          url: n.url ?? "/",
          icon: `${origin}/icon/192`,
          badge: `${origin}/icon/badge`,
          tag: n.kind,
        });

        let delivered = false;
        await Promise.all(
          targets.map(async (s) => {
            try {
              await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
                TTL: 60 * 60 * 24,
                urgency: "normal",
              });
              delivered = true;
            } catch (e) {
              const status = e instanceof WebPushError ? e.statusCode : 0;
              if (status === 404 || status === 410) deadSubs.push(s.id);
              else failingSubs.push({ id: s.id, failed_count: s.failed_count + 1 });
            }
          }),
        );
        (delivered ? sent : failed).push(n.notification_id);
      }),
    );

    if (sent.length) await admin.rpc("complete_push", { p_ids: sent, p_status: "sent" });
    if (skipped.length) await admin.rpc("complete_push", { p_ids: skipped, p_status: "skipped" });
    if (failed.length) await admin.rpc("complete_push", { p_ids: failed, p_status: "failed" });
    if (deadSubs.length) await admin.from("push_subscriptions").delete().in("id", deadSubs);
    for (const s of failingSubs) {
      if (s.failed_count >= 5) await admin.from("push_subscriptions").delete().eq("id", s.id);
      else await admin.from("push_subscriptions").update({ failed_count: s.failed_count }).eq("id", s.id);
    }

    result.sent += sent.length;
    result.skipped += skipped.length;
    result.failed += failed.length;
    if (batch.length < 200) break;
  }
  return result;
}

/** Para usar dentro de after(): nunca tira, solo loguea. */
export async function dispatchPushInBackground() {
  try {
    await dispatchPendingPush(2);
  } catch (e) {
    console.error("[push dispatch]", e);
  }
}
