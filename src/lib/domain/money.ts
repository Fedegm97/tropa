/** Montos en centavos (bigint en la base) ↔ texto en pesos. */

export function formatMoney(cents: number | null | undefined, currency = "ARS"): string {
  if (cents === null || cents === undefined) return "—";
  const value = cents / 100;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** "25.000" | "25000" | "25.000,50" | "$ 25.000" → centavos. null si no es válido. */
export function parseMoney(input: string): number | null {
  const clean = input.replace(/[$\s]/g, "").replace(/^ARS/i, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(clean)) return null;
  const [int, dec = ""] = clean.replace(/\./g, "").split(",");
  return Number(int) * 100 + Number(dec.padEnd(2, "0"));
}

/** "2026-11-01" → "Noviembre 2026" */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-AR", { month: "long", timeZone: "UTC" });
  return `${name[0]!.toUpperCase()}${name.slice(1)} ${y}`;
}

export function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}
