import { z } from "zod";
import { describeTarget, formatPaceRange, targetPaceRange, type PaceTarget, type ReferencePace } from "@/lib/domain/pace";

export const SESSION_TYPES = {
  easy_run: { label: "Rodaje", emoji: "🏃" },
  intervals: { label: "Pasadas", emoji: "⚡" },
  long_run: { label: "Fondo", emoji: "🛣️" },
  fartlek: { label: "Fartlek", emoji: "🌀" },
  hills: { label: "Cuestas", emoji: "⛰️" },
  strength: { label: "Fuerza", emoji: "💪" },
  rest: { label: "Descanso", emoji: "😴" },
} as const;
export type SessionType = keyof typeof SESSION_TYPES;
export const sessionTypeSchema = z.enum(Object.keys(SESSION_TYPES) as [SessionType, ...SessionType[]]);

export const targetSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("pct"), value: z.number().int().min(50).max(130) }),
  z.object({ mode: z.literal("zone"), value: z.enum(["Z1", "Z2", "Z3", "Z4", "Z5"]) }),
  z.object({ mode: z.literal("none") }),
]);

export const amountSchema = z.discriminatedUnion("unit", [
  z.object({ unit: z.literal("m"), value: z.number().int().min(50).max(100_000) }),
  z.object({ unit: z.literal("s"), value: z.number().int().min(10).max(36_000) }),
]);
export type Amount = z.infer<typeof amountSchema>;

const note = z.string().trim().max(200).optional();

export const blockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("warmup"), amount: amountSchema, target: targetSchema, note }),
  z.object({ kind: z.literal("continuous"), amount: amountSchema, target: targetSchema, note }),
  z.object({
    kind: z.literal("intervals"),
    reps: z.number().int().min(1).max(50),
    work: amountSchema,
    target: targetSchema,
    recovery: z.object({ amount: amountSchema, type: z.enum(["jog", "walk", "rest"]) }),
    note,
  }),
  z.object({ kind: z.literal("cooldown"), amount: amountSchema, target: targetSchema, note }),
]);
export type Block = z.infer<typeof blockSchema>;
export const blocksSchema = z.array(blockSchema).max(20);

export const BLOCK_LABELS: Record<Block["kind"], string> = {
  warmup: "Entrada en calor",
  intervals: "Series",
  continuous: "Bloque continuo",
  cooldown: "Vuelta a la calma",
};

const RECOVERY_LABEL = { jog: "trote", walk: "caminata", rest: "pausa" } as const;

export function formatAmount(a: Amount): string {
  if (a.unit === "m") return a.value >= 1000 ? `${+(a.value / 1000).toFixed(2)} km` : `${a.value} m`;
  const min = Math.floor(a.value / 60);
  const sec = a.value % 60;
  if (min === 0) return `${sec}"`;
  return sec ? `${min}'${sec.toString().padStart(2, "0")}"` : `${min}'`;
}

/** "6 × 1 km · pausa 1'30" trote" */
export function blockSummary(b: Block): string {
  if (b.kind === "intervals") {
    return `${b.reps} × ${formatAmount(b.work)} · pausa ${formatAmount(b.recovery.amount)} ${RECOVERY_LABEL[b.recovery.type]}`;
  }
  return formatAmount(b.amount);
}

/** Ritmo del bloque para un corredor concreto (o la descripción si no hay ritmo cargado). */
export function blockPace(b: Block, ref: ReferencePace | null): { pace: string | null; target: string } {
  const target = b.target as PaceTarget;
  const range = targetPaceRange(target, ref);
  return { pace: range ? formatPaceRange(range) : null, target: describeTarget(target) };
}

/** Distancia/tiempo total aproximados para mostrar en la tarjeta. */
export function sessionTotals(blocks: Block[]): { meters: number; seconds: number } {
  let meters = 0;
  let seconds = 0;
  const add = (a: Amount, times = 1) => (a.unit === "m" ? (meters += a.value * times) : (seconds += a.value * times));
  for (const b of blocks) {
    if (b.kind === "intervals") {
      add(b.work, b.reps);
      add(b.recovery.amount, Math.max(0, b.reps - 1));
    } else add(b.amount);
  }
  return { meters, seconds };
}

export function parseBlocks(raw: unknown): Block[] {
  const parsed = blocksSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export const sessionInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha"),
    title: z.string().trim().min(1, "Poné un título").max(80),
    type: sessionTypeSchema,
    blocks: blocksSchema,
    notes: z.string().trim().max(2000).optional().default(""),
    audience: z.enum(["club", "shift", "runners"]),
    shiftId: z.string().uuid().nullable().optional(),
    runnerIds: z.array(z.string().uuid()).optional().default([]),
    publish: z.boolean().default(true),
    saveAsTemplate: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.audience === "shift" && !v.shiftId) ctx.addIssue({ code: "custom", path: ["shiftId"], message: "Elegí un turno" });
    if (v.audience === "runners" && v.runnerIds.length === 0)
      ctx.addIssue({ code: "custom", path: ["runnerIds"], message: "Elegí al menos un corredor" });
    if (v.type !== "rest" && v.type !== "strength" && v.blocks.length === 0 && !v.notes)
      ctx.addIssue({ code: "custom", path: ["blocks"], message: "Agregá al menos un bloque o una nota" });
  });
export type SessionInput = z.input<typeof sessionInputSchema>;
