export type EventKind = "road" | "trail" | "track" | "social" | "trip";

export const EVENT_KINDS: Record<EventKind, { label: string; emoji: string }> = {
  road: { label: "Calle", emoji: "🏙️" },
  trail: { label: "Trail", emoji: "⛰️" },
  track: { label: "Pista", emoji: "🏟️" },
  social: { label: "Salida especial", emoji: "🌅" },
  trip: { label: "Viaje", emoji: "🚌" },
};

/** Días entre hoy y la fecha del evento (ambos YYYY-MM-DD en la zona del club). */
export function daysBetween(from: string, to: string): number {
  const d = (s: string) => {
    const [y, m, dd] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, dd) / 86_400_000;
  };
  return d(to) - d(from);
}

export function countdownLabel(today: string, eventDate: string): string {
  const days = daysBetween(today, eventDate);
  if (days < 0) return "Finalizado";
  if (days === 0) return "¡Es hoy!";
  if (days === 1) return "Es mañana";
  return `Faltan ${days} días`;
}

/** "5K, 10K , 21k" → ["5K","10K","21K"] (sin repetidos, máx. 10) */
export function parseDistances(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(/[,;/]+/)) {
    const d = raw.trim().toUpperCase().replace(/\s+/g, " ");
    if (d && d.length <= 20 && !out.includes(d)) out.push(d);
  }
  return out.slice(0, 10);
}
