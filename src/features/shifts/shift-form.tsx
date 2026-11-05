"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { DAY_LABELS, DAY_NAMES } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";
import { archiveShift, saveShift, type ShiftInput } from "./actions";

type Person = { id: string; name: string; shiftName?: string | null };

export function ShiftForm({ initial, coaches, runners }: { initial?: ShiftInput; coaches: Person[]; runners: Person[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [name, setName] = useState(initial?.name ?? "");
  const [days, setDays] = useState<number[]>(initial?.days ?? [1, 3, 5]);
  const [startsAt, setStartsAt] = useState(initial?.startsAt?.slice(0, 5) ?? "19:00");
  const [endsAt, setEndsAt] = useState(initial?.endsAt?.slice(0, 5) ?? "20:30");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [coachUserId, setCoach] = useState<string | null>(initial?.coachUserId ?? coaches[0]?.id ?? null);
  const [runnerIds, setRunnerIds] = useState<string[]>(initial?.runnerIds ?? []);

  function submit() {
    setErrors({});
    start(async () => {
      const res = await saveShift({ id: initial?.id, name, days, startsAt, endsAt, location, coachUserId, runnerIds });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(res.message);
      router.push("/turnos");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <Field label="Nombre" htmlFor="name" error={errors.name}>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mañana, Noche, Principiantes…" maxLength={40} />
      </Field>

      <Field label="Días" error={errors.days}>
        <div className="flex gap-1.5" role="group" aria-label="Días del turno">
          {DAY_LABELS.map((d, i) => {
            const n = i + 1;
            const on = days.includes(n);
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                aria-label={DAY_NAMES[i]}
                onClick={() => setDays((ds) => (on ? ds.filter((x) => x !== n) : [...ds, n]))}
                className={cn("grid h-11 flex-1 place-items-center rounded-xl font-mono text-sm font-semibold transition", on ? "bg-accent text-accent-fg" : "bg-surface text-muted")}
              >
                {d}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Empieza" htmlFor="starts" error={errors.startsAt}>
          <Input id="starts" type="time" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Termina" htmlFor="ends" error={errors.endsAt}>
          <Input id="ends" type="time" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="font-mono" />
        </Field>
      </div>

      <Field label="Lugar" htmlFor="location">
        <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Parque Tres de Febrero, Planetario" maxLength={120} />
      </Field>

      <Field label="Coach a cargo" htmlFor="coach">
        <Select id="coach" value={coachUserId ?? ""} onChange={(e) => setCoach(e.target.value || null)}>
          <option value="">Sin asignar</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={`Corredores · ${runnerIds.length}`}>
        <div className="max-h-80 space-y-1 overflow-y-auto rounded-2xl border border-border p-2">
          {runners.length === 0 && <p className="p-2 text-sm text-subtle">Todavía no hay corredores en el club.</p>}
          {runners.map((r) => (
            <label key={r.id} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
              <input
                type="checkbox"
                className="size-5 accent-[var(--accent)]"
                checked={runnerIds.includes(r.id)}
                onChange={(e) => setRunnerIds((ids) => (e.target.checked ? [...ids, r.id] : ids.filter((x) => x !== r.id)))}
              />
              <span className="flex-1">{r.name}</span>
              {r.shiftName && !runnerIds.includes(r.id) && <span className="font-mono text-xs text-subtle">{r.shiftName}</span>}
            </label>
          ))}
        </div>
      </Field>

      <Button block size="lg" loading={pending} onClick={submit}>
        Guardar turno
      </Button>
      {initial?.id && (
        <Button
          block
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (!confirm("¿Archivar este turno? Los corredores quedan sin turno.")) return;
            start(async () => {
              const res = await archiveShift(initial.id!);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              router.push("/turnos");
            });
          }}
        >
          <Archive /> Archivar turno
        </Button>
      )}
    </div>
  );
}
