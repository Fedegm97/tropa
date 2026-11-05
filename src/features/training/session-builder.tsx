"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ZONES, type Zone } from "@/lib/domain/pace";
import { BLOCK_LABELS, SESSION_TYPES, blockPace, blockSummary, type Amount, type Block, type SessionInput, type SessionType } from "./blocks";
import { saveSession } from "./actions";

type Option = { id: string; name: string };

export type BuilderInitial = Partial<Omit<SessionInput, "blocks">> & { blocks?: Block[] };

const PRESETS: { label: string; type: SessionType; title: string; blocks: Block[] }[] = [
  {
    label: "Rodaje 40'",
    type: "easy_run",
    title: "Rodaje suave",
    blocks: [{ kind: "continuous", amount: { unit: "s", value: 2400 }, target: { mode: "zone", value: "Z2" } }],
  },
  {
    label: "Pasadas 6×1000",
    type: "intervals",
    title: "Pasadas 6×1000",
    blocks: [
      { kind: "warmup", amount: { unit: "s", value: 900 }, target: { mode: "zone", value: "Z1" } },
      { kind: "intervals", reps: 6, work: { unit: "m", value: 1000 }, target: { mode: "pct", value: 103 }, recovery: { amount: { unit: "s", value: 90 }, type: "jog" } },
      { kind: "cooldown", amount: { unit: "s", value: 600 }, target: { mode: "zone", value: "Z1" } },
    ],
  },
  {
    label: "Fondo 14 km",
    type: "long_run",
    title: "Fondo largo",
    blocks: [{ kind: "continuous", amount: { unit: "m", value: 14000 }, target: { mode: "zone", value: "Z2" } }],
  },
];

const EXAMPLE_REF = { secPerKm: 300, kind: "threshold" as const };

function newBlock(kind: Block["kind"]): Block {
  switch (kind) {
    case "warmup":
      return { kind, amount: { unit: "s", value: 900 }, target: { mode: "zone", value: "Z1" } };
    case "cooldown":
      return { kind, amount: { unit: "s", value: 600 }, target: { mode: "zone", value: "Z1" } };
    case "continuous":
      return { kind, amount: { unit: "m", value: 5000 }, target: { mode: "zone", value: "Z2" } };
    case "intervals":
      return { kind, reps: 6, work: { unit: "m", value: 400 }, target: { mode: "pct", value: 105 }, recovery: { amount: { unit: "s", value: 60 }, type: "jog" } };
  }
}

function AmountInput({ value, onChange, label }: { value: Amount; onChange: (a: Amount) => void; label: string }) {
  const displayUnit = value.unit === "m" ? (value.value >= 1000 && value.value % 100 === 0 ? "km" : "m") : "min";
  const [unit, setUnit] = useState<"m" | "km" | "min" | "seg">(displayUnit);
  const shown = unit === "km" ? value.value / 1000 : unit === "min" ? value.value / 60 : value.value;
  function update(n: number, u = unit) {
    if (!Number.isFinite(n)) return;
    if (u === "km") onChange({ unit: "m", value: Math.round(n * 1000) });
    else if (u === "m") onChange({ unit: "m", value: Math.round(n) });
    else if (u === "min") onChange({ unit: "s", value: Math.round(n * 60) });
    else onChange({ unit: "s", value: Math.round(n) });
  }
  return (
    <div className="flex gap-2">
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        aria-label={label}
        value={Number.isInteger(shown) ? shown : +shown.toFixed(2)}
        onChange={(e) => update(parseFloat(e.target.value))}
        className="min-w-0 flex-1 font-mono"
      />
      <Select
        aria-label={`${label}: unidad`}
        value={unit}
        onChange={(e) => {
          const u = e.target.value as typeof unit;
          setUnit(u);
          update(shown, u);
        }}
        className="w-24"
      >
        <option value="km">km</option>
        <option value="m">m</option>
        <option value="min">min</option>
        <option value="seg">seg</option>
      </Select>
    </div>
  );
}

function TargetInput({ value, onChange }: { value: Block["target"]; onChange: (t: Block["target"]) => void }) {
  const mode = value.mode;
  return (
    <div className="flex gap-2">
      <Select
        aria-label="Ritmo objetivo"
        value={mode === "zone" ? value.value : mode}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "none") onChange({ mode: "none" });
          else if (v === "pct") onChange({ mode: "pct", value: 100 });
          else onChange({ mode: "zone", value: v as Zone });
        }}
        className="flex-1"
      >
        {(Object.keys(ZONES) as Zone[]).map((z) => (
          <option key={z} value={z}>
            {z} · {ZONES[z].label}
          </option>
        ))}
        <option value="pct">% del umbral</option>
        <option value="none">Libre (sin ritmo)</option>
      </Select>
      {mode === "pct" && (
        <div className="relative w-28">
          <Input
            type="number"
            inputMode="numeric"
            min={50}
            max={130}
            aria-label="Porcentaje del umbral"
            value={value.value}
            onChange={(e) => onChange({ mode: "pct", value: Math.max(50, Math.min(130, parseInt(e.target.value || "100", 10))) })}
            className="pr-8 font-mono"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle">%</span>
        </div>
      )}
    </div>
  );
}

function BlockEditor({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  const example = blockPace(block, EXAMPLE_REF);
  return (
    <div className="space-y-3">
      {block.kind === "intervals" ? (
        <>
          <div className="grid grid-cols-[90px_1fr] gap-2">
            <Field label="Reps">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                value={block.reps}
                onChange={(e) => onChange({ ...block, reps: Math.max(1, Math.min(50, parseInt(e.target.value || "1", 10))) })}
                className="font-mono"
              />
            </Field>
            <Field label="Cada una">
              <AmountInput label="Distancia o tiempo de cada repetición" value={block.work} onChange={(work) => onChange({ ...block, work })} />
            </Field>
          </div>
          <Field label="Ritmo">
            <TargetInput value={block.target} onChange={(target) => onChange({ ...block, target })} />
          </Field>
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <Field label="Pausa">
              <AmountInput
                label="Pausa"
                value={block.recovery.amount}
                onChange={(amount) => onChange({ ...block, recovery: { ...block.recovery, amount } })}
              />
            </Field>
            <Field label="Tipo">
              <Select
                value={block.recovery.type}
                onChange={(e) => onChange({ ...block, recovery: { ...block.recovery, type: e.target.value as "jog" | "walk" | "rest" } })}
              >
                <option value="jog">Trote</option>
                <option value="walk">Caminata</option>
                <option value="rest">Parado</option>
              </Select>
            </Field>
          </div>
        </>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Duración / distancia">
            <AmountInput label="Duración o distancia" value={block.amount} onChange={(amount) => onChange({ ...block, amount })} />
          </Field>
          <Field label="Ritmo">
            <TargetInput value={block.target} onChange={(target) => onChange({ ...block, target })} />
          </Field>
        </div>
      )}
      <Input placeholder="Nota (opcional)" value={block.note ?? ""} onChange={(e) => onChange({ ...block, note: e.target.value })} maxLength={200} />
      <p className="font-mono text-xs text-subtle">
        {blockSummary(block)} · {example.target}
        {example.pace && <span className="text-accent-text"> · ej. umbral 5:00 → {example.pace}</span>}
      </p>
    </div>
  );
}

export function SessionBuilder({
  initial,
  shifts,
  runners,
  showPresets = false,
  onDoneHref = "/plan",
}: {
  initial?: BuilderInitial;
  shifts: Option[];
  runners: Option[];
  showPresets?: boolean;
  onDoneHref?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<SessionType>(initial?.type ?? "easy_run");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [blocks, setBlocks] = useState<Block[]>(initial?.blocks ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [audience, setAudience] = useState<"club" | "shift" | "runners">(initial?.audience ?? "club");
  const [shiftId, setShiftId] = useState<string | null>(initial?.shiftId ?? shifts[0]?.id ?? null);
  const [runnerIds, setRunnerIds] = useState<string[]>(initial?.runnerIds ?? []);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  const update = (i: number, b: Block) => setBlocks((bs) => bs.map((x, j) => (j === i ? b : x)));
  const move = (i: number, d: -1 | 1) =>
    setBlocks((bs) => {
      const next = [...bs];
      const [x] = next.splice(i, 1);
      next.splice(i + d, 0, x!);
      return next;
    });

  function submit(publish: boolean) {
    setErrors({});
    start(async () => {
      const res = await saveSession({
        id: initial?.id,
        date,
        title: title || SESSION_TYPES[type].label,
        type,
        blocks,
        notes,
        audience,
        shiftId: audience === "shift" ? shiftId : null,
        runnerIds: audience === "runners" ? runnerIds : [],
        publish,
        saveAsTemplate,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.fieldErrors ? Object.values(res.fieldErrors)[0] : res.error);
      }
      toast.success(res.message);
      router.push(onDoneHref === "/plan" ? `/plan?semana=${date}` : onDoneHref);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {showPresets && (
        <div>
          <p className="mb-2 text-sm text-muted">Arrancá con un modelo y ajustalo:</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setType(p.type);
                  setTitle(p.title);
                  setBlocks(p.blocks);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha" htmlFor="date" error={errors.date}>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Título" htmlFor="title" error={errors.title}>
          <Input id="title" value={title} placeholder={SESSION_TYPES[type].label} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </Field>
      </div>

      <Field label="Tipo de sesión">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de sesión">
          {(Object.keys(SESSION_TYPES) as SessionType[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium transition",
                type === t ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-muted hover:text-fg",
              )}
            >
              {SESSION_TYPES[t].emoji} {SESSION_TYPES[t].label}
            </button>
          ))}
        </div>
      </Field>

      {type !== "rest" && (
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Bloques</p>
          {errors.blocks && <p className="mb-2 text-sm text-danger">{errors.blocks}</p>}
          <div className="space-y-3">
            {blocks.map((b, i) => (
              <Card key={i} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-lg font-bold uppercase">{BLOCK_LABELS[b.kind]}</p>
                  <div className="flex">
                    <Button type="button" variant="ghost" size="icon" aria-label="Subir bloque" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Bajar bloque" disabled={i === blocks.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Quitar bloque" onClick={() => setBlocks((bs) => bs.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <BlockEditor block={b} onChange={(nb) => update(i, nb)} />
              </Card>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(Object.keys(BLOCK_LABELS) as Block["kind"][]).map((k) => (
              <Button key={k} type="button" variant="outline" size="sm" onClick={() => setBlocks((bs) => [...bs, newBlock(k)])}>
                <Plus /> {BLOCK_LABELS[k]}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Field label="Notas" htmlFor="notes">
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Ej.: terreno, hidratación, a qué prestar atención" />
      </Field>

      <Field label="¿Para quién?" error={errors.shiftId ?? errors.runnerIds}>
        <div className="mb-3 grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1" role="radiogroup">
          {(
            [
              ["club", "Todo el club"],
              ["shift", "Un turno"],
              ["runners", "Corredores"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={audience === v}
              disabled={v === "shift" && shifts.length === 0}
              onClick={() => setAudience(v)}
              className={cn("min-h-11 rounded-xl text-sm font-medium disabled:opacity-40", audience === v ? "bg-surface-2 text-fg" : "text-muted")}
            >
              {label}
            </button>
          ))}
        </div>
        {audience === "shift" && (
          <Select value={shiftId ?? ""} onChange={(e) => setShiftId(e.target.value)} aria-label="Turno">
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        {audience === "runners" && (
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-border p-2">
            {runners.length === 0 && <p className="p-2 text-sm text-subtle">Todavía no hay corredores en el club.</p>}
            {runners.map((r) => (
              <label key={r.id} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--accent)]"
                  checked={runnerIds.includes(r.id)}
                  onChange={(e) => setRunnerIds((ids) => (e.target.checked ? [...ids, r.id] : ids.filter((x) => x !== r.id)))}
                />
                {r.name}
              </label>
            ))}
          </div>
        )}
      </Field>

      <label className="flex min-h-11 items-center gap-3 text-sm text-muted">
        <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
        Guardar también en la biblioteca
      </label>

      <div className="sticky bottom-20 z-10 grid grid-cols-[1fr_2fr] gap-2 rounded-2xl bg-bg/90 py-2 backdrop-blur">
        <Button type="button" variant="secondary" loading={pending} onClick={() => submit(false)}>
          Borrador
        </Button>
        <Button type="button" loading={pending} onClick={() => submit(true)}>
          {initial?.id ? "Guardar y publicar" : "Publicar y avisar"}
        </Button>
      </div>
    </div>
  );
}
