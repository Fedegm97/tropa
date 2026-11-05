import { createHmac, timingSafeEqual } from "node:crypto";
import {
  InvalidSignatureError,
  decodeReference,
  encodeReference,
  type BillingProvider,
  type CheckoutInput,
  type NormalizedSubscription,
  type SubscriptionStatus,
  type WebhookResult,
} from "./types";

const API = "https://api.mercadopago.com";

type Preapproval = {
  id: string;
  status: string;
  external_reference?: string | null;
  payer_email?: string | null;
  next_payment_date?: string | null;
  init_point?: string;
};

export function mapStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "authorized":
      return "authorized";
    case "paused":
      return "paused";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "pending";
  }
}

/**
 * Verifica x-signature de Mercado Pago.
 * Manifest: "id:{data.id};request-id:{x-request-id};ts:{ts};" firmado con HMAC-SHA256 (hex).
 * Los ids alfanuméricos se firman en minúsculas.
 */
export function verifySignature(opts: { secret: string; signature: string | null; requestId: string | null; dataId: string | null }): boolean {
  if (!opts.signature || !opts.secret) return false;
  const parts = Object.fromEntries(
    opts.signature.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  let manifest = "";
  if (opts.dataId) manifest += `id:${/^[a-z0-9]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId};`;
  if (opts.requestId) manifest += `request-id:${opts.requestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac("sha256", opts.secret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export class MercadoPagoProvider implements BillingProvider {
  readonly name = "mercadopago" as const;

  constructor(
    private readonly accessToken: string,
    private readonly webhookSecret: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetchImpl(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${text.slice(0, 300)}`);
    return (text ? JSON.parse(text) : {}) as T;
  }

  async createCheckout(input: CheckoutInput) {
    const body = {
      reason: input.reason,
      external_reference: encodeReference(input.clubId, input.plan),
      payer_email: input.payerEmail,
      back_url: input.backUrl,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: input.amountCents / 100,
        currency_id: input.currency,
      },
    };
    const p = await this.api<Preapproval>("/preapproval", { method: "POST", body: JSON.stringify(body) });
    if (!p.init_point) throw new Error("Mercado Pago no devolvió init_point");
    return { externalId: p.id, url: p.init_point };
  }

  async cancel(externalId: string) {
    await this.api(`/preapproval/${encodeURIComponent(externalId)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  }

  async fetchSubscription(id: string): Promise<NormalizedSubscription | null> {
    const p = await this.api<Preapproval>(`/preapproval/${encodeURIComponent(id)}`);
    const ref = decodeReference(p.external_reference);
    if (!ref) return null;
    return {
      externalId: p.id,
      clubId: ref.clubId,
      plan: ref.plan,
      status: mapStatus(p.status),
      periodEnd: p.next_payment_date ?? null,
      payerEmail: p.payer_email ?? null,
      raw: p,
    };
  }

  async handleWebhook(req: { url: string; headers: Headers; body: string }): Promise<WebhookResult> {
    const url = new URL(req.url);
    let payload: { type?: string; action?: string; data?: { id?: string } } = {};
    try {
      payload = req.body ? JSON.parse(req.body) : {};
    } catch {
      /* algunas notificaciones llegan solo por query string */
    }
    const type = payload.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
    const dataId = url.searchParams.get("data.id") ?? payload.data?.id ?? null;
    const requestId = req.headers.get("x-request-id");

    if (!verifySignature({ secret: this.webhookSecret, signature: req.headers.get("x-signature"), requestId, dataId })) {
      throw new InvalidSignatureError();
    }
    if (!dataId) return { kind: "ignored", reason: "sin data.id" };

    let preapprovalId: string | null = null;
    if (type === "subscription_preapproval") preapprovalId = dataId;
    else if (type === "subscription_authorized_payment") {
      const payment = await this.api<{ preapproval_id?: string }>(`/authorized_payments/${encodeURIComponent(dataId)}`);
      preapprovalId = payment.preapproval_id ?? null;
    }
    if (!preapprovalId) return { kind: "ignored", reason: `tipo ${type}` };

    // Nunca confiamos en el cuerpo del webhook: consultamos el estado real.
    const subscription = await this.fetchSubscription(preapprovalId);
    if (!subscription) return { kind: "ignored", reason: "external_reference desconocida" };
    return { kind: "subscription", eventId: requestId ?? `${type}:${dataId}`, type, subscription };
  }
}
