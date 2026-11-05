import { notFound } from "next/navigation";
import { Badge, Card, Stat } from "@/components/ui/card";
import { AdminPlanForm } from "@/features/clubs/admin-plan-form";
import { getProfile } from "@/lib/club";
import { ROOT_DOMAIN } from "@/lib/env";
import { clubOrigin } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Superadmin" };

export default async function AdminPage() {
  const profile = await getProfile();
  if (!profile?.is_superadmin) notFound();

  const supabase = await createClient();
  const { data: clubs, error } = await supabase.rpc("admin_clubs_overview");
  if (error) throw error;

  const totalRunners = clubs.reduce((s, c) => s + Number(c.runners), 0);
  const paying = clubs.filter((c) => c.effective_plan !== "free").length;

  return (
    <div className="py-6">
      <h1 className="font-display text-4xl font-extrabold uppercase">Superadmin</h1>
      <div className="my-6 grid grid-cols-3 gap-3">
        <Stat label="Clubes" value={clubs.length} />
        <Stat label="Corredores" value={totalRunners} />
        <Stat label="En plan pago" value={paying} />
      </div>
      <div className="space-y-3">
        {clubs.map((c) => (
          <Card key={c.id} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <a href={clubOrigin(c.slug, ROOT_DOMAIN)} className="font-semibold hover:underline">
                {c.name}
              </a>
              <span className="font-mono text-xs text-subtle">{c.slug}</span>
              <Badge tone={c.effective_plan === "free" ? "neutral" : "accent"}>{c.effective_plan}</Badge>
              {c.plan_override && <Badge tone="warning">piloto</Badge>}
              <Badge tone={c.plan_status === "active" || c.plan_status === "trialing" ? "success" : "danger"}>{c.plan_status}</Badge>
            </div>
            <p className="font-mono text-xs text-muted">
              {c.runners} corredores · {c.staff} staff · {c.sessions_30d} sesiones completadas (30 días) · alta{" "}
              {new Date(c.created_at).toLocaleDateString("es-AR")}
            </p>
            <AdminPlanForm clubId={c.id} plan={c.plan_code} status={c.plan_status} override={c.plan_override} />
          </Card>
        ))}
      </div>
    </div>
  );
}
