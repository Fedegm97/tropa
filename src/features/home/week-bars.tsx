import { DAY_LABELS } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

/** Barras L–D: completado vs. planificado. */
export function WeekBars({ days, today }: { days: { day: string; planned: number; completed: number }[]; today: string }) {
  const totalPlanned = days.reduce((s, d) => s + d.planned, 0);
  const totalDone = days.reduce((s, d) => s + Math.min(d.completed, d.planned), 0);
  return (
    <div>
      <div className="flex h-24 items-end justify-between gap-1.5">
        {days.map((d, i) => {
          const pct = d.planned ? Math.min(1, d.completed / d.planned) : 0;
          return (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
              <div className={cn("relative w-full flex-1 overflow-hidden rounded-lg", d.planned ? "bg-surface-2" : "bg-surface-2/40")}>
                <div className="absolute inset-x-0 bottom-0 rounded-lg bg-accent transition-[height]" style={{ height: `${pct * 100}%` }} />
              </div>
              <span className={cn("font-mono text-[11px]", d.day === today ? "font-bold text-accent-text" : "text-subtle")}>{DAY_LABELS[i]}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-xs text-muted">
        {totalDone} de {totalPlanned} sesiones completadas
      </p>
    </div>
  );
}
