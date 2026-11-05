import Link from "next/link";
import { Clock, MapPin, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { formatDays } from "@/lib/domain/dates";
import { requireStaff } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Turnos" };

export default async function ShiftsPage({ params }: PageProps<"/c/[club]/turnos">) {
  const { club: slug } = await params;
  const { club } = await requireStaff(slug, "/turnos");
  const supabase = await createClient();
  const [{ data: shifts }, { data: members }] = await Promise.all([
    supabase.from("shifts").select("*, coach:memberships!shifts_club_id_coach_user_id_fkey(profiles(full_name))").eq("club_id", club.id).is("archived_at", null).order("starts_at"),
    supabase.from("memberships").select("shift_id").eq("club_id", club.id).eq("status", "active").eq("role", "runner"),
  ]);
  const count = (id: string) => (members ?? []).filter((m) => m.shift_id === id).length;
  const unassigned = (members ?? []).filter((m) => !m.shift_id).length;

  return (
    <div>
      <PageHeader
        title="Turnos"
        back="/ajustes"
        action={
          <Button asChild size="sm">
            <Link href="/turnos/nuevo">
              <Plus /> Nuevo
            </Link>
          </Button>
        }
      />
      {!shifts || shifts.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Sin turnos"
          description="Armá grupos por horario para segmentar planes y avisos."
          action={
            <Button asChild>
              <Link href="/turnos/nuevo">Crear turno</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {shifts.map((s) => (
            <Link key={s.id} href={`/turnos/${s.id}`} className="block">
              <Card className="hover:bg-surface-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-2xl font-bold uppercase leading-none">{s.name}</p>
                  <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 font-mono text-xs text-accent-text">
                    <Users className="size-3.5" aria-hidden /> {count(s.id)}
                  </span>
                </div>
                <p className="mt-2 font-mono text-xs text-muted">
                  {formatDays(s.days)} · {s.starts_at.slice(0, 5)}–{s.ends_at.slice(0, 5)}
                </p>
                {s.location && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                    <MapPin className="size-3.5" aria-hidden /> {s.location}
                  </p>
                )}
                {s.coach?.profiles?.full_name && <p className="mt-1 text-sm text-subtle">Coach: {s.coach.profiles.full_name}</p>}
              </Card>
            </Link>
          ))}
          {unassigned > 0 && <p className="pt-2 text-center text-sm text-subtle">{unassigned} corredores sin turno</p>}
        </div>
      )}
    </div>
  );
}
