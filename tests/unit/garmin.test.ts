import { describe, expect, it } from "vitest";
import { garminTarget, paceToSpeed, toGarminWorkout, type GarminRepeat, type GarminStep } from "@/lib/watch/workout";
import type { Block } from "@/features/training/blocks";

const ref = { secPerKm: 300, kind: "threshold" as const }; // umbral 5:00/km

describe("garmin: velocidades", () => {
  it("convierte ritmo a m/s", () => {
    expect(paceToSpeed(300)).toBe(3.333);
    expect(paceToSpeed(240)).toBe(4.167);
  });

  it("una zona da un rango de velocidad (low = más lento)", () => {
    const t = garminTarget({ mode: "zone", value: "Z2" }, ref);
    expect(t.targetType).toBe("PACE");
    if (t.targetType === "PACE") {
      expect(t.targetValueLow).toBeLessThan(t.targetValueHigh);
      expect(t.targetValueLow).toBe(paceToSpeed(Math.round((300 * 100) / 78)));
    }
  });

  it("un % único lleva ±3 % de margen", () => {
    const t = garminTarget({ mode: "pct", value: 100 }, ref);
    expect(t).toEqual({ targetType: "PACE", targetValueLow: 3.233, targetValueHigh: 3.433 });
  });

  it("sin ritmo de referencia o sin objetivo → OPEN", () => {
    expect(garminTarget({ mode: "zone", value: "Z3" }, null).targetType).toBe("OPEN");
    expect(garminTarget({ mode: "none" }, ref).targetType).toBe("OPEN");
  });
});

describe("garmin: workout", () => {
  const blocks: Block[] = [
    { kind: "warmup", amount: { unit: "s", value: 900 }, target: { mode: "zone", value: "Z1" } },
    { kind: "intervals", reps: 6, work: { unit: "m", value: 1000 }, target: { mode: "pct", value: 103 }, recovery: { amount: { unit: "s", value: 90 }, type: "jog" } },
    { kind: "continuous", amount: { unit: "m", value: 3000 }, target: { mode: "none" }, note: "Suelto" },
    { kind: "cooldown", amount: { unit: "s", value: 600 }, target: { mode: "zone", value: "Z1" } },
  ];

  it("mapea bloques a pasos y series a repeticiones, con orden correlativo", () => {
    const w = toGarminWorkout({ title: "Pasadas 6×1000", notes: "Pista", blocks }, ref);
    expect(w.sport).toBe("RUNNING");
    expect(w.workoutName).toBe("Pasadas 6×1000");
    expect(w.steps.map((s) => s.type)).toEqual(["WorkoutStep", "WorkoutRepeatStep", "WorkoutStep", "WorkoutStep"]);
    const [warm, rep, cont, cool] = w.steps as [GarminStep, GarminRepeat, GarminStep, GarminStep];
    expect(warm).toMatchObject({ intensity: "WARMUP", durationType: "TIME", durationValue: 900, targetType: "PACE" });
    expect(rep).toMatchObject({ repeatValue: 6, repeatType: "REPEAT_UNTIL_STEPS_CMPLT" });
    expect(rep.steps[0]).toMatchObject({ intensity: "INTERVAL", durationType: "DISTANCE", durationValue: 1000, targetType: "PACE" });
    expect(rep.steps[1]).toMatchObject({ intensity: "RECOVERY", durationType: "TIME", durationValue: 90, targetType: "OPEN" });
    expect(cont).toMatchObject({ intensity: "ACTIVE", description: "Suelto", targetType: "OPEN" });
    expect(cool.intensity).toBe("COOLDOWN");
    const orders = [warm.stepOrder, rep.stepOrder, ...rep.steps.map((s) => s.stepOrder), cont.stepOrder, cool.stepOrder];
    expect(orders).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("el mismo plan da velocidades distintas para cada corredor", () => {
    const fast = toGarminWorkout({ title: "x", notes: null, blocks }, { secPerKm: 240, kind: "threshold" });
    const slow = toGarminWorkout({ title: "x", notes: null, blocks }, { secPerKm: 360, kind: "threshold" });
    const speed = (w: typeof fast) => ((w.steps[1] as GarminRepeat).steps[0] as GarminStep & { targetValueHigh: number }).targetValueHigh;
    expect(speed(fast)).toBeGreaterThan(speed(slow));
  });
});
