import { Badge, Card, SectionTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/page-header";
import { DeleteRuleButton, FeeRuleForm, ReminderDayForm } from "@/features/fees/config-forms";
import { clubSettings, requireStaff } from "@/lib/club";
import { todayIn } from "@/lib/domain/dates";
import { periodOf } from "@/lib/domain/fees";
import { formatMoney, periodLabel } from "@/lib/domain/money";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Configurar cuotas" };

export default async function FeeConfigPage({ params }: PageProps<"/c/[club]/cuotas/config">) {
  const { club: slug } = await params;
  const { club, isOwner } = await requireStaff(slug, "/cuotas/config");
  const supabase = await createClient();
  const [{ data: rules }, { data: shifts }, { data: runners }] = await Promise.all([
    supabase.from("fee_rules").select("*").eq("club_id", club.id).order("valid_from", { ascending: false }),
    supabase.from("shifts").select("id, name").eq("club_id", club.id).is("archived_at", null).order("starts_at"),
    supabase.from("memberships").select("user_id, profiles(full_name)").eq("club_id", club.id).eq("status", "active").eq("role", "runner"),
  ]);
  const runnerOpts = (runners ?? []).map((r) => ({ id: r.user_id, name: r.profiles?.full_name || "Sin nombre" })).sort((a, b) => a.name.localeCompare(b.name, "es"));
  const describe = (r: { shift_id: string | null; user_id: string | null }) =>
    r.user_id ? runnerOpts.find((x) => x.id === r.user_id)?.name ?? "Corredor" : r.shift_id ? `Turno ${shifts?.find((s) => s.id === r.shift_id)?.name ?? ""}` : "Todo el club";

  return (
    <div>
      <PageHeader title="Configurar cuotas" back="/cuotas" />
      <p className="mb-4 text-sm text-muted">
        La cuota de cada corredor sale de la regla más específica: la suya, la de su turno o la general del club. Si cambia el monto, cargá una regla nueva desde el mes en que rige; el historial no se toca.
      </p>
      <Card>
        <FeeRuleForm shifts={shifts ?? []} runners={runnerOpts} defaultPeriod={periodOf(todayIn(club.timezone))} />
      </Card>

      <SectionTitle className="mt-6">Montos cargados</SectionTitle>
      <div className="space-y-2">
        {(rules ?? []).map((r) => (
          <Card key={r.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{describe(r)}</p>
              <p className="font-mono text-xs text-muted">desde {periodLabel(r.valid_from)}</p>
            </div>
            {r.amount_cents === 0 ? <Badge tone="accent">Becado</Badge> : <span className="font-mono">{formatMoney(r.amount_cents, club.currency)}</span>}
            <DeleteRuleButton id={r.id} />
          </Card>
        ))}
        {(rules ?? []).length === 0 && <p className="text-sm text-subtle">Todavía no cargaste la cuota del club.</p>}
      </div>

      <SectionTitle className="mt-6">Recordatorio automático</SectionTitle>
      <Card>
        <ReminderDayForm day={clubSettings(club).fee_reminder_day ?? 10} canEdit={isOwner} />
      </Card>
    </div>
  );
}
