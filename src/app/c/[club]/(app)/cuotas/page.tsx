import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Settings2 } from "lucide-react";
import { Avatar } from "@/components/brand/club-badge";
import { Button } from "@/components/ui/button";
import { Badge, Card, SectionTitle } from "@/components/ui/card";
import { LockedFeature } from "@/components/ui/locked-feature";
import { PageHeader } from "@/components/shell/page-header";
import { ReviewButtons } from "@/features/fees/payment-actions";
import { METHOD_LABELS, STATUS_TONE } from "@/features/fees/labels";
import { feeStatuses, parsePeriod, signedUrls } from "@/features/fees/data";
import { clubHas, requireStaff } from "@/lib/club";
import { todayIn } from "@/lib/domain/dates";
import { FEE_STATUS_LABEL, periodOf, summarizeFees, type FeeStatus } from "@/lib/domain/fees";
import { addMonths, formatMoney, periodLabel } from "@/lib/domain/money";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Cuotas" };

export default async function FeesPage({ params, searchParams }: PageProps<"/c/[club]/cuotas">) {
  const [{ club: slug }, sp] = await Promise.all([params, searchParams]);
  const { club } = await requireStaff(slug, "/cuotas");
  if (!clubHas(club, "fees")) {
    return (
      <div>
        <PageHeader title="Cuotas" back="/" />
        <LockedFeature feature="fees" title="Cuotas" isStaff />
      </div>
    );
  }
  const current = periodOf(todayIn(club.timezone));
  const period = parsePeriod(sp.periodo, current);
  const filter = (["paid", "pending", "owed"] as const).find((s) => s === sp.estado) ?? null;

  const supabase = await createClient();
  const [rows, { data: pendingPayments }] = await Promise.all([
    feeStatuses(club.id, period),
    supabase
      .from("fee_payments")
      .select("id, user_id, amount_cents, method, receipt_path, note, created_at, profiles!fee_payments_user_id_fkey(full_name, avatar_path)")
      .eq("club_id", club.id)
      .eq("period", period)
      .eq("status", "pending")
      .order("created_at"),
  ]);
  const receipts = await signedUrls((pendingPayments ?? []).map((p) => p.receipt_path));
  const summary = summarizeFees(rows.map((r) => r.status));
  const visible = filter ? rows.filter((r) => r.status === filter) : rows;
  const link = (q: Record<string, string | null>) => {
    const params = new URLSearchParams({ periodo: period });
    for (const [k, v] of Object.entries(q)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    return `/cuotas?${params}`;
  };

  return (
    <div>
      <PageHeader
        title="Cuotas"
        back="/"
        action={
          <Button asChild variant="secondary" size="icon" aria-label="Configurar cuotas">
            <Link href="/cuotas/config">
              <Settings2 />
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-surface p-1">
        <Button asChild variant="ghost" size="icon" aria-label="Mes anterior">
          <Link href={link({ periodo: addMonths(period, -1), estado: filter })}>
            <ChevronLeft />
          </Link>
        </Button>
        <p className="font-display text-lg font-bold uppercase">{periodLabel(period)}</p>
        <Button asChild variant="ghost" size="icon" aria-label="Mes siguiente" className={cn(period >= current && "pointer-events-none opacity-30")}>
          <Link href={link({ periodo: addMonths(period, 1), estado: filter })}>
            <ChevronRight />
          </Link>
        </Button>
      </div>

      <Card className="mb-3">
        <p className="font-display text-4xl font-extrabold leading-none">
          {summary.paid} <span className="text-2xl text-muted">de {summary.total} al día</span>
        </p>
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <span className="bg-success" style={{ width: `${(summary.paid / Math.max(1, summary.total)) * 100}%` }} />
          <span className="bg-warning" style={{ width: `${(summary.pending / Math.max(1, summary.total)) * 100}%` }} />
          <span className="bg-danger" style={{ width: `${(summary.owed / Math.max(1, summary.total)) * 100}%` }} />
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
        {([null, "paid", "pending", "owed"] as (FeeStatus | null)[]).map((s) => (
          <Link
            key={s ?? "all"}
            href={link({ estado: s })}
            aria-current={filter === s ? "true" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium",
              filter === s ? "border-accent bg-accent/15 text-fg" : "border-border text-muted",
            )}
          >
            {s ? FEE_STATUS_LABEL[s] : "Todos"}
            <span className="font-mono text-xs text-subtle">{s ? summary[s] : summary.total}</span>
          </Link>
        ))}
      </div>

      {(pendingPayments ?? []).length > 0 && (
        <>
          <SectionTitle>Para confirmar · {pendingPayments!.length}</SectionTitle>
          <div className="mb-4 space-y-2">
            {pendingPayments!.map((p) => (
              <Card key={p.id} className="space-y-3 border-warning/40 p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={p.profiles?.full_name ?? "?"} path={p.profiles?.avatar_path} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.profiles?.full_name}</p>
                    <p className="font-mono text-xs text-muted">
                      {formatMoney(p.amount_cents, club.currency)} · {METHOD_LABELS[p.method]}
                    </p>
                  </div>
                  {p.receipt_path && receipts.get(p.receipt_path) && (
                    <a href={receipts.get(p.receipt_path)} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center text-sm text-accent-text underline">
                      Comprobante
                    </a>
                  )}
                </div>
                {p.note && <p className="text-sm text-muted">“{p.note}”</p>}
                <ReviewButtons id={p.id} />
              </Card>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Corredores</SectionTitle>
      <div className="space-y-2">
        {visible.map((r) => (
          <Card key={r.user_id} className="flex items-center gap-3 p-3">
            <Avatar name={r.full_name} path={r.avatar_path} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.full_name}</p>
              <p className="font-mono text-xs text-muted">
                {r.amount_due === null ? "Sin monto definido" : r.amount_due === 0 ? "Becado" : `${formatMoney(r.confirmed_cents, club.currency)} / ${formatMoney(r.amount_due, club.currency)}`}
              </p>
            </div>
            <Badge tone={STATUS_TONE[r.status]}>{FEE_STATUS_LABEL[r.status]}</Badge>
          </Card>
        ))}
        {visible.length === 0 && <p className="text-sm text-subtle">No hay corredores en este estado.</p>}
      </div>

      <Button asChild variant="outline" block className="mt-6">
        <a href={`/cuotas/export?periodo=${period}`} download>
          <Download /> Exportar CSV
        </a>
      </Button>
    </div>
  );
}
