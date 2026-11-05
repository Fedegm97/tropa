import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { getUser } from "@/lib/club";
import { ROOT_DOMAIN } from "@/lib/env";
import { authCookieDomain, rootOrigin } from "@/lib/hosts";
import { safeNextAbsolute } from "@/lib/billing/urls";
import { getWatchProvider, pkcePair } from "@/lib/watch/providers";

/** Inicia la conexión del reloj (OAuth 2.0 + PKCE). El callback es único, en el dominio raíz. */
export async function GET(req: NextRequest, { params }: RouteContext<"/api/watch/[provider]/connect">) {
  const { provider: name } = await params;
  const origin = rootOrigin(ROOT_DOMAIN);
  const provider = getWatchProvider(name, origin);
  const back = safeNextAbsolute(req.nextUrl.searchParams.get("back") ?? "") ?? origin;
  if (!provider) return NextResponse.redirect(new URL(`${back.split("?")[0]}?reloj=no-disponible`));
  if (!(await getUser())) return NextResponse.redirect(new URL(`${back.split("?")[0]}?reloj=login`));

  const { verifier, challenge } = pkcePair();
  const state = randomBytes(16).toString("base64url");
  const jar = await cookies();
  const opts = { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax" as const, path: "/api/watch", maxAge: 600, domain: authCookieDomain(ROOT_DOMAIN) };
  jar.set("watch_oauth", JSON.stringify({ state, verifier, back, provider: name }), opts);

  return NextResponse.redirect(provider.authorizeUrl({ state, codeChallenge: challenge, redirectUri: `${origin}/api/watch/${name}/callback` }));
}
