/**
 * Bloques de una sesión → workout de Garmin Connect (Training API, formato "workout" v1).
 * Los ritmos se personalizan con la referencia del corredor y se envían como rangos de
 * velocidad en m/s (Garmin usa velocidad, no ritmo). Un % único se envía con ±3 % de margen
 * para que el reloj no alerte por cualquier variación.
 */
import { targetPaceRange, type ReferencePace } from "@/lib/domain/pace";
import type { Amount, Block } from "@/features/training/blocks";

export type GarminTarget =
  | { targetType: "PACE"; targetValueLow: number; targetValueHigh: number }
  | { targetType: "OPEN"; targetValueLow: null; targetValueHigh: null };

export type GarminStep = {
  type: "WorkoutStep";
  stepOrder: number;
  intensity: "WARMUP" | "COOLDOWN" | "INTERVAL" | "RECOVERY" | "ACTIVE" | "REST";
  description: string | null;
  durationType: "TIME" | "DISTANCE";
  durationValue: number;
} & GarminTarget;

export type GarminRepeat = {
  type: "WorkoutRepeatStep";
  stepOrder: number;
  repeatType: "REPEAT_UNTIL_STEPS_CMPLT";
  repeatValue: number;
  steps: GarminStep[];
};

export type GarminWorkout = {
  workoutName: string;
  description: string | null;
  sport: "RUNNING";
  steps: (GarminStep | GarminRepeat)[];
};

const SINGLE_PACE_MARGIN = 0.03;

/** s/km → m/s, redondeado a 3 decimales */
export function paceToSpeed(secPerKm: number): number {
  return Math.round((1000 / secPerKm) * 1000) / 1000;
}

function duration(a: Amount) {
  return a.unit === "m" ? { durationType: "DISTANCE" as const, durationValue: a.value } : { durationType: "TIME" as const, durationValue: a.value };
}

export function garminTarget(target: Block["target"], ref: ReferencePace | null): GarminTarget {
  const range = targetPaceRange(target, ref);
  if (!range) return { targetType: "OPEN", targetValueLow: null, targetValueHigh: null };
  let low = paceToSpeed(range.slow); // más lento = menor velocidad
  let high = paceToSpeed(range.fast);
  if (range.fast === range.slow) {
    const v = paceToSpeed(range.fast);
    low = Math.round(v * (1 - SINGLE_PACE_MARGIN) * 1000) / 1000;
    high = Math.round(v * (1 + SINGLE_PACE_MARGIN) * 1000) / 1000;
  }
  return { targetType: "PACE", targetValueLow: low, targetValueHigh: high };
}

export function toGarminWorkout(session: { title: string; notes: string | null; blocks: Block[] }, ref: ReferencePace | null): GarminWorkout {
  let order = 0;
  const step = (intensity: GarminStep["intensity"], amount: Amount, target: Block["target"], description?: string | null): GarminStep => ({
    type: "WorkoutStep",
    stepOrder: ++order,
    intensity,
    description: description?.slice(0, 100) || null,
    ...duration(amount),
    ...garminTarget(target, ref),
  });

  const steps: (GarminStep | GarminRepeat)[] = session.blocks.map((b) => {
    switch (b.kind) {
      case "warmup":
        return step("WARMUP", b.amount, b.target, b.note);
      case "cooldown":
        return step("COOLDOWN", b.amount, b.target, b.note);
      case "continuous":
        return step("ACTIVE", b.amount, b.target, b.note);
      case "intervals": {
        const repeat: GarminRepeat = { type: "WorkoutRepeatStep", stepOrder: ++order, repeatType: "REPEAT_UNTIL_STEPS_CMPLT", repeatValue: b.reps, steps: [] };
        repeat.steps.push(step("INTERVAL", b.work, b.target, b.note));
        repeat.steps.push(
          step(b.recovery.type === "rest" ? "REST" : "RECOVERY", b.recovery.amount, { mode: "none" }, b.recovery.type === "walk" ? "Caminata" : null),
        );
        return repeat;
      }
    }
  });

  return {
    workoutName: session.title.slice(0, 80),
    description: session.notes?.slice(0, 500) || null,
    sport: "RUNNING",
    steps,
  };
}
