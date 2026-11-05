/** Fechas como strings YYYY-MM-DD para evitar sorpresas de zona horaria. */

export const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"] as const;
export const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

/** Hoy en la zona horaria del club. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function parse(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

/** ISO: 1 = lunes … 7 = domingo */
export function isoDay(date: string): number {
  const dow = parse(date).getUTCDay();
  return dow === 0 ? 7 : dow;
}

export function mondayOf(date: string): string {
  return addDays(date, 1 - isoDay(date));
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** "2026-11-05" → "jue 5/11" */
export function shortDate(date: string): string {
  const d = parse(date);
  const names = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  return `${names[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

export function formatDays(days: number[]): string {
  return [...days].sort().map((d) => DAY_NAMES[d - 1].slice(0, 3)).join(" · ");
}

/** Fecha y hora locales de una zona horaria → instante UTC (ISO). */
export function zonedToUtc(date: string, time: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = (instant: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(instant));
    const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - instant;
  };
  const first = guess - offset(guess);
  return new Date(guess - offset(first)).toISOString();
}

/** Instante UTC → { date, time } en la zona del club. */
export function utcToZoned(iso: string, timeZone: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return { date, time };
}
