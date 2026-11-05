import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@/lib/club";
import { ROOT_DOMAIN } from "@/lib/env";
import { rootOrigin } from "@/lib/hosts";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWatchProvider } from "@/lib/watch/providers";

export async function GET(req: NextRequest, { params }: RouteContext<"/api/watch/[provider]/callback">) {
  const { provider: name } = await params;
  const origin = rootOrigin(ROOT_DOMAIN);
  const jar = await cookies();
  const raw = jar.get("watch_oauth")?.value;
  jar.delete({ name: "watch_oauth", path: "/api/watch" });
  let saved: { state: string; verifier: string; back: string; provider: string } | null = null;
  try {
    saved = raw ? JSON.parse(raw) : null;
  } catch {}
  const back = (status: string) => {
    const url = new URL(saved?.back ?? origin);
    url.searchParams.set("reloj", status);
    url.hash = "reloj";
    return NextResponse.redirect(url);
  };

  const provider = getWatchProvider(name, origin);
  const code = req.nextUrl.searchParams.get("code");
  if (!provider || !saved || saved.provider !== name || saved.state !== req.nextUrl.searchParams.get("state") || !code) return back("error");
  const user = await getUser();
  if (!user) return back("login");

  try {
    const t = await provider.exchangeCode({ code, codeVerifier: saved.verifier, redirectUri: `${origin}/api/watch/${name}/callback` });
    const { error } = await createAdminClient().from("watch_connections").upsert({
      user_id: user.id,
      provider: provider.name,
      external_user_id: t.externalUserId,
      access_token: t.accessToken,
      refresh_token: t.refreshToken,
      expires_at: t.expiresAt,
      connected_at: new Date().toISOString(),
    });
    if (error) throw error;
    return back("ok");
  } catch (e) {
    console.error("[watch callback]", e);
    return back("error");
  }
}
