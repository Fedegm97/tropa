"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionClub, currentOrigin, getUser } from "@/lib/club";
import { errorMessage, type ActionResult } from "@/lib/actions";
import { getBillingProvider, type PaidPlan } from "@/lib/billing";
import { PLATFORM_NAME } from "@/lib/env";

function isPaidPlan(p: string): p is PaidPlan {
  return p === "coach" || p === "team";
}

export async function startTrial(plan: string): Promise<ActionResult> {
  const { club, isOwner } = await actionClub();
  if (!isOwner) return { ok: false, error: "Solo el owner puede cambiar el plan." };
  if (!isPaidPlan(plan)) return { ok: false, error: "Plan inválido" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_trial", { p_club: club.id, p_plan: plan });
  if (error) {
    if (error.message.includes("trial_already_used")) return { ok: false, error: "Tu club ya usó la prueba gratis." };
    if (error.message.includes("already_on_paid_plan")) return { ok: false, error: "Ya estás en un plan pago." };
    return { ok: false, error: errorMessage(error) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "¡Listo! Tenés 30 días gratis, sin tarjeta." };
}

export async function startSubscription(plan: string): Promise<ActionResult<{ url: string }>> {
  const { club, isOwner } = await actionClub();
  if (!isOwner) return { ok: false, error: "Solo el owner puede suscribirse." };
  if (!isPaidPlan(plan)) return { ok: false, error: "Plan inválido" };
  const provider = getBillingProvider();
  if (!provider) return { ok: false, error: "Los pagos online no están configurados todavía. Escribinos y lo activamos." };

  const supabase = await createClient();
  const [{ data: planRow }, user] = await Promise.all([
    supabase.from("platform_plans").select("name, price_ars_cents").eq("code", plan).single(),
    getUser(),
  ]);
  if (!planRow?.price_ars_cents || !user?.email) return { ok: false, error: "No pudimos iniciar el pago." };

  try {
    const checkout = await provider.createCheckout({
      clubId: club.id,
      plan,
      reason: `${PLATFORM_NAME} · Plan ${planRow.name} · ${club.name}`,
      amountCents: planRow.price_ars_cents,
      currency: "ARS",
      payerEmail: user.email,
      backUrl: `${await currentOrigin()}/ajustes/plan`,
    });
    // Registramos la suscripción como pendiente; el webhook la activa.
    await createAdminClient().rpc("apply_subscription", {
      p_provider: provider.name,
      p_external_id: checkout.externalId,
      p_club: club.id,
      p_plan: plan,
      p_status: "pending",
      p_payer_email: user.email,
      p_raw: {},
    });
    return { ok: true, data: { url: checkout.url } };
  } catch (e) {
    console.error("[checkout]", e);
    return { ok: false, error: "No pudimos conectar con Mercado Pago. Probá de nuevo en un rato." };
  }
}

export async function cancelSubscription(): Promise<ActionResult> {
  const { club, isOwner } = await actionClub();
  if (!isOwner) return { ok: false, error: "Solo el owner puede cancelar." };
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("platform_subscriptions")
    .select("provider, external_id, plan_code")
    .eq("club_id", club.id)
    .eq("status", "authorized")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return { ok: false, error: "No hay una suscripción activa." };
  const provider = getBillingProvider(sub.provider);
  if (!provider) return { ok: false, error: "El proveedor de pagos no está configurado." };
  try {
    await provider.cancel(sub.external_id);
    await createAdminClient().rpc("apply_subscription", {
      p_provider: provider.name,
      p_external_id: sub.external_id,
      p_club: club.id,
      p_plan: sub.plan_code,
      p_status: "cancelled",
      p_raw: { cancelled_from: "app" },
    });
  } catch (e) {
    console.error("[cancel]", e);
    return { ok: false, error: "No pudimos cancelar la suscripción. Probá de nuevo." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Suscripción cancelada. Tus datos quedan guardados." };
}
