"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionClub, actionStaff } from "@/lib/club";
import { errorMessage, zodFieldErrors, type ActionResult } from "@/lib/actions";
import { isValidSlug } from "@/lib/domain/slug";
import { brandingSchema, createClubSchema, type CreateClubInput } from "./schemas";
import type { Database } from "@/lib/supabase/database.types";

export async function checkSlug(slug: string): Promise<{ available: boolean; reason?: string }> {
  const s = slug.trim().toLowerCase();
  if (!isValidSlug(s)) return { available: false, reason: "Entre 3 y 32 caracteres: letras, números y guiones" };
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_slug_available", { p_slug: s });
  return data ? { available: true } : { available: false, reason: "Ya está en uso o es una dirección reservada" };
}

export async function createClub(input: CreateClubInput): Promise<ActionResult<{ id: string; slug: string }>> {
  const parsed = createClubSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los datos", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_club", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_color: parsed.data.color,
  });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  return { ok: true, data: { id: data.id, slug: data.slug } };
}

/** Guarda el logo ya subido a branding/{club_id}/… (lo valida RLS: solo staff). */
export async function setClubLogo(clubId: string, path: string | null): Promise<ActionResult> {
  if (path && !path.startsWith(`${clubId}/`)) return { ok: false, error: "Ruta inválida" };
  const supabase = await createClient();
  const { error, count } = await supabase.from("clubs").update({ logo_path: path }, { count: "exact" }).eq("id", clubId);
  if (error || count === 0) return { ok: false, error: errorMessage(error ?? { code: "42501" }) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateBranding(input: z.input<typeof brandingSchema>): Promise<ActionResult> {
  const { club, isOwner } = await actionClub();
  if (!isOwner) return { ok: false, error: "Solo el owner puede cambiar la marca." };
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá los datos", fieldErrors: zodFieldErrors(parsed.error.issues) };
  const supabase = await createClient();
  const { error } = await supabase
    .from("clubs")
    .update({ name: parsed.data.name, primary_color: parsed.data.color.toUpperCase() })
    .eq("id", club.id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Listo, actualizamos la marca del club." };
}

export async function regenerateInviteCode(): Promise<ActionResult<{ code: string }>> {
  const { club } = await actionStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("regenerate_invite_code", { p_club: club.id });
  if (error || !data) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: { code: data }, message: "Generamos un link nuevo. El anterior ya no funciona." };
}

export async function setOnboardingStep(step: number): Promise<ActionResult> {
  const { club, isOwner } = await actionClub();
  if (!isOwner || step <= club.onboarding_step) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("clubs").update({ onboarding_step: Math.min(step, 4) }).eq("id", club.id);
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true };
}

const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email("Revisá el email") });

export async function inviteCoach(input: z.input<typeof inviteSchema>): Promise<ActionResult<{ token: string }>> {
  const { club, isOwner, userId } = await actionClub();
  if (!isOwner) return { ok: false, error: "Solo el owner puede invitar coaches." };
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_invitations")
    .insert({ club_id: club.id, email: parsed.data.email, invited_by: userId })
    .select("token")
    .single();
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/ajustes");
  return { ok: true, data: { token: data.token } };
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  await actionClub();
  const supabase = await createClient();
  const { error } = await supabase.from("staff_invitations").delete().eq("id", id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/ajustes");
  return { ok: true };
}

export async function acceptStaffInvitation(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_staff_invitation", { p_token: token });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true };
}

export async function joinClub(code: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_club", { p_code: code });
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true };
}

type PlanStatus = Database["public"]["Enums"]["plan_status"];

export async function adminSetPlan(input: {
  clubId: string;
  plan: string;
  status: PlanStatus;
  override: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_club_plan", {
    p_club: input.clubId,
    p_plan: input.plan,
    p_status: input.status,
    p_override: input.override,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/admin");
  return { ok: true, message: "Plan actualizado." };
}
