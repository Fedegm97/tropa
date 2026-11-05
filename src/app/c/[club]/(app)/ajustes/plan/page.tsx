import { Check, PartyPopper } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/page-header";
import { PlanButtons } from "@/features/billing/plan-actions";
import { clubPlan, requireStaff } from "@/lib/club";
import { PLANS, type Feature, type PlanCode } from "@/lib/domain/plans";
import { formatMoney } from "@/lib/domain/money";
import { todayIn, utcToZoned } from "@/lib/domain/dates";
import { daysBetween } from "@/lib/domain/events";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Plan" };

const FEATURES: Record<Feature, string> = {
  training: "Planes de entrenamiento",
  announcements: "Avisos con push",
  events: "Eventos",
  shifts: "Turnos",
  fees: "Cuotas",
  medical: "Apto médico",
  birthdays: "Cumpleaños",
  watch_sync: "Envío al reloj Garmin",
  store: "Tienda del club",
  priority_support: "Soporte prioritario",
};

export default async function PlanPage({ params, searchParams }: PageProps<"/c/[club]/ajustes/plan">) {
  const [{ club: slug }, sp] = await Promise.all([params, searchParams]);
  const { club, isOwner } = await requireStaff(slug, "/ajustes/plan");
  const supabase = await createClient();
  const [{ data: prices }, { data: subs }] = await Promise.all([
    supabase.from("platform_plans").select("code, price_ars_cents"),
    isOwner
      ? supabase.from("platform_subscriptions").select("plan_code, status, current_period_end, provider").eq("club_id", club.id).order("created_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: [] }),
  ]);
  const current = clubPlan(club);
  const active = (subs ?? []).find((s) => s.status === "authorized");
  const ars = (code: string) => prices?.find((p) => p.code === code)?.price_ars_cents ?? null;
  const trialing = club.plan_status === "trialing" && current !== "free";
  const trialDays = club.trial_ends_at ? Math.max(0, daysBetween(todayIn(club.timezone), utcToZoned(club.trial_ends_at, club.timezone).date)) : 0;

  return (
    <div>
      <PageHeader title="Plan" back="/ajustes" />

      {sp.estado === "ok" && (
        <Card className="mb-4 flex items-center gap-3 border-success/40">
          <PartyPopper className="size-6 text-success" aria-hidden />
          <p className="text-sm">¡Gracias! Si todavía no ves el plan activo, esperá unos segundos: Mercado Pago nos avisa enseguida.</p>
        </Card>
      )}
      {club.plan_status === "past_due" && (
        <Card className="mb-4 border-danger/40 text-sm text-danger">No pudimos cobrar la última cuota. Revisá el medio de pago en Mercado Pago para no perder las funciones del plan.</Card>
      )}
      {club.plan_override && <Card className="mb-4 text-sm text-muted">Tu club es parte del programa piloto: el plan lo administramos nosotros.</Card>}

      <Card className="mb-5">
        <p className="font-mono text-xs uppercase tracking-widest text-subtle">Plan actual</p>
        <p className="font-display text-4xl font-extrabold uppercase leading-none">{PLANS[current].name}</p>
        <p className="mt-1 text-sm text-muted">
          {trialing ? `Prueba gratis · quedan ${trialDays} días` : active ? `Suscripción activa${active.current_period_end ? ` · próximo cobro ${new Date(active.current_period_end).toLocaleDateString("es-AR")}` : ""}` : current === "free" ? "Gratis para siempre" : ""}
        </p>
      </Card>

      <div className="space-y-3">
        {(["free", "coach", "team", "club"] as PlanCode[]).map((code) => {
          const plan = PLANS[code];
          const isCurrent = code === current;
          const price = ars(code);
          return (
            <Card key={code} className={cn("space-y-3", isCurrent && "border-accent")}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-2xl font-bold uppercase">{plan.name}</p>
                  <p className="font-mono text-sm text-muted">
                    {code === "free" ? "Gratis" : code === "club" ? "A medida" : `US$ ${(plan.priceUsdCents / 100).toFixed(2).replace(".", ",")}/mes${price ? ` · ${formatMoney(price)}` : ""}`}
                  </p>
                </div>
                {isCurrent && <Badge tone="accent">Actual</Badge>}
              </div>
              <p className="text-sm text-muted">
                {plan.maxRunners ? `Hasta ${plan.maxRunners} corredores` : "Corredores ilimitados"} · {plan.maxStaff ? `${plan.maxStaff} coach${plan.maxStaff > 1 ? "es" : ""}` : "coaches ilimitados"}
              </p>
              <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="size-4 text-success" aria-hidden /> {FEATURES[f]}
                  </li>
                ))}
              </ul>
              {isOwner && !club.plan_override && (code === "coach" || code === "team") && (!isCurrent || trialing || active) && (
                <PlanButtons
                  plan={code}
                  canTrial={!club.trial_used && current === "free"}
                  isCurrentPaid={isCurrent && !!active && active.plan_code === code}
                  isTrialing={isCurrent && trialing}
                />
              )}
              {code === "club" && !isCurrent && (
                <a href="mailto:hola@tropa.app?subject=Plan%20Club" className="flex min-h-11 items-center justify-center rounded-2xl border border-border text-sm font-semibold">
                  Escribinos
                </a>
              )}
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-subtle">Si superás un límite, nunca bloqueamos lo que ya cargaste: solo pedimos mejorar el plan para sumar más.</p>
    </div>
  );
}
