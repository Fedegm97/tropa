"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { ROOT_DOMAIN, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { authCookieDomain } from "@/lib/hosts";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  client ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: { domain: authCookieDomain(ROOT_DOMAIN) },
  });
  return client;
}
