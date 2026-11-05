import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Turnos y corredores para el selector de audiencia del constructor. */
export async function builderOptions(clubId: string) {
  const supabase = await createClient();
  const [{ data: shifts }, { data: runners }] = await Promise.all([
    supabase.from("shifts").select("id, name").eq("club_id", clubId).is("archived_at", null).order("starts_at"),
    supabase.from("memberships").select("user_id, profiles(full_name)").eq("club_id", clubId).eq("status", "active").eq("role", "runner"),
  ]);
  return {
    shifts: (shifts ?? []).map((s) => ({ id: s.id, name: s.name })),
    runners: (runners ?? [])
      .map((r) => ({ id: r.user_id, name: r.profiles?.full_name || "Sin nombre" }))
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
  };
}
