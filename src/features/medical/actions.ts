"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionClub, clubHas } from "@/lib/club";
import { errorMessage, type ActionResult } from "@/lib/actions";

const schema = z.object({
  filePath: z.string().min(1),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí la fecha de vencimiento"),
});

export async function saveCertificate(input: z.input<typeof schema>): Promise<ActionResult> {
  const { club, userId } = await actionClub();
  if (!clubHas(club, "medical")) return { ok: false, error: "Tu club no tiene activado el apto médico." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  if (!parsed.data.filePath.startsWith(`${club.id}/medical/${userId}/`)) return { ok: false, error: "Archivo inválido" };
  const supabase = await createClient();
  const { error } = await supabase.from("medical_certificates").insert({
    club_id: club.id,
    user_id: userId,
    file_path: parsed.data.filePath,
    expires_on: parsed.data.expiresOn,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Apto cargado. ¡Gracias!" };
}
