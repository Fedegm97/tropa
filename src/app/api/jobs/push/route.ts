import { NextResponse, type NextRequest } from "next/server";
import { dispatchPendingPush } from "@/lib/push/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Disparado por pg_cron (POST) o Vercel Cron (GET) con Authorization: Bearer CRON_SECRET. */
async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await dispatchPendingPush();
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
