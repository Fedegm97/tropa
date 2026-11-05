import { NextResponse, type NextRequest } from "next/server";
import { dispatchWatchSyncs } from "@/lib/watch/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await dispatchWatchSyncs());
}

export const GET = handle;
export const POST = handle;
