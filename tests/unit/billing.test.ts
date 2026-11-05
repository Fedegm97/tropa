import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { MercadoPagoProvider, mapStatus, verifySignature } from "@/lib/billing/mercadopago";
import { FakeBillingProvider } from "@/lib/billing/fake";
import { InvalidSignatureError, decodeReference, encodeReference } from "@/lib/billing/types";

const SECRET = "mp-secret";
const CLUB = "11111111-1111-1111-1111-111111111111";

function sign(dataId: string, requestId: string, ts = "1730800000") {
  const v1 = createHmac("sha256", SECRET).update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("referencias", () => {
  it("ida y vuelta, y rechaza basura", () => {
    expect(decodeReference(encodeReference(CLUB, "team"))).toEqual({ clubId: CLUB, plan: "team" });
    expect(decodeReference(`${CLUB}|club`)).toBeNull();
    expect(decodeReference("x|team")).toBeNull();
    expect(decodeReference(null)).toBeNull();
  });
});

describe("Mercado Pago", () => {
  it("mapea estados", () => {
    expect(mapStatus("authorized")).toBe("authorized");
    expect(mapStatus("paused")).toBe("paused");
    expect(mapStatus("cancelled")).toBe("cancelled");
    expect(mapStatus("pending")).toBe("pending");
  });

  it("verifica la firma x-signature (ids alfanuméricos en minúsculas)", () => {
    expect(verifySignature({ secret: SECRET, signature: sign("ABC123", "req-1"), requestId: "req-1", dataId: "ABC123" })).toBe(true);
    expect(verifySignature({ secret: SECRET, signature: sign("ABC123", "req-1"), requestId: "req-2", dataId: "ABC123" })).toBe(false);
    expect(verifySignature({ secret: "otro", signature: sign("ABC123", "req-1"), requestId: "req-1", dataId: "ABC123" })).toBe(false);
    expect(verifySignature({ secret: SECRET, signature: null, requestId: "req-1", dataId: "ABC123" })).toBe(false);
    expect(verifySignature({ secret: SECRET, signature: "ts=1,v1=zz", requestId: "req-1", dataId: "ABC123" })).toBe(false);
  });

  it("crea el checkout con el monto en pesos y la referencia del club", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "pre_1", init_point: "https://mp.test/checkout/pre_1" }), { status: 201 }));
    const mp = new MercadoPagoProvider("token", SECRET, fetchMock as unknown as typeof fetch);
    const res = await mp.createCheckout({
      clubId: CLUB,
      plan: "team",
      reason: "Tropa · Plan Team",
      amountCents: 4999900,
      currency: "ARS",
      payerEmail: "owner@club.com",
      backUrl: "https://rionorte.tropa.app/ajustes/plan",
    });
    expect(res).toEqual({ externalId: "pre_1", url: "https://mp.test/checkout/pre_1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/preapproval");
    const body = JSON.parse(init.body as string);
    expect(body.external_reference).toBe(`${CLUB}|team`);
    expect(body.auto_recurring).toEqual({ frequency: 1, frequency_type: "months", transaction_amount: 49999, currency_id: "ARS" });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token");
  });

  it("webhook: rechaza firmas inválidas y consulta el estado real (no confía en el cuerpo)", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "pre_1", status: "authorized", external_reference: `${CLUB}|coach`, payer_email: "a@b.c", next_payment_date: "2026-12-05T00:00:00Z" })),
    );
    const mp = new MercadoPagoProvider("token", SECRET, fetchMock as unknown as typeof fetch);
    const body = JSON.stringify({ type: "subscription_preapproval", data: { id: "pre_1" } });
    const url = "https://tropa.app/api/billing/webhook/mercadopago?data.id=pre_1&type=subscription_preapproval";

    await expect(mp.handleWebhook({ url, body, headers: new Headers({ "x-signature": "ts=1,v1=00", "x-request-id": "r1" }) })).rejects.toBeInstanceOf(InvalidSignatureError);
    expect(fetchMock).not.toHaveBeenCalled();

    const res = await mp.handleWebhook({ url, body, headers: new Headers({ "x-signature": sign("pre_1", "r1"), "x-request-id": "r1" }) });
    expect(res).toMatchObject({
      kind: "subscription",
      eventId: "r1",
      subscription: { externalId: "pre_1", clubId: CLUB, plan: "coach", status: "authorized", payerEmail: "a@b.c" },
    });
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("https://api.mercadopago.com/preapproval/pre_1");
  });

  it("webhook de pago autorizado: busca la suscripción asociada", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 99, preapproval_id: "pre_9" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "pre_9", status: "authorized", external_reference: `${CLUB}|team` })));
    const mp = new MercadoPagoProvider("token", SECRET, fetchMock as unknown as typeof fetch);
    const res = await mp.handleWebhook({
      url: "https://tropa.app/api/billing/webhook/mercadopago?data.id=99&type=subscription_authorized_payment",
      body: "",
      headers: new Headers({ "x-signature": sign("99", "r2"), "x-request-id": "r2" }),
    });
    expect(res).toMatchObject({ kind: "subscription", subscription: { externalId: "pre_9", plan: "team" } });
  });
});

describe("proveedor simulado", () => {
  it("firma y verifica sus propios webhooks", async () => {
    const fake = new FakeBillingProvider("s3cr3t", "http://lvh.me:3000");
    const { body, signature } = fake.buildWebhook({ externalId: "fake_1", clubId: CLUB, plan: "team", status: "authorized", periodEnd: null, payerEmail: null });
    const ok = await fake.handleWebhook({ url: "http://x", body, headers: new Headers({ "x-fake-signature": signature }) });
    expect(ok).toMatchObject({ kind: "subscription", subscription: { status: "authorized" } });
    await expect(fake.handleWebhook({ url: "http://x", body, headers: new Headers({ "x-fake-signature": "x".repeat(64) }) })).rejects.toBeInstanceOf(
      InvalidSignatureError,
    );
  });
});
