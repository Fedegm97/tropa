export type MedicalStatus = "valid" | "expiring" | "expired" | "missing";

export const MEDICAL_STATUS_LABEL: Record<MedicalStatus, string> = {
  valid: "Vigente",
  expiring: "Por vencer",
  expired: "Vencido",
  missing: "Sin cargar",
};

export const EXPIRING_WINDOW_DAYS = 30;

function toUtcDay(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Días hasta el vencimiento (negativo si ya venció). Fechas YYYY-MM-DD. */
export function daysUntil(expiresOn: string, today: string): number {
  return toUtcDay(expiresOn) - toUtcDay(today);
}

/**
 * El apto vale hasta el día de vencimiento inclusive.
 * Por vencer: vence dentro de los próximos 30 días (incluido hoy).
 */
export function medicalStatus(expiresOn: string | null | undefined, today: string): MedicalStatus {
  if (!expiresOn) return "missing";
  const days = daysUntil(expiresOn, today);
  if (days < 0) return "expired";
  if (days <= EXPIRING_WINDOW_DAYS) return "expiring";
  return "valid";
}
