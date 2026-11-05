"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionClub, actionStaff } from "@/lib/club";
import { errorMessage, zodFieldErrors, type ActionResult } from "@/lib/actions";
import { profileSchema, runnerAdminSchema, type ProfileInput, type RunnerAdminInput } from "./schemas";

export async function updateMyProfile(input: ProfileInput & { complete?: boolean }): Promise<ActionResult> {
  const { club, userId } = await actionClub();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los datos", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const v = parsed.data;
  if (v.avatarPath && !v.avatarPath.startsWith(`${userId}/`)) return { ok: false, error: "Foto inválida" };

  const supabase = await createClient();
  const profileUpdate: { full_name: string; avatar_path?: string | null; completed_at?: string } = { full_name: v.fullName };
  if (v.avatarPath !== undefined) profileUpdate.avatar_path = v.avatarPath;
  if (input.complete) profileUpdate.completed_at = new Date().toISOString();

  const results = await Promise.all([
    supabase.from("profiles").update(profileUpdate).eq("id", userId),
    supabase
      .from("profile_private")
      .update({ birth_date: v.birthDate, phone: v.phone, emergency_name: v.emergencyName, emergency_phone: v.emergencyPhone })
      .eq("user_id", userId),
    supabase.from("memberships").update({ ref_pace_s_per_km: v.pace, ref_pace_kind: v.paceKind }).eq("club_id", club.id).eq("user_id", userId),
  ]);
  const error = results.find((r) => r.error)?.error;
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Perfil guardado." };
}

export async function updateRunner(input: RunnerAdminInput): Promise<ActionResult> {
  const { club } = await actionStaff();
  const parsed = runnerAdminSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los datos", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ shift_id: v.shiftId, level: v.level, ref_pace_s_per_km: v.pace, ref_pace_kind: v.paceKind })
    .eq("club_id", club.id)
    .eq("user_id", v.userId);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/corredores");
  return { ok: true, message: "Cambios guardados." };
}

export async function setMemberRole(userId: string, role: "coach" | "runner"): Promise<ActionResult> {
  const { club, isOwner } = await actionClub();
  if (!isOwner) return { ok: false, error: "Solo el owner puede cambiar roles." };
  if (role === "coach") {
    const supabase = await createClient();
    const { data: can } = await supabase.rpc("club_can_add", { p_club: club.id, p_role: "coach" });
    if (!can) return { ok: false, error: "Llegaste al límite de coaches de tu plan. Mejorá el plan para sumar más." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").update({ role }).eq("club_id", club.id).eq("user_id", userId);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: role === "coach" ? "Ahora es coach del club." : "Ahora es corredor." };
}

export async function deactivateMember(userId: string): Promise<ActionResult> {
  const { club } = await actionStaff();
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("memberships")
    .update({ status: "inactive" }, { count: "exact" })
    .eq("club_id", club.id)
    .eq("user_id", userId);
  if (error || !count) return { ok: false, error: errorMessage(error ?? { code: "42501" }) };
  revalidatePath("/corredores");
  return { ok: true, message: "Lo dimos de baja del club. Sus datos se conservan." };
}
