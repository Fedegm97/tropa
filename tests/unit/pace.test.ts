import { describe, expect, it } from "vitest";
import {
  ZONES,
  describeTarget,
  formatPace,
  formatPaceRange,
  paceAtPercent,
  parsePace,
  targetPaceRange,
  thresholdPace,
} from "@/lib/domain/pace";

describe("thresholdPace", () => {
  it("devuelve el mismo ritmo si el corredor cargó su umbral", () => {
    expect(thresholdPace({ secPerKm: 270, kind: "threshold" })).toBe(270);
  });

  it("estima el umbral desde el 5K con Riegel (5K en 20:00 → ~4:15/km)", () => {
    const t = thresholdPace({ secPerKm: 240, kind: "5k" });
    expect(t).toBeGreaterThan(250);
    expect(t).toBeLessThan(260);
    expect(Math.round(t)).toBe(255);
  });

  it("el umbral siempre es más lento que el ritmo de 5K", () => {
    for (const pace of [180, 240, 300, 360, 420]) {
      expect(thresholdPace({ secPerKm: pace, kind: "5k" })).toBeGreaterThan(pace);
    }
  });

  it("rechaza ritmos inválidos", () => {
    expect(() => thresholdPace({ secPerKm: 0, kind: "5k" })).toThrow();
  });
});

describe("paceAtPercent (porcentaje sobre la velocidad)", () => {
  it("100% es el ritmo de referencia", () => {
    expect(paceAtPercent(300, 100)).toBe(300);
  });
  it("menos de 100% es más lento", () => {
    expect(paceAtPercent(300, 80)).toBe(375);
  });
  it("más de 100% es más rápido", () => {
    expect(paceAtPercent(300, 105)).toBe(286);
  });
});

describe("targetPaceRange", () => {
  const ref = { secPerKm: 300, kind: "threshold" as const };

  it("un mismo plan da un ritmo distinto para cada corredor", () => {
    const target = { mode: "pct" as const, value: 95 };
    const fast = targetPaceRange(target, { secPerKm: 240, kind: "threshold" });
    const slow = targetPaceRange(target, { secPerKm: 360, kind: "threshold" });
    expect(fast).toEqual({ fast: 253, slow: 253 });
    expect(slow).toEqual({ fast: 379, slow: 379 });
  });

  it("una zona da un rango (rápido = límite superior de velocidad)", () => {
    const range = targetPaceRange({ mode: "zone", value: "Z2" }, ref);
    expect(range).toEqual({ fast: paceAtPercent(300, ZONES.Z2.max), slow: paceAtPercent(300, ZONES.Z2.min) });
    expect(range!.fast).toBeLessThan(range!.slow);
  });

  it("las zonas son contiguas y crecientes", () => {
    const zones = Object.values(ZONES);
    for (let i = 1; i < zones.length; i++) expect(zones[i].min).toBe(zones[i - 1].max);
  });

  it("devuelve null sin ritmo de referencia o sin objetivo", () => {
    expect(targetPaceRange({ mode: "zone", value: "Z3" }, null)).toBeNull();
    expect(targetPaceRange({ mode: "none" }, ref)).toBeNull();
  });
});

describe("formato", () => {
  it("formatea y parsea mm:ss", () => {
    expect(formatPace(245)).toBe("4:05");
    expect(formatPace(599.6)).toBe("10:00");
    expect(parsePace("4:05")).toBe(245);
    expect(parsePace(" 5'30 ")).toBe(330);
    expect(parsePace("4:75")).toBeNull();
    expect(parsePace("abc")).toBeNull();
  });

  it("formatea rangos y descripciones", () => {
    expect(formatPaceRange({ fast: 245, slow: 245 })).toBe("4:05 /km");
    expect(formatPaceRange({ fast: 245, slow: 260 })).toBe("4:05–4:20 /km");
    expect(describeTarget({ mode: "zone", value: "Z2" })).toBe("Z2 · Aeróbico");
    expect(describeTarget({ mode: "pct", value: 90 })).toBe("90% umbral");
  });
});
