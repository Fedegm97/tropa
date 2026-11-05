import { Lock } from "lucide-react";
import { PLANS, type Feature, type PlanCode } from "@/lib/domain/plans";

const ORDER: PlanCode[] = ["coach", "team", "club"];

/** Mensaje claro + upsell cuando el plan no incluye una función. Nunca oculta datos ya cargados. */
export function LockedFeature({ feature, title, isStaff }: { feature: Feature; title: string; isStaff: boolean }) {
  const plan = ORDER.find((p) => PLANS[p].features.includes(feature)) ?? "team";
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-border px-6 py-10 text-center">
      <span className="mb-4 grid size-16 place-items-center rounded-full bg-accent/15">
        <Lock className="size-7 text-accent-text" aria-hidden />
      </span>
      <h2 className="font-display text-2xl font-bold uppercase">{title}</h2>
      <p className="mt-1 max-w-xs text-sm text-muted">
        {isStaff
          ? `Está incluido desde el plan ${PLANS[plan].name} (US$ ${(PLANS[plan].priceUsdCents / 100).toFixed(2).replace(".", ",")}/mes), con 30 días de prueba gratis. Escribinos y lo activamos.`
          : "Tu club todavía no activó esta función."}
      </p>
    </div>
  );
}
