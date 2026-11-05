import Link from "next/link";
import { UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { RunnerList, type RunnerRow } from "@/features/members/runner-list";
import { requireStaff } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Corredores" };

export default async function RunnersPage({ params }: PageProps<"/c/[club]/corredores">) {
  const { club: slug } = await params;
  const { club } = await requireStaff(slug, "/corredores");
  const supabase = await createClient();
  const [{ data: members }, { data: shifts }] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, role, shift_id, level, ref_pace_s_per_km, ref_pace_kind, profiles(full_name, avatar_path)")
      .eq("club_id", club.id)
      .eq("status", "active"),
    supabase.from("shifts").select("id, name").eq("club_id", club.id).is("archived_at", null).order("starts_at"),
  ]);

  const rows: RunnerRow[] = (members ?? [])
    .map((m) => ({
      userId: m.user_id,
      name: m.profiles?.full_name || "Sin nombre",
      avatar: m.profiles?.avatar_path ?? null,
      role: m.role,
      shiftId: m.shift_id,
      shiftName: shifts?.find((s) => s.id === m.shift_id)?.name ?? null,
      level: m.level,
      pace: m.ref_pace_s_per_km,
      paceKind: m.ref_pace_kind,
    }))
    .sort((a, b) => (a.role === "runner" ? 1 : 0) - (b.role === "runner" ? 1 : 0) || a.name.localeCompare(b.name, "es"));
  const runnerCount = rows.filter((r) => r.role === "runner").length;

  return (
    <div>
      <PageHeader
        title="Corredores"
        subtitle={`${runnerCount} activos`}
        action={
          <Button asChild size="sm">
            <Link href="/ajustes#invitar">
              <UserPlus /> Invitar
            </Link>
          </Button>
        }
      />
      {runnerCount === 0 ? (
        <EmptyState
          icon={Users}
          title="Todavía no hay corredores"
          description="Compartí el link de invitación por WhatsApp y se suman en un minuto."
          action={
            <Button asChild>
              <Link href="/ajustes#invitar">Invitar corredores</Link>
            </Button>
          }
        />
      ) : (
        <RunnerList rows={rows} shifts={shifts ?? []} />
      )}
    </div>
  );
}
