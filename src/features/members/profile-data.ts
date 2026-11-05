import "server-only";
import { createClient } from "@/lib/supabase/server";
import { formatPace } from "@/lib/domain/pace";
import type { ClubContext } from "@/lib/club";
import type { ProfileInput } from "./schemas";

export async function loadProfileForm(ctx: ClubContext) {
  const supabase = await createClient();
  const [{ data: profile }, { data: priv }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", ctx.userId).single(),
    supabase.from("profile_private").select("*").eq("user_id", ctx.userId).maybeSingle(),
  ]);
  const initial: ProfileInput = {
    fullName: profile?.full_name ?? "",
    birthDate: priv?.birth_date ?? "",
    phone: priv?.phone ?? "",
    emergencyName: priv?.emergency_name ?? "",
    emergencyPhone: priv?.emergency_phone ?? "",
    pace: ctx.membership.ref_pace_s_per_km ? formatPace(ctx.membership.ref_pace_s_per_km) : "",
    paceKind: ctx.membership.ref_pace_kind,
  };
  return { initial, avatarPath: profile?.avatar_path ?? null, profile };
}
