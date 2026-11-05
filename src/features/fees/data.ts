import "server-only";
import { createClient } from "@/lib/supabase/server";

export type FeeRow = {
  user_id: string;
  full_name: string;
  avatar_path: string | null;
  shift_id: string | null;
  amount_due: number | null;
  confirmed_cents: number;
  pending_count: number;
  status: "paid" | "pending" | "owed";
};

export async function feeStatuses(clubId: string, period: string): Promise<FeeRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("club_fee_statuses", { p_club: clubId, p_period: period });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    amount_due: r.amount_due === null ? null : Number(r.amount_due),
    confirmed_cents: Number(r.confirmed_cents),
    status: r.status as FeeRow["status"],
  }));
}

export async function signedUrls(paths: (string | null)[], seconds = 3600): Promise<Map<string, string>> {
  const clean = paths.filter((p): p is string => !!p);
  if (clean.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("club-files").createSignedUrls(clean, seconds);
  return new Map((data ?? []).filter((d) => d.signedUrl && !d.error).map((d) => [d.path!, d.signedUrl as string]));
}

export function parsePeriod(input: unknown, fallback: string): string {
  return typeof input === "string" && /^\d{4}-\d{2}-01$/.test(input) ? input : fallback;
}
