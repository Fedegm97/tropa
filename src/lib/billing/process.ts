import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingProvider } from "./index";
import { InvalidSignatureError } from "./types";

export type ProcessResult = { status: number; body: Record<string, unknown> };

/**
 * Procesa un webhook de cobros de forma idempotente:
 * verifica firma → consulta estado real → registra el evento (único por proveedor) → aplica al club.
 */
export async function processBillingWebhook(providerName: string, req: { url: string; headers: Headers; body: string }): Promise<ProcessResult> {
  const provider = getBillingProvider(providerName);
  if (!provider) return { status: 404, body: { error: "provider not configured" } };

  let result;
  try {
    result = await provider.handleWebhook(req);
  } catch (e) {
    if (e instanceof InvalidSignatureError) return { status: 401, body: { error: "invalid signature" } };
    console.error("[billing webhook]", e);
    return { status: 500, body: { error: "provider error" } };
  }
  if (result.kind === "ignored") return { status: 200, body: { ignored: result.reason } };

  const admin = createAdminClient();
  const s = result.subscription;
  const { data: inserted, error: insertError } = await admin
    .from("billing_events")
    .upsert(
      { provider: provider.name, event_id: result.eventId, type: result.type, payload: JSON.parse(JSON.stringify(s.raw ?? {})) },
      { onConflict: "provider,event_id", ignoreDuplicates: true },
    )
    .select("id");
  if (insertError) return { status: 500, body: { error: insertError.message } };
  if (!inserted || inserted.length === 0) {
    const { data: prev } = await admin.from("billing_events").select("processed_at").eq("provider", provider.name).eq("event_id", result.eventId).single();
    if (prev?.processed_at) return { status: 200, body: { duplicate: true } };
  }

  const { error } = await admin.rpc("apply_subscription", {
    p_provider: provider.name,
    p_external_id: s.externalId,
    p_club: s.clubId,
    p_plan: s.plan,
    p_status: s.status,
    p_period_end: s.periodEnd ?? undefined,
    p_payer_email: s.payerEmail ?? undefined,
    p_raw: JSON.parse(JSON.stringify(s.raw ?? {})),
  });
  await admin
    .from("billing_events")
    .update(error ? { error: error.message } : { processed_at: new Date().toISOString(), error: null })
    .eq("provider", provider.name)
    .eq("event_id", result.eventId);
  if (error) return { status: 500, body: { error: error.message } };

  // Cambio de plan: al autorizarse una suscripción nueva, se cancelan las anteriores del club.
  if (s.status === "authorized") {
    const { data: others } = await admin
      .from("platform_subscriptions")
      .select("provider, external_id, plan_code")
      .eq("club_id", s.clubId)
      .eq("status", "authorized")
      .neq("external_id", s.externalId);
    for (const o of others ?? []) {
      try {
        await getBillingProvider(o.provider)?.cancel(o.external_id);
        await admin.rpc("apply_subscription", {
          p_provider: o.provider,
          p_external_id: o.external_id,
          p_club: s.clubId,
          p_plan: o.plan_code,
          p_status: "cancelled",
          p_raw: { replaced_by: s.externalId },
        });
      } catch (e) {
        console.error("[billing] no se pudo cancelar la suscripción anterior", o.external_id, e);
      }
    }
  }
  return { status: 200, body: { ok: true, status: s.status } };
}
