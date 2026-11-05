"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { currentOrigin } from "@/lib/club";
import { safeNext } from "@/lib/hosts";
import type { ActionResult } from "@/lib/actions";

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Revisá el email"),
  next: z.string().optional(),
});

export async function sendMagicLink(input: z.input<typeof emailSchema>): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const origin = await currentOrigin();
  const next = safeNext(parsed.data.next);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: true },
  });
  if (error) {
    console.error("[magic link]", error);
    return { ok: false, error: error.status === 429 ? "Pediste muchos links. Esperá un minuto." : "No pudimos enviar el link." };
  }
  return { ok: true };
}

const passwordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Revisá el email"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export async function signInWithPassword(input: z.input<typeof passwordSchema>): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: "Email o contraseña incorrectos." };
  return { ok: true };
}
