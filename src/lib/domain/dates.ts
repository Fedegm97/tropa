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
