"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionStaff } from "@/lib/club";
import { errorMessage, zodFieldErrors, type ActionResult } from "@/lib/actions";

const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora inválida");

const shiftSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, "Poné un nombre").max(40),
    days: z.array(z.number().int().min(1).max(7)).min(1, "Elegí al menos un día"),
    startsAt: time,
    endsAt: time,
    location: z.string().trim().max(120).optional(),
    coachUserId: z.string().uuid().nullable().optional(),
    runnerIds: z.array(z.string().uuid()).default([]),
  })
  .refine((v) => v.endsAt > v.startsAt, { path: ["endsAt"], message: "Tiene que terminar después de empezar" });
export type ShiftInput = z.input<typeof shiftSchema>;

export async function saveShift(input: ShiftInput): Promise<ActionResult<{ id: string }>> {
  const { club } = await actionStaff();
  const parsed = shiftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message, fieldErrors: zodFieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const supabase = await createClient();
  const row = {
    club_id: club.id,
    name: v.name,
    days: [...new Set(v.days)].sort(),
    starts_at: v.startsAt,
    ends_at: v.endsAt,
    location: v.location || null,
    coach_user_id: v.coachUserId ?? null,
  };

  let id = v.id;
  if (id) {
    const { error } = await supabase.from("shifts").update(row).eq("id", id).eq("club_id", club.id);
    if (error) return { ok: false, error: errorMessage(error) };
  } else {
    const { data, error } = await supabase.from("shifts").insert(row).select("id").single();
    if (error) return { ok: false, error: errorMessage(error) };
    id = data.id;
  }

  // Asignación de corredores: los tildados quedan en este turno; los destildados quedan sin turno.
  const { error: e1 } = await supabase
    .from("memberships")
    .update({ shift_id: null })
    .eq("club_id", club.id)
    .eq("shift_id", id)
    .not("user_id", "in", `(${v.runnerIds.length ? v.runnerIds.join(",") : "00000000-0000-0000-0000-000000000000"})`);
  if (e1) return { ok: false, error: errorMessage(e1) };
  if (v.runnerIds.length) {
    const { error: e2 } = await supabase.from("memberships").update({ shift_id: id }).eq("club_id", club.id).in("user_id", v.runnerIds);
    if (e2) return { ok: false, error: errorMessage(e2) };
  }

  revalidatePath("/turnos");
  return { ok: true, data: { id }, message: "Turno guardado." };
}

export async function archiveShift(id: string): Promise<ActionResult> {
  const { club } = await actionStaff();
  const supabase = await createClient();
  await supabase.from("memberships").update({ shift_id: null }).eq("club_id", club.id).eq("shift_id", id);
  const { error } = await supabase.from("shifts").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("club_id", club.id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/turnos");
  return { ok: true, message: "Turno archivado." };
}
