/**
 * Planes de la plataforma: espejo de la tabla platform_plans y de
 * club_effective_plan() / club_can_add() en SQL.
 */

export type PlanCode = "free" | "coach" | "team" | "club";
export type PlanStatus = "trialing" | "active" | "past_due" | "canceled";
export type Feature =
  | "training"
  | "events"
  | "announcements"
  | "shifts"
  | "fees"
  | "medical"
  | "birthdays"
  | "store"
  | "priority_support"
  | "watch_sync";

export type Plan = {
  code: PlanCode;
  name: string;
  priceUsdCents: number;
  maxRunners: number | null;
  maxStaff: number | null;
  features: Feature[];
};

const BASE: Feature[] = ["training", "events", "announcements", "shifts"];
const COACH: Feature[] = [...BASE, "fees", "medical", "birthdays", "watch_sync"];
const TEAM: Feature[] = [...COACH, "store", "priority_support"];

export const PLANS: Record<PlanCode, Plan> = {
  free: { code: "free", name: "Free", priceUsdCents: 0, maxRunners: 10, maxStaff: 1, features: BASE },
  coach: { code: "coach", name: "Coach", priceUsdCents: 1499, maxRunners: 30, maxStaff: 1, features: COACH },
  team: { code: "team", name: "Team", priceUsdCents: 3999, maxRunners: 150, maxStaff: 5, features: TEAM },
  club: { code: "club", name: "Club", priceUsdCents: 0, maxRunners: null, maxStaff: null, features: TEAM },
};

export const TRIAL_DAYS = 30;

export type ClubBilling = {
  planCode: PlanCode;
  planStatus: PlanStatus;
  trialEndsAt: string | null;
  planOverride: boolean;
};

export function effectivePlan(club: ClubBilling, now: Date = new Date()): PlanCode {
  if (club.planOverride) return club.planCode;
  if (club.planStatus === "canceled") return "free";
  if (club.planStatus === "trialing" && club.trialEndsAt && new Date(club.trialEndsAt) < now) return "free";
  return club.planCode;
}

export function hasFeature(plan: PlanCode, feature: Feature): boolean {
  return PLANS[plan].features.includes(feature);
}

export type LimitCheck =
  | { ok: true; limit: number | null; used: number }
  | { ok: false; limit: number; used: number; upgradeTo: PlanCode | null };

/** ¿Se puede sumar un corredor/coach más? Nunca afecta a los datos ya cargados. */
export function checkLimit(plan: PlanCode, kind: "runner" | "staff", used: number): LimitCheck {
  const limit = kind === "runner" ? PLANS[plan].maxRunners : PLANS[plan].maxStaff;
  if (limit === null || used < limit) return { ok: true, limit, used };
  return { ok: false, limit, used, upgradeTo: nextPlanFor(plan, kind, used + 1) };
}

function nextPlanFor(current: PlanCode, kind: "runner" | "staff", needed: number): PlanCode | null {
  const order: PlanCode[] = ["free", "coach", "team", "club"];
  for (const code of order.slice(order.indexOf(current) + 1)) {
    const limit = kind === "runner" ? PLANS[code].maxRunners : PLANS[code].maxStaff;
    if (limit === null || limit >= needed) return code;
  }
  return null;
}
