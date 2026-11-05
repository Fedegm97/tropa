/**
 * Cálculo de ritmos personalizados.
 *
 * Convenciones:
 * - Los ritmos se expresan en segundos por kilómetro (s/km).
 * - El ancla de todos los cálculos es el ritmo de UMBRAL del corredor.
 *   Si el corredor cargó su ritmo de 5K, el umbral se estima con la fórmula
 *   de Riegel (T2 = T1 · (D2/D1)^1.06) como el ritmo sostenible durante 60 min.
 * - Los porcentajes son sobre la VELOCIDAD, no sobre el ritmo:
 *   100% = ritmo umbral, 90% = más lento, 105% = más rápido.
 * - Las zonas son rangos de % de la velocidad de umbral.
 */

export type PaceKind = "5k" | "threshold";
export type Zone = "Z1" | "Z2" | "Z3" | "Z4" | "Z5";

export type PaceTarget =
  | { mode: "pct"; value: number }
  | { mode: "zone"; value: Zone }
  | { mode: "none" };

export type ReferencePace = { secPerKm: number; kind: PaceKind };
export type PaceRange = { fast: number; slow: number };

const RIEGEL_EXPONENT = 1.06;
const THRESHOLD_SECONDS = 3600;

export const ZONES: Record<Zone, { label: string; min: number; max: number }> = {
  Z1: { label: "Recuperación", min: 65, max: 78 },
  Z2: { label: "Aeróbico", min: 78, max: 88 },
  Z3: { label: "Tempo", min: 88, max: 95 },
  Z4: { label: "Umbral", min: 95, max: 102 },
  Z5: { label: "VO2 máx", min: 102, max: 110 },
};

/** Ritmo umbral (s/km) a partir del ritmo de referencia cargado. */
export function thresholdPace(ref: ReferencePace): number {
  if (!(ref.secPerKm > 0)) throw new RangeError("secPerKm must be > 0");
  if (ref.kind === "threshold") return ref.secPerKm;

  const t5k = ref.secPerKm * 5; // tiempo total del 5K en segundos
  // Distancia (m) que se sostiene en 60 minutos según Riegel.
  const distance = 5000 * Math.pow(THRESHOLD_SECONDS / t5k, 1 / RIEGEL_EXPONENT);
  return THRESHOLD_SECONDS / (distance / 1000);
}

/** Ritmo (s/km) correspondiente a un % de la velocidad de umbral. */
export function paceAtPercent(thresholdSecPerKm: number, pct: number): number {
  if (!(pct > 0)) throw new RangeError("pct must be > 0");
  return Math.round((thresholdSecPerKm * 100) / pct);
}

/**
 * Ritmo objetivo de un bloque para un corredor.
 * Devuelve null si el bloque no tiene objetivo o si el corredor no cargó su ritmo
 * (en ese caso la UI muestra solo la descripción: "Z2 · Aeróbico").
 */
export function targetPaceRange(target: PaceTarget, ref: ReferencePace | null | undefined): PaceRange | null {
  if (!ref || target.mode === "none") return null;
  const threshold = thresholdPace(ref);
  if (target.mode === "pct") {
    const pace = paceAtPercent(threshold, target.value);
    return { fast: pace, slow: pace };
  }
  const zone = ZONES[target.value];
  return { fast: paceAtPercent(threshold, zone.max), slow: paceAtPercent(threshold, zone.min) };
}

/** 245 → "4:05" */
export function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

/** "4:05" → 245. Devuelve null si el formato es inválido. */
export function parsePace(input: string): number | null {
  const match = /^\s*(\d{1,2})[:'.](\d{2})\s*$/.exec(input);
  if (!match) return null;
  const min = Number(match[1]);
  const sec = Number(match[2]);
  if (sec >= 60) return null;
  return min * 60 + sec;
}

/** {fast: 245, slow: 260} → "4:05–4:20 /km" */
export function formatPaceRange(range: PaceRange): string {
  if (range.fast === range.slow) return `${formatPace(range.fast)} /km`;
  return `${formatPace(range.fast)}–${formatPace(range.slow)} /km`;
}

export function describeTarget(target: PaceTarget): string {
  if (target.mode === "none") return "Libre";
  if (target.mode === "pct") return `${target.value}% umbral`;
  return `${target.value} · ${ZONES[target.value].label}`;
}
