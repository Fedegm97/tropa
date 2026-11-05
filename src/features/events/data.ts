import "server-only";
import { createClient } from "@/lib/supabase/server";

export type EventWithPeople = Awaited<ReturnType<typeof loadEvents>>[number];

export async function loadEvents(clubId: string, opts: { upcoming?: boolean; id?: string; limit?: number } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("events")
    .select("*, event_registrations(user_id, distance, profiles(full_name, avatar_path))")
    .eq("club_id", clubId);
  if (opts.id) q = q.eq("id", opts.id);
  if (opts.upcoming !== undefined) q = opts.upcoming ? q.gte("starts_at", new Date(Date.now() - 6 * 3600_000).toISOString()) : q.lt("starts_at", new Date().toISOString());
  q = q.order("starts_at", { ascending: opts.upcoming !== false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
