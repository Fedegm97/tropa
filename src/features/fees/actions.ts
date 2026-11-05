"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionClub, actionStaff, clubHas } from "@/lib/club";
import { errorMessage, type ActionResult } from "@/lib/actions";
import { dispatchPushInBackground } from "@/lib/push/dispatch";
import { parseMoney } from "@/lib/domain/money";

const period = z.string().regex(/^\d{4}-\d{2}-01$/, "Período inválido");
const money = z.string().transform((v, ctx) => {
  const cents = parseMoney(v);
  if (cents === null) {
    ctx.addIssue({ code: "custom", message: "Escribí un monto válido, por ejemplo 25.000" });
    return z.NEVER;
  }
  return cents;
});

const declareSchema = z.object({
  period,
  amount: money.refine((c) => c > 0, "El monto tiene que ser mayor a 0"),
  method: z.enum(["transfer", "cash", "mercadopago", "other"]),
  receiptPath: z.string().nullable().optional(),
  note: z.string().trim().max(300).optional(),
});

export async function declarePayment(input: z.input<typeof declareSchema>): Promise<ActionResult> {
  const { club, userId } = await actionClub();
  if (!clubHas(club, "fees")) return { ok: false, error: "Tu club no tiene activadas las cuotas." };
  const parsed = declareSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("fee_payments").insert({
    club_id: club.id,
    user_id: userId,
    period: v.period,
    amount_cents: v.amount,
    method: v.method,
    receipt_path: v.receiptPath ?? null,
    note: v.note || null,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  after(dispatchPushInBackground);
  revalidatePath("/", "layout");
  return { ok: true, message: "Listo. El coach lo va a confirmar." };
}

export async function deletePayment(id: string): Promise<ActionResult> {
  const { userId } = await actionClub();
  const supabase = await createClient();
  const { data } = await supabase.from("fee_payments").select("receipt_path").eq("id", id).maybeSingle();
  const { error, count } = await supabase.from("fee_payments").delete({ count: "exact" }).eq("id", id).eq("user_id", userId);
  if (error || !count) return { ok: false, error: errorMessage(error ?? { code: "42501" }) };
  if (data?.receipt_path) await supabase.storage.from("club-files").remove([data.receipt_path]);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reviewPayment(id: string, approve: boolean, reason?: string): Promise<ActionResult> {
  await actionStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_fee_payment", { p_payment: id, p_approve: approve, p_reason: reason ?? undefined });
  if (error) return { ok: false, error: errorMessage(error) };
  after(dispatchPushInBackground);
  revalidatePath("/", "layout");
  return { ok: true, message: approve ? "Pago confirmado." : "Pago rechazado. Le avisamos al corredor." };
}

const ruleSchema = z.object({
  scope: z.enum(["club", "shift", "runner"]),
  targetId: z.string().uuid().nullable().optional(),
  amount: money,
  validFrom: period,
});

export async function saveFeeRule(input: z.input<typeof ruleSchema>): Promise<ActionResult> {
  const { club, userId } = await actionStaff();
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const v = parsed.data;
  if (v.scope !== "club" && !v.targetId) return { ok: false, error: v.scope === "shift" ? "Elegí un turno" : "Elegí un corredor" };
  const supabase = await createClient();
  const { error } = await supabase.from("fee_rules").insert({
    club_id: club.id,
    shift_id: v.scope === "shift" ? v.targetId! : null,
    user_id: v.scope === "runner" ? v.targetId! : null,
    amount_cents: v.amount,
    valid_from: v.validFrom,
    created_by: userId,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/cuotas", "layout");
  return { ok: true, message: "Monto guardado." };
}

export async function deleteFeeRule(id: string): Promise<ActionResult> {
  const { club } = await actionStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("fee_rules").delete().eq("id", id).eq("club_id", club.id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/cuotas", "layout");
  return { ok: true };
}

export async function updateClubSettings(patch: { fee_reminder_day?: number; birthday_greeting?: boolean }): Promise<ActionResult> {
  const { club, isOwner } = await actionClub();
  if (!isOwner) return { ok: false, error: "Solo el owner puede cambiar esta configuración." };
  if (patch.fee_reminder_day !== undefined && !(Number.isInteger(patch.fee_reminder_day) && patch.fee_reminder_day >= 1 && patch.fee_reminder_day <= 28))
    return { ok: false, error: "Elegí un día entre 1 y 28." };
  const supabase = await createClient();
  const settings = { ...((club.settings as object) ?? {}), ...patch };
  const { error } = await supabase.from("clubs").update({ settings }).eq("id", club.id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Configuración guardada." };
}
