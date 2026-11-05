import { CheckCircle2, Clock, Wallet } from "lucide-react";
import { Badge, Card, SectionTitle } from "@/components/ui/card";
import { LockedFeature } from "@/components/ui/locked-feature";
import { PageHeader } from "@/components/shell/page-header";
import { DeclarePaymentForm } from "@/features/fees/declare-form";
import { DeletePaymentButton } from "@/features/fees/payment-actions";
import { METHOD_LABELS, PAYMENT_STATUS_LABEL } from "@/features/fees/labels";
import { feeStatuses, signedUrls } from "@/features/fees/data";
import { clubHas, requireClub } from "@/lib/club";
import { todayIn } from "@/lib/domain/dates";
import { periodOf } from "@/lib/domain/fees";
import { formatMoney, periodLabel } from "@/lib/domain/money";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Mi cuota" };

export default async function MyFeePage({ params }: PageProps<"/c/[club]/cuota">) {
  const { club: slug } = await params;
  const { club, userId, isStaff } = await requireClub(slug, "/cuota");
  const enabled = clubHas(club, "fees");
  const period = periodOf(todayIn(club.timezone));
  const supabase = await createClient();
  const [rows, { data: payments }] = await Promise.all([
    enabled ? feeStatuses(club.id, period) : Promise.resolve([]),
    supabase.from("fee_payments").select("*").eq("club_id", club.id).eq("user_id", userId).order("period", { ascending: false }).order("created_at", { ascending: false }).limit(24),
  ]);
  const me = rows.find((r) => r.user_id === userId);
  const receipts = await signedUrls((payments ?? []).map((p) => p.receipt_path));
  const remaining = me && me.amount_due ? Math.max(0, me.amount_due - me.confirmed_cents) : null;

  return (
    <div>
      <PageHeader title="Mi cuota" back="/" />
      {!enabled && (payments ?? []).length === 0 ? (
        <LockedFeature feature="fees" title="Cuotas" isStaff={isStaff} />
      ) : (
        <>
          {me && (
            <Card className={me.status === "paid" ? "border-success/40" : me.status === "pending" ? "border-warning/40" : "border-danger/40"}>
              <p className="font-mono text-xs uppercase tracking-widest text-subtle">{periodLabel(period)}</p>
              <div className="mt-2 flex items-center gap-3">
                {me.status === "paid" ? (
                  <CheckCircle2 className="size-9 text-success" aria-hidden />
                ) : me.status === "pending" ? (
                  <Clock className="size-9 text-warning" aria-hidden />
                ) : (
                  <Wallet className="size-9 text-danger" aria-hidden />
                )}
                <div>
                  <p className="font-display text-3xl font-extrabold uppercase leading-none">
                    {me.status === "paid" ? "Al día" : me.status === "pending" ? "Pendiente de confirmar" : "Debés"}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {me.amount_due === 0
                      ? "Estás becado este mes."
                      : me.status === "owed"
                        ? `${formatMoney(remaining, club.currency)} de ${formatMoney(me.amount_due, club.currency)}`
                        : `Cuota: ${formatMoney(me.amount_due, club.currency)}`}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {enabled && me && me.status === "owed" && (
            <div className="mt-4">
              <DeclarePaymentForm clubId={club.id} userId={userId} period={period} suggestedAmount={remaining ? String(remaining / 100) : ""} />
            </div>
          )}

          <SectionTitle className="mt-6">Pagos informados</SectionTitle>
          {(payments ?? []).length === 0 ? (
            <p className="text-sm text-subtle">Todavía no informaste pagos.</p>
          ) : (
            <div className="space-y-2">
              {payments!.map((p) => (
                <Card key={p.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {periodLabel(p.period)} · <span className="font-mono">{formatMoney(p.amount_cents, club.currency)}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {METHOD_LABELS[p.method]}
                      {p.receipt_path && receipts.get(p.receipt_path) && (
                        <>
                          {" · "}
                          <a href={receipts.get(p.receipt_path)} target="_blank" rel="noopener noreferrer" className="underline">
                            Ver comprobante
                          </a>
                        </>
                      )}
                    </p>
                    {p.status === "rejected" && p.reject_reason && <p className="text-xs text-danger">Motivo: {p.reject_reason}</p>}
                  </div>
                  <Badge tone={p.status === "confirmed" ? "success" : p.status === "pending" ? "warning" : "danger"}>{PAYMENT_STATUS_LABEL[p.status]}</Badge>
                  {p.status === "pending" && <DeletePaymentButton id={p.id} />}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
