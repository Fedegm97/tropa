import Link from "next/link";
import { CalendarHeart, ChevronRight, Clock, HeartPulse, Lock, Sparkles, Wallet } from "lucide-react";
import { Avatar } from "@/components/brand/club-badge";
import { Badge, Card, SectionTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/page-header";
import { BrandingForm } from "@/features/clubs/branding-form";
import { CoachInviteForm } from "@/features/clubs/coach-invite-form";
import { InviteBlock } from "@/features/onboarding/invite-block";
import { PLANS, checkLimit, effectivePlan, type Feature, type PlanCode } from "@/lib/domain/plans";
import { clubSettings, currentOrigin, requireStaff } from "@/lib/club";
import { BirthdayToggle } from "@/features/fees/config-forms";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Club" };

const FEATURE_LABELS: Partial<Record<Feature, string>> = {
  fees: "Cuotas",
  medical: "Apto médico",
  birthdays: "Cumpleaños",
  store: "Tienda",
  priority_support: "Soporte prioritario",
};

export default async function SettingsPage({ params }: PageProps<"/c/[club]/ajustes">) {
  const { club: slug } = await params;
  const { club, isOwner } = await requireStaff(slug, "/ajustes");
  const supabase = await createClient();
  const origin = await currentOrigin();
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("memberships").select("user_id, role, profiles(full_name, avatar_path)").eq("club_id", club.id).eq("status", "active"),
    isOwner
      ? supabase.from("staff_invitations").select("id, email, token").eq("club_id", club.id).is("accepted_at", null).gt("expires_at", new Date().toISOString())
      : Promise.resolve({ data: [] }),
  ]);
  const staff = (members ?? []).filter((m) => m.role !== "runner");
  const runners = (members ?? []).filter((m) => m.role === "runner").length;
  const planCode = effectivePlan({ planCode: club.plan_code as PlanCode, planStatus: club.plan_status, trialEndsAt: club.trial_ends_at, planOverride: club.plan_override });
  const plan = PLANS[planCode];
  const staffLimit = checkLimit(planCode, "staff", staff.length);
  const runnerLimit = checkLimit(planCode, "runner", runners);
  const locked = (Object.keys(FEATURE_LABELS) as Feature[]).filter((f) => !plan.features.includes(f));

  return (
    <div>
      <PageHeader title="Tu club" />

      <SectionTitle>Invitar corredores</SectionTitle>
      <InviteBlock clubName={club.name} origin={origin} initialCode={club.invite_code} canRegenerate />

      <SectionTitle>Organización</SectionTitle>
      <div className="space-y-2">
        {[
          { href: "/turnos", label: "Turnos", icon: Clock, on: true },
          { href: "/eventos", label: "Eventos", icon: CalendarHeart, on: true },
          { href: "/cuotas", label: "Cuotas", icon: Wallet, on: plan.features.includes("fees") },
          { href: "/aptos", label: "Aptos médicos", icon: HeartPulse, on: plan.features.includes("medical") },
        ].map(({ href, label, icon: Icon, on }) => (
          <Link key={href} href={href} className="block">
            <Card className="flex items-center gap-3 hover:bg-surface-2">
              <Icon className="size-5 text-accent-text" aria-hidden />
              <span className="flex-1 font-medium">{label}</span>
              {!on && <Lock className="size-4 text-subtle" aria-label="No incluido en tu plan" />}
              <ChevronRight className="size-5 text-subtle" aria-hidden />
            </Card>
          </Link>
        ))}
        {plan.features.includes("birthdays") && (
          <Card>
            <BirthdayToggle enabled={!!clubSettings(club).birthday_greeting} canEdit={isOwner} />
          </Card>
        )}
      </div>

      <SectionTitle>Plan</SectionTitle>
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-display text-3xl font-extrabold uppercase">{plan.name}</p>
          {club.plan_status === "trialing" && club.trial_ends_at && <Badge tone="warning">Prueba hasta {new Date(club.trial_ends_at).toLocaleDateString("es-AR")}</Badge>}
          {club.plan_override && <Badge tone="accent">Piloto</Badge>}
        </div>
        <div className="space-y-2 font-mono text-sm">
          <UsageBar label="Corredores" used={runners} limit={plan.maxRunners} />
          <UsageBar label="Coaches" used={staff.length} limit={plan.maxStaff} />
        </div>
        {(!runnerLimit.ok || !staffLimit.ok || locked.length > 0) && (
          <div className="rounded-2xl bg-accent/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-accent-text">
              <Sparkles className="size-4" /> Sumá más con un plan superior
            </p>
            {!runnerLimit.ok && <p className="mt-1 text-muted">Llegaste al límite de corredores. Los que ya están siguen igual; para sumar nuevos, pasate a {runnerLimit.upgradeTo ? PLANS[runnerLimit.upgradeTo].name : "un plan mayor"}.</p>}
            {locked.length > 0 && (
              <p className="mt-1 flex flex-wrap items-center gap-1 text-muted">
                <Lock className="size-3.5" /> {locked.map((f) => FEATURE_LABELS[f]).join(" · ")}
              </p>
            )}
            <p className="mt-2 text-xs text-subtle">Los pagos online llegan pronto. Mientras tanto, escribinos y lo activamos a mano.</p>
          </div>
        )}
      </Card>

      {isOwner && (
        <>
          <SectionTitle>Marca</SectionTitle>
          <Card>
            <BrandingForm clubId={club.id} name={club.name} color={club.primary_color} logoPath={club.logo_path} />
          </Card>
        </>
      )}

      <SectionTitle>Coaches</SectionTitle>
      <Card className="space-y-3">
        {staff.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3">
            <Avatar name={m.profiles?.full_name || "?"} path={m.profiles?.avatar_path} />
            <span className="flex-1">{m.profiles?.full_name || "Sin nombre"}</span>
            <Badge tone={m.role === "owner" ? "accent" : "neutral"}>{m.role}</Badge>
          </div>
        ))}
        {isOwner &&
          (staffLimit.ok ? (
            <CoachInviteForm origin={origin} pending={invites ?? []} />
          ) : (
            <p className="text-sm text-muted">Tu plan permite {plan.maxStaff} coach{plan.maxStaff === 1 ? "" : "es"}. Pasate a Team para sumar hasta 5.</p>
          ))}
      </Card>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span>
          {used}
          {limit ? ` / ${limit}` : " · ilimitado"}
        </span>
      </div>
      {limit && (
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div className={`h-full rounded-full ${pct >= 100 ? "bg-warning" : "bg-accent"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
