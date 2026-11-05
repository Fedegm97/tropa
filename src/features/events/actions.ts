"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionClub, actionStaff } from "@/lib/club";
import { errorMessage, zodFieldErrors, type ActionResult } from "@/lib/actions";
import { dispatchPushInBackground } from "@/lib/push/dispatch";
import { zonedToUtc } from "@/lib/domain/dates";
import { parseDistances } from "@/lib/domain/events";
import { parseMoney } from "@/lib/domain/money";

const eventSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Poné un nombre").max(100),
  kind: z.enum(["road", "trail", "track", "social", "trip"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí la fecha"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Elegí la hora"),
  location: z.string().trim().max(160).optional(),
  distances: z.string().optional(),
  registrationUrl: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^https?:\/\/\S+$/.test(v), "Tiene que empezar con https://"),
  price: z
    .string()
    .optional()
    .refine((v) => !v || parseMoney(v) !== null, "Monto inválido"),
  notes: z.string().trim().max(2000).optional(),
});
export type EventInput = z.input<typeof eventSchema>;

export async function saveEvent(input: EventInput): Promise<ActionResult<{ id: string }>> {
  const { club, userId } = await actionStaff();
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message, fieldErrors: zodFieldErrors(parsed.error.issues) };
  const v = parsed.data;
  const row = {
    name: v.name,
    kind: v.kind,
    starts_at: zonedToUtc(v.date, v.time, club.timezone),
    location: v.location || null,
    distances: parseDistances(v.distances ?? ""),
    registration_url: v.registrationUrl || null,
    price_cents: v.price ? parseMoney(v.price) : null,
    notes: v.notes || null,
  };
  const supabase = await createClient();
  if (v.id) {
    const { error } = await supabase.from("events").update(row).eq("id", v.id).eq("club_id", club.id);
    if (error) return { ok: false, error: errorMessage(error) };
    revalidatePath("/eventos", "layout");
    return { ok: true, data: { id: v.id }, message: "Evento actualizado." };
  }
  const { data, error } = await supabase.from("events").insert({ ...row, club_id: club.id, created_by: userId }).select("id").single();
  if (error) return { ok: false, error: errorMessage(error) };
  after(dispatchPushInBackground);
  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id }, message: "Evento publicado. Le avisamos al club." };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const { club } = await actionStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id).eq("club_id", club.id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Evento eliminado." };
}

export async function setRegistration(eventId: string, going: boolean, distance: string | null): Promise<ActionResult> {
  const { club, userId } = await actionClub();
  const supabase = await createClient();
  const { error } = going
    ? await supabase.from("event_registrations").upsert({ club_id: club.id, event_id: eventId, user_id: userId, distance })
    : await supabase.from("event_registrations").delete().eq("event_id", eventId).eq("user_id", userId);
  if (error) {
    if (error.message.includes("invalid_distance")) return { ok: false, error: "Elegí una de las distancias del evento." };
    return { ok: false, error: errorMessage(error) };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: going ? "¡Te anotaste! Te recordamos el día anterior." : "Te bajaste del evento." };
}
