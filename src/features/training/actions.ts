"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionClub, actionStaff } from "@/lib/club";
import { errorMessage, zodFieldErrors, type ActionResult } from "@/lib/actions";
import { dispatchPushInBackground } from "@/lib/push/dispatch";
import { mondayOf } from "@/lib/domain/dates";
import { sessionInputSchema, type SessionInput } from "./blocks";
import type { Json } from "@/lib/supabase/database.types";

export async function saveSession(input: SessionInput): Promise<ActionResult<{ id: string }>> {
  const { club, userId, isOwner } = await actionStaff();
  const parsed = sessionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá la sesión", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();

  const row = {
    club_id: club.id,
    date: v.date,
    title: v.title,
    type: v.type,
    blocks: v.blocks as unknown as NonNullable<Json>,
    notes: v.notes || null,
    audience: v.audience,
    shift_id: v.audience === "shift" ? v.shiftId! : null,
  };

  let id = v.id;
  if (id) {
    const { error } = await supabase.from("training_sessions").update(row).eq("id", id).eq("club_id", club.id);
    if (error) return { ok: false, error: errorMessage(error) };
    await supabase.from("training_session_targets").delete().eq("session_id", id);
  } else {
    const { data, error } = await supabase
      .from("training_sessions")
      .insert({ ...row, created_by: userId })
      .select("id")
      .single();
    if (error) return { ok: false, error: errorMessage(error) };
    id = data.id;
  }

  if (v.audience === "runners") {
    const { error } = await supabase
      .from("training_session_targets")
      .insert(v.runnerIds.map((uid) => ({ club_id: club.id, session_id: id!, user_id: uid })));
    if (error) return { ok: false, error: errorMessage(error) };
  }

  if (v.saveAsTemplate) {
    await supabase.from("session_templates").insert({
      club_id: club.id,
      title: v.title,
      type: v.type,
      blocks: v.blocks as unknown as NonNullable<Json>,
      notes: v.notes || null,
      created_by: userId,
    });
  }

  if (v.publish) {
    const { error } = await supabase.rpc("publish_session", { p_session: id });
    if (error) return { ok: false, error: errorMessage(error) };
    after(dispatchPushInBackground);
    // Paso 3 del onboarding: la primera sesión publicada lo completa.
    if (isOwner && club.onboarding_step < 4) await supabase.from("clubs").update({ onboarding_step: 4 }).eq("id", club.id);
  }

  revalidatePath("/", "layout");
  return { ok: true, data: { id }, message: v.publish ? "Sesión publicada y enviada." : "Guardada como borrador." };
}

export async function publishSession(id: string): Promise<ActionResult> {
  await actionStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_session", { p_session: id });
  if (error) return { ok: false, error: errorMessage(error) };
  after(dispatchPushInBackground);
  revalidatePath("/", "layout");
  return { ok: true, message: "Sesión publicada." };
}

export async function deleteSession(id: string): Promise<ActionResult> {
  const { club } = await actionStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("training_sessions").delete().eq("id", id).eq("club_id", club.id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Sesión eliminada." };
}

const completeSchema = z.object({
  sessionId: z.string().uuid(),
  feeling: z.number().int().min(1).max(5).nullable(),
  comment: z.string().trim().max(500).optional(),
});

export async function completeSession(input: z.input<typeof completeSchema>): Promise<ActionResult> {
  const { club, userId } = await actionClub();
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los datos" };
  const supabase = await createClient();
  const { error } = await supabase.from("session_completions").upsert({
    club_id: club.id,
    session_id: parsed.data.sessionId,
    user_id: userId,
    feeling: parsed.data.feeling,
    comment: parsed.data.comment || null,
    completed_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "¡Bien ahí! Sesión completada." };
}

export async function uncompleteSession(sessionId: string): Promise<ActionResult> {
  const { userId } = await actionClub();
  const supabase = await createClient();
  const { error } = await supabase.from("session_completions").delete().eq("session_id", sessionId).eq("user_id", userId);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const { club } = await actionStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("session_templates").delete().eq("id", id).eq("club_id", club.id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/plan/biblioteca");
  return { ok: true, message: "Plantilla eliminada." };
}

export async function duplicateWeek(fromDate: string): Promise<ActionResult<{ count: number }>> {
  const { club } = await actionStaff();
  const from = mondayOf(fromDate);
  const to = mondayOf(new Date(Date.parse(from) + 7 * 86_400_000).toISOString().slice(0, 10));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_week", { p_club: club.id, p_from_monday: from, p_to_monday: to });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/plan");
  return {
    ok: true,
    data: { count: data ?? 0 },
    message: data ? `Copiamos ${data} sesiones a la semana siguiente como borrador.` : "No hay sesiones para copiar en esta semana.",
  };
}
