import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function shiftFormOptions(clubId: string) {
  const supabase = await createClient();
  const [{ data: members }, { data: shifts }] = await Promise.all([
    supabase.from("memberships").select("user_id, role, shift_id, profiles(full_name)").eq("club_id", clubId).eq("status", "active"),
    supabase.from("shifts").select("id, name").eq("club_id", clubId),
  ]);
  const shiftName = (id: string | null) => shifts?.find((s) => s.id === id)?.name ?? null;
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "es");
  return {
    coaches: (members ?? []).filter((m) => m.role !== "runner").map((m) => ({ id: m.user_id, name: m.profiles?.full_name || "Coach" })).sort(byName),
    runners: (members ?? [])
      .filter((m) => m.role === "runner")
      .map((m) => ({ id: m.user_id, name: m.profiles?.full_name || "Sin nombre", shiftName: shiftName(m.shift_id), shiftId: m.shift_id }))
      .sort(byName),
  };
}
