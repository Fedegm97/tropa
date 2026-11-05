import Link from "next/link";
import { ChevronLeft, ChevronRight, Library, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { SessionCard } from "@/features/training/session-view";
import { DuplicateWeekButton } from "@/features/training/staff-actions";
import type { SessionType } from "@/features/training/blocks";
import { DAY_NAMES, addDays, mondayOf, shortDate, todayIn, weekDays } from "@/lib/domain/dates";
import { requireClub } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Plan" };

export default async function PlanWeekPage({ params, searchParams }: PageProps<"/c/[club]/plan">) {
  const [{ club: slug }, sp] = await Promise.all([params, searchParams]);
  const { club, isStaff, userId } = await requireClub(slug, "/plan");
  const today = todayIn(club.timezone);
  const ref = typeof sp.semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : today;
  const monday = mondayOf(ref);
  const days = weekDays(monday);

  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("id, date, title, type, blocks, published_at, audience, shifts(name)")
    .eq("club_id", club.id)
    .gte("date", monday)
    .lte("date", days[6]!)
    .order("date")
    .order("created_at");

  const ids = (sessions ?? []).map((s) => s.id);
  const { data: completions } = ids.length
    ? isStaff
      ? await supabase.from("session_completions").select("session_id, user_id").in("session_id", ids)
      : await supabase.from("session_completions").select("session_id, user_id").eq("user_id", userId).in("session_id", ids)
    : { data: [] as { session_id: string; user_id: string }[] };

  return (
    <div>
      <PageHeader
        title={isStaff ? "Planes" : "Tu plan"}
        action={
          isStaff ? (
            <Button asChild variant="ghost" size="icon" aria-label="Biblioteca de sesiones">
              <Link href="/plan/biblioteca">
                <Library />
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex items-center justify-between rounded-2xl bg-surface p-1">
        <Button asChild variant="ghost" size="icon" aria-label="Semana anterior">
          <Link href={`/plan?semana=${addDays(monday, -7)}`}>
            <ChevronLeft />
          </Link>
        </Button>
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-subtle">{monday === mondayOf(today) ? "Esta semana" : "Semana"}</p>
          <p className="font-display text-lg font-bold uppercase">
            {shortDate(monday)} – {shortDate(days[6]!)}
          </p>
        </div>
        <Button asChild variant="ghost" size="icon" aria-label="Semana siguiente">
          <Link href={`/plan?semana=${addDays(monday, 7)}`}>
            <ChevronRight />
          </Link>
        </Button>
      </div>

      {isStaff && (
        <div className="mb-4 flex gap-2">
          <Button asChild size="sm">
            <Link href={`/plan/nueva?fecha=${days.includes(today) ? today : monday}`}>
              <Plus /> Nueva sesión
            </Link>
          </Button>
          <DuplicateWeekButton date={monday} />
        </div>
      )}

      <div className="space-y-4">
        {days.map((day, i) => {
          const daySessions = (sessions ?? []).filter((s) => s.date === day);
          return (
            <section key={day} aria-labelledby={`d-${day}`}>
              <div className="mb-2 flex items-center justify-between">
                <h2 id={`d-${day}`} className={cn("font-mono text-xs uppercase tracking-widest", day === today ? "font-bold text-accent-text" : "text-subtle")}>
                  {DAY_NAMES[i]} {day.slice(8)}/{day.slice(5, 7)} {day === today && "· hoy"}
                </h2>
                {isStaff && (
                  <Link href={`/plan/nueva?fecha=${day}`} aria-label={`Agregar sesión el ${DAY_NAMES[i]}`} className="grid size-11 place-items-center rounded-full text-subtle hover:bg-surface-2">
                    <Plus className="size-4" />
                  </Link>
                )}
              </div>
              {daySessions.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/60 px-4 py-3 text-sm text-subtle">{isStaff ? "Sin sesiones" : "Libre"}</p>
              ) : (
                <div className="space-y-2">
                  {daySessions.map((s) => {
                    const count = (completions ?? []).filter((c) => c.session_id === s.id).length;
                    return (
                      <SessionCard
                        key={s.id}
                        session={{ ...s, type: s.type as SessionType }}
                        done={!isStaff && count > 0}
                        extra={
                          isStaff ? (
                            <p className="mt-0.5 font-mono text-xs text-subtle">
                              {s.audience === "club" ? "Todo el club" : s.audience === "shift" ? `Turno ${s.shifts?.name ?? ""}` : "Corredores puntuales"}
                              {s.published_at && <span className="text-accent-text"> · {count} completaron</span>}
                            </p>
                          ) : undefined
                        }
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
