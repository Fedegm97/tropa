import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ROOT_DOMAIN } from "@/lib/env";
import { clubSlugFromHost } from "@/lib/hosts";
import { PLANS, effectivePlan, type Feature, type PlanCode } from "@/lib/domain/plans";
import type { Database } from "@/lib/supabase/database.types";

export type ClubRow = Database["public"]["Tables"]["clubs"]["Row"];
export type MembershipRow = Database["public"]["Tables"]["memberships"]["Row"];
export type Role = Database["public"]["Enums"]["member_role"];

/** Branding público del club (funciona sin sesión). */
export const getPublicClub = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("club_public_by_slug", { p_slug: slug }).maybeSingle();
  return data;
});

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data;
});

export type ClubContext = {
  club: ClubRow;
  membership: MembershipRow;
  userId: string;
  isStaff: boolean;
  isOwner: boolean;
};

/**
 * Carga el club y la membership del usuario actual.
 * - Sin sesión → al login del club.
 * - Con sesión pero sin membership → pantalla "no sos parte de este club".
 */
export const requireClub = cache(async (slug: string, next = "/"): Promise<ClubContext> => {
  const user = await getUser();
  if (!user) redirect(`/ingresar?next=${encodeURIComponent(next)}`);

  const supabase = await createClient();
  const { data: club } = await supabase.from("clubs").select("*").eq("slug", slug).maybeSingle();
  if (!club) {
    const publicClub = await getPublicClub(slug);
    if (!publicClub) notFound();
    redirect("/sin-acceso");
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("*")
    .eq("club_id", club.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) redirect("/sin-acceso");

  const isStaff = membership.role === "owner" || membership.role === "coach";
  return { club, membership, userId: user.id, isStaff, isOwner: membership.role === "owner" };
});

export async function requireStaff(slug: string, next = "/") {
  const ctx = await requireClub(slug, next);
  if (!ctx.isStaff) redirect("/");
  return ctx;
}

export async function requireOwner(slug: string, next = "/") {
  const ctx = await requireClub(slug, next);
  if (!ctx.isOwner) redirect("/");
  return ctx;
}

/** Club a partir del header que pone el proxy (para Server Actions). */
export async function clubSlugFromHeaders(): Promise<string> {
  const h = await headers();
  const slug = clubSlugFromHost(h.get("x-forwarded-host") ?? h.get("host"), ROOT_DOMAIN);
  if (!slug) throw new Error("No club in host");
  return slug;
}

/** Contexto del club para Server Actions (el slug sale del host, no del cliente). */
export async function actionClub(): Promise<ClubContext> {
  return requireClub(await clubSlugFromHeaders());
}

export async function actionStaff(): Promise<ClubContext> {
  const ctx = await actionClub();
  if (!ctx.isStaff) throw new Error("forbidden");
  return ctx;
}

export async function currentOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? ROOT_DOMAIN;
  const proto = h.get("x-forwarded-proto") ?? (host.includes("lvh.me") || host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}


export function clubPlan(club: ClubRow): PlanCode {
  return effectivePlan({
    planCode: club.plan_code as PlanCode,
    planStatus: club.plan_status,
    trialEndsAt: club.trial_ends_at,
    planOverride: club.plan_override,
  });
}

export function clubHas(club: ClubRow, feature: Feature): boolean {
  return PLANS[clubPlan(club)].features.includes(feature);
}

export type ClubSettings = { fee_reminder_day?: number; birthday_greeting?: boolean };
export function clubSettings(club: ClubRow): ClubSettings {
  return (club.settings ?? {}) as ClubSettings;
}
