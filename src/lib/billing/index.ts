import "server-only";
import { ROOT_DOMAIN } from "@/lib/env";
import { rootOrigin } from "@/lib/hosts";
import { FakeBillingProvider } from "./fake";
import { MercadoPagoProvider } from "./mercadopago";
import type { BillingProvider } from "./types";

export function fakeBillingAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_FAKE_BILLING === "1";
}

export function getBillingProvider(name?: string): BillingProvider | null {
  const selected = name ?? process.env.BILLING_PROVIDER ?? (process.env.MP_ACCESS_TOKEN ? "mercadopago" : "fake");
  switch (selected) {
    case "mercadopago": {
      const token = process.env.MP_ACCESS_TOKEN;
      const secret = process.env.MP_WEBHOOK_SECRET;
      return token && secret ? new MercadoPagoProvider(token, secret) : null;
    }
    case "fake": {
      const secret = process.env.FAKE_BILLING_SECRET ?? process.env.CRON_SECRET;
      return fakeBillingAllowed() && secret ? new FakeBillingProvider(secret, rootOrigin(ROOT_DOMAIN)) : null;
    }
    // case "stripe": return new StripeProvider(...)  ← Fase siguiente: implementar BillingProvider
    default:
      return null;
  }
}

export * from "./types";
