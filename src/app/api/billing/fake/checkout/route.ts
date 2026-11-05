import { NextResponse, type NextRequest } from "next/server";
import { FakeBillingProvider } from "@/lib/billing/fake";
import { getBillingProvider } from "@/lib/billing";
import { processBillingWebhook } from "@/lib/billing/process";
import { safeNextAbsolute } from "@/lib/billing/urls";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Checkout simulado (solo desarrollo): muestra la "pantalla de pago" del proveedor. */
export async function GET(req: NextRequest) {
  const provider = getBillingProvider("fake");
  if (!provider) return new NextResponse("Not found", { status: 404 });
  const p = req.nextUrl.searchParams;
  const amount = (Number(p.get("amount") ?? 0) / 100).toLocaleString("es-AR");
  const hidden = ["id", "club", "plan", "email", "back"].map((k) => `<input type="hidden" name="${k}" value="${esc(p.get(k) ?? "")}">`).join("");
  const html = `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pago simulado</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f4f4;margin:0;display:grid;place-items:center;min-height:100vh;padding:16px}main{background:#fff;border-radius:16px;padding:24px;max-width:360px;width:100%;box-shadow:0 4px 24px #0001}h1{font-size:20px;margin:0 0 4px}p{color:#555}button{width:100%;min-height:48px;border:0;border-radius:12px;font-size:16px;font-weight:600;margin-top:8px;cursor:pointer}.ok{background:#009ee3;color:#fff}.no{background:#eee}</style></head>
<body><main><small>ENTORNO DE PRUEBA · no se cobra nada</small><h1>Suscripción plan ${esc(p.get("plan") ?? "")}</h1><p>$ ${esc(amount)} por mes · ${esc(p.get("email") ?? "")}</p>
<form method="post">${hidden}<button class="ok" name="action" value="authorized">Aprobar suscripción</button><button class="no" name="action" value="cancelled">Cancelar</button></form></main></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(req: NextRequest) {
  const provider = getBillingProvider("fake");
  if (!(provider instanceof FakeBillingProvider)) return new NextResponse("Not found", { status: 404 });
  const form = await req.formData();
  const get = (k: string) => String(form.get(k) ?? "");
  const status = get("action") === "authorized" ? "authorized" : "cancelled";
  const plan = get("plan") === "team" ? "team" : "coach";
  const { body, signature } = provider.buildWebhook({
    externalId: get("id"),
    clubId: get("club"),
    plan,
    status,
    periodEnd: status === "authorized" ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null,
    payerEmail: get("email") || null,
  });
  const result = await processBillingWebhook("fake", { url: req.url, headers: new Headers({ "x-fake-signature": signature }), body });
  const back = safeNextAbsolute(get("back"));
  if (!back) return NextResponse.json(result.body, { status: result.status });
  const url = new URL(back);
  url.searchParams.set("estado", result.status === 200 && status === "authorized" ? "ok" : "cancelado");
  return NextResponse.redirect(url, 303);
}
