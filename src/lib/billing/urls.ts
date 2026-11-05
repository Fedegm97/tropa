import { ROOT_DOMAIN } from "@/lib/env";
import { clubSlugFromHost } from "@/lib/hosts";

/** Solo permite volver a un subdominio de la plataforma (evita open redirects). */
export function safeNextAbsolute(raw: string): string | null {
  try {
    const u = new URL(raw);
    const rootHost = ROOT_DOMAIN.toLowerCase();
    if (u.host.toLowerCase() === rootHost || clubSlugFromHost(u.host, ROOT_DOMAIN)) return u.toString();
  } catch {}
  return null;
}
