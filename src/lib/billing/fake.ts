import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { InvalidSignatureError, type BillingProvider, type CheckoutInput, type NormalizedSubscription, type WebhookResult } from "./types";

/**
 * Proveedor simulado para desarrollo y tests E2E: recorre el mismo flujo que
 * Mercado Pago (checkout → webhook firmado → apply_subscription) sin cobrar.
 * Nunca se habilita en producción salvo ALLOW_FAKE_BILLING=1.
 */
export class FakeBillingProvider implements BillingProvider {
  readonly name = "fake" as const;

  constructor(
    private readonly secret: string,
    private readonly origin: string,
  ) {}

  sign(body: string) {
    return createHmac("sha256", this.secret).update(body).digest("hex");
  }

  async createCheckout(input: CheckoutInput) {
    const externalId = `fake_${randomUUID()}`;
    const params = new URLSearchParams({
      id: externalId,
      club: input.clubId,
      plan: input.plan,
      email: input.payerEmail,
      amount: String(input.amountCents),
      back: input.backUrl,
    });
    return { externalId, url: `${this.origin}/api/billing/fake/checkout?${params}` };
  }

  async cancel() {
    /* el estado lo aplica la acción directamente */
  }

  /** Lo usa la página de checkout simulada para "notificar" como lo haría el proveedor. */
  buildWebhook(sub: Omit<NormalizedSubscription, "raw">) {
    const body = JSON.stringify(sub);
    return { body, signature: this.sign(body) };
  }

  async handleWebhook(req: { url: string; headers: Headers; body: string }): Promise<WebhookResult> {
    const sig = req.headers.get("x-fake-signature") ?? "";
    const expected = this.sign(req.body);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new InvalidSignatureError();
    const sub = JSON.parse(req.body) as Omit<NormalizedSubscription, "raw">;
    return { kind: "subscription", eventId: `${sub.externalId}:${sub.status}`, type: "fake", subscription: { ...sub, raw: { fake: true } } };
  }
}
