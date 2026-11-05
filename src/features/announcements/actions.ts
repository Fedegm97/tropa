"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionClub, actionStaff } from "@/lib/club";
import { errorMessage, zodFieldErrors, type ActionResult } from "@/lib/actions";
import { dispatchPushInBackground } from "@/lib/push/dispatch";
import { REACTIONS } from "./reactions";


const announcementSchema = z
  .object({
    body: z.string().trim().min(1, "Escribí el aviso").max(2000, "Máximo 2000 caracteres"),
    audience: z.enum(["club", "shift"]),
    shiftId: z.string().uuid().nullable().optional(),
    imagePath: z.string().nullable().optional(),
    pin: z.boolean().default(false),
  })
  .refine((v) => v.audience !== "shift" || !!v.shiftId, { path: ["shiftId"], message: "Elegí un turno" });

export async function createAnnouncement(input: z.input<typeof announcementSchema>): Promise<ActionResult> {
  const { club, userId } = await actionStaff();
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message, fieldErrors: zodFieldErrors(parsed.error.issues) };
  const v = parsed.data;
  if (v.imagePath && !v.imagePath.startsWith(`${club.id}/announcements/`)) return { ok: false, error: "Imagen inválida" };

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    club_id: club.id,
    author_id: userId,
    body: v.body,
    audience: v.audience,
    shift_id: v.audience === "shift" ? v.shiftId! : null,
    image_path: v.imagePath ?? null,
    pinned_at: v.pin ? new Date().toISOString() : null,
  });
  if (error) return { ok: false, error: errorMessage(error) };

  // El trigger ya encoló una notificación por destinatario; el push sale en segundo plano.
  after(dispatchPushInBackground);
  revalidatePath("/", "layout");
  return { ok: true, message: "Aviso publicado. Les llega una notificación." };
}

export async function togglePin(id: string, pinned: boolean): Promise<ActionResult> {
  const { club } = await actionStaff();
  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("club_id", club.id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  const { club } = await actionStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("announcements").select("image_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("announcements").delete().eq("id", id).eq("club_id", club.id);
  if (error) return { ok: false, error: errorMessage(error) };
  if (data?.image_path) await supabase.storage.from("club-files").remove([data.image_path]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Aviso eliminado." };
}

export async function toggleReaction(announcementId: string, emoji: string, on: boolean): Promise<ActionResult> {
  const { club, userId } = await actionClub();
  if (!REACTIONS.includes(emoji as (typeof REACTIONS)[number])) return { ok: false, error: "Reacción inválida" };
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("announcement_reactions").upsert({ club_id: club.id, announcement_id: announcementId, user_id: userId, emoji })
    : await supabase.from("announcement_reactions").delete().eq("announcement_id", announcementId).eq("user_id", userId).eq("emoji", emoji);
  if (error) return { ok: false, error: errorMessage(error) };
  return { ok: true };
}

/** Marca como vistos los avisos mostrados y limpia el contador de no leídos. */
export async function markAnnouncementsSeen(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { club, userId, isStaff } = await actionClub();
  const supabase = await createClient();
  // "Visto por N" cuenta corredores, no al staff.
  if (!isStaff)
    await supabase
    .from("announcement_views")
    .upsert(
      ids.map((id) => ({ club_id: club.id, announcement_id: id, user_id: userId })),
      { onConflict: "announcement_id,user_id", ignoreDuplicates: true },
    );
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("club_id", club.id)
    .eq("user_id", userId)
    .eq("kind", "announcement")
    .is("read_at", null);
}
