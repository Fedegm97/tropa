import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { authCookieDomain, clubSlugFromHost } from "@/lib/hosts";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lvh.me:3000";

/** Rutas que funcionan igual en el dominio raíz y en cada club (no se reescriben). */
const SHARED_PREFIXES = ["/api/", "/auth/"];

/**
 * Multi-tenancy por subdominio:
 *   rionorte.tropa.app/plan  →  /c/rionorte/plan   (rewrite interno, la URL no cambia)
 *   tropa.app/…              →  landing, alta de clubes y superadmin
 * Además refresca la sesión de Supabase en cada request.
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const slug = clubSlugFromHost(host, ROOT_DOMAIN);
  const { pathname } = request.nextUrl;

  let target: URL | null = null;
  const isShared = SHARED_PREFIXES.some((p) => pathname.startsWith(p));

  if (pathname === "/c" || pathname.startsWith("/c/")) {
    // Nunca se accede directo a las rutas internas de los clubes.
    target = new URL("/404-not-found", request.url);
  } else if (slug && !isShared) {
    target = request.nextUrl.clone();
    target.pathname = `/c/${slug}${pathname === "/" ? "" : pathname}`;
  }

  const makeResponse = () =>
    target ? NextResponse.rewrite(target, { request }) : NextResponse.next({ request });

  let response = makeResponse();

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: { domain: authCookieDomain(ROOT_DOMAIN) },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = makeResponse();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refresca el token si está por vencer. No usar el resultado para autorizar acá:
  // la autorización real está en RLS y en cada página.
  await supabase.auth.getUser();

  if (slug) response.headers.set("x-club-slug", slug);
  return response;
}

export const config = {
  matcher: [
    // Todo menos estáticos, el service worker y archivos con extensión de imagen.
    "/((?!_next/static|_next/image|sw\\.js|offline\\.html|robots\\.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico|gif)$).*)",
  ],
};
