import type { FeeStatus } from "@/lib/domain/fees";

export const METHOD_LABELS = { transfer: "Transferencia", cash: "Efectivo", mercadopago: "Mercado Pago", other: "Otro" } as const;
export type PaymentMethod = keyof typeof METHOD_LABELS;

export const STATUS_TONE: Record<FeeStatus, "success" | "warning" | "danger"> = { paid: "success", pending: "warning", owed: "danger" };
export const PAYMENT_STATUS_LABEL = { pending: "Pendiente", confirmed: "Confirmado", rejected: "Rechazado" } as const;
