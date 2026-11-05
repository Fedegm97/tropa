/**
 * Resolución de tenant por host. Sin dependencias: se usa en el proxy (edge/node)
 * y en el cliente.
 */

const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin"]);

function hostname(hostWithPort: string): string {
  return hostWithPort.split(":")[0]!.toLowerCase();
}

/**
 * "rionorte.tropa.app" + root "tropa.app" → "rionorte"
 * "tropa.app" | "www.tropa.app" | "otro-dominio.com" → null
 */
export function clubSlugFromHost(host: string | null | undefined, rootDomain: string): string | null {
  if (!host) return null;
  const h = hostname(host);
  const root = hostname(rootDomain);
  if (h === root || !h.endsWith(`.${root}`)) return null;
  const sub = h.slice(0, -(root.length + 1));
  if (!sub || sub.includes(".") || RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}

export function isLocalDomain(rootDomain: string): boolean {
  const h = hostname(rootDomain);
  return h === "localhost" || h.endsWith(".localhost") || h === "lvh.me" || h === "127.0.0.1";
}

function protocol(rootDomain: string) {
  return isLocalDomain(rootDomain) ? "http" : "https";
}

export function rootOrigin(rootDomain: string): string {
  return `${protocol(rootDomain)}://${rootDomain}`;
}

export function clubOrigin(slug: string, rootDomain: string): string {
  return `${protocol(rootDomain)}://${slug}.${rootDomain}`;
}

/**
 * Dominio de la cookie de sesión: compartida entre el dominio raíz y todos los
 * clubes, así quien crea su club en tropa.app entra directo a {slug}.tropa.app.
 * `localhost` no admite cookies de dominio: ahí queda por host.
 */
export function authCookieDomain(rootDomain: string): string | undefined {
  const h = hostname(rootDomain);
  if (h === "localhost" || h === "127.0.0.1") return undefined;
  return `.${h}`;
}

/** Solo paths relativos internos (evita open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
