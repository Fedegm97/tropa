import { NextResponse, type NextRequest } from "next/server";
import { processBillingWebhook } from "@/lib/billing/process";

export const dynamic = "force-dynamic";

/** Webhooks de cobros: /api/billing/webhook/mercadopago (configurar en el panel de Mercado Pago). */
export async function POST(req: NextRequest, { params }: RouteContext<"/api/billing/webhook/[provider]">) {
  const { provider } = await params;
  const result = await processBillingWebhook(provider, { url: req.url, headers: req.headers, body: await req.text() });
  return NextResponse.json(result.body, { status: result.status });
}
