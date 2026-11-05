/**
 * Lógica de cuotas (Fase 2: la UI llega después, la lógica ya está testeada).
 * Debe coincidir con la función SQL fee_status().
 */

export type FeeStatus = "paid" | "pending" | "owed";
export type PaymentStatus = "pending" | "confirmed" | "rejected";

export type FeeRule = {
  shiftId: string | null;
  userId: string | null;
  amountCents: number;
  /** YYYY-MM-DD */
  validFrom: string;
};

export type FeePayment = { amountCents: number; status: PaymentStatus };

export const FEE_STATUS_LABEL: Record<FeeStatus, string> = {
  paid: "Al día",
  pending: "Pendiente de confirmar",
  owed: "Debe",
};

function specificity(rule: FeeRule): number {
  if (rule.userId) return 2;
  if (rule.shiftId) return 1;
  return 0;
}

/**
 * Monto que le corresponde a un corredor en un período (YYYY-MM-01).
 * Prioridad: regla del corredor > regla de su turno > regla general del club.
 * A igual prioridad, gana la regla vigente más reciente.
 */
export function resolveFeeAmount(
  rules: FeeRule[],
  runner: { userId: string; shiftId: string | null },
  period: string,
): number | null {
  const applicable = rules.filter(
    (r) =>
      r.validFrom <= period &&
      (r.userId ? r.userId === runner.userId : r.shiftId ? r.shiftId === runner.shiftId : true),
  );
  if (applicable.length === 0) return null;
  applicable.sort((a, b) => specificity(b) - specificity(a) || b.validFrom.localeCompare(a.validFrom));
  return applicable[0].amountCents;
}

/**
 * Estado de la cuota de un corredor en un mes.
 * - Al día: los pagos confirmados cubren el monto (o el monto es 0 / no aplica).
 * - Pendiente de confirmar: no está cubierto y hay al menos un pago declarado sin revisar.
 * - Debe: en cualquier otro caso (sin pagos, rechazados o parciales confirmados).
 */
export function feeStatus(amountDueCents: number | null, payments: FeePayment[]): FeeStatus {
  if (amountDueCents === null || amountDueCents <= 0) return "paid";
  const confirmed = payments
    .filter((p) => p.status === "confirmed")
    .reduce((sum, p) => sum + p.amountCents, 0);
  if (confirmed >= amountDueCents) return "paid";
  if (payments.some((p) => p.status === "pending")) return "pending";
  return "owed";
}

export function summarizeFees(statuses: FeeStatus[]) {
  const summary = { paid: 0, pending: 0, owed: 0, total: statuses.length };
  for (const s of statuses) summary[s] += 1;
  return summary;
}

/** "2026-11-15" → "2026-11-01" */
export function periodOf(date: string): string {
  return `${date.slice(0, 7)}-01`;
}
