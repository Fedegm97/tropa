"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { actionClub } from "@/lib/club";
import { errorMessage, type ActionResult } from "@/lib/actions";
import { dispatchWatchInBackground } from "@/lib/watch/dispatch";

export async function requestWatchSync(sessionId: string, provider: string): Promise<ActionResult> {
  await actionClub();
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_watch_sync", { p_session: sessionId, p_provider: provider });
  if (error) {
    if (error.message.includes("watch_not_connected")) return { ok: false, error: "Primero conectá tu reloj desde tu perfil." };
    if (error.message.includes("feature_not_in_plan")) return { ok: false, error: "Tu club no tiene activado el envío al reloj." };
    return { ok: false, error: errorMessage(error) };
  }
  after(dispatchWatchInBackground);
  return { ok: true };
}

export async function disconnectWatch(provider: string): Promise<ActionResult> {
  const { userId } = await actionClub();
  const supabase = await createClient();
  const { error } = await supabase.from("watch_connections").delete().eq("user_id", userId).eq("provider", provider);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/perfil");
  return { ok: true, message: "Reloj desconectado." };
}
