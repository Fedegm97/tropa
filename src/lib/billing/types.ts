/**
 * Capa de abstracción de cobros de la plataforma.
 * Hoy: Mercado Pago (suscripciones / preapproval). Para sumar Stripe alcanza con
 * implementar BillingProvider y registrarlo en ./index.ts.
 */

export type PaidPlan = "coach" | "team";
export type SubscriptionStatus = "pending" | "authorized" | "paused" | "cancelled";

export type CheckoutInput = {
  clubId: string;
  plan: PaidPlan;
  reason: string; // texto que ve el pagador
  amountCents: number; // en la moneda del proveedor (ARS para Mercado Pago)
  currency: string;
  payerEmail: string;
  backUrl: string;
};

export type CheckoutResult = { externalId: string; url: string };

export type NormalizedSubscription = {
  externalId: string;
  clubId: string;
  plan: PaidPlan;
  status: SubscriptionStatus;
  periodEnd: string | null;
  payerEmail: string | null;
  raw: unknown;
};

export type WebhookResult =
  | { kind: "ignored"; reason: string }
  | { kind: "subscription"; eventId: string; type: string; subscription: NormalizedSubscription };

export interface BillingProvider {
  readonly name: "mercadopago" | "stripe" | "fake";
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  cancel(externalId: string): Promise<void>;
  /** Verifica la firma, consulta el estado real al proveedor y lo normaliza. Tira si la firma es inválida. */
  handleWebhook(req: { url: string; headers: Headers; body: string }): Promise<WebhookResult>;
}

export class InvalidSignatureError extends Error {
  constructor() {
    super("invalid webhook signature");
  }
}

/** external_reference = "{clubId}|{plan}" */
export function encodeReference(clubId: string, plan: PaidPlan) {
  return `${clubId}|${plan}`;
}

export function decodeReference(ref: string | null | undefined): { clubId: string; plan: PaidPlan } | null {
  const m = /^([0-9a-f-]{36})\|(coach|team)$/.exec(ref ?? "");
  return m ? { clubId: m[1]!, plan: m[2] as PaidPlan } : null;
}
