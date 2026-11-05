import { feeStatuses, parsePeriod } from "@/features/fees/data";
import { clubHas, requireStaff } from "@/lib/club";
import { toCsv } from "@/lib/domain/csv";
import { todayIn } from "@/lib/domain/dates";
import { FEE_STATUS_LABEL, periodOf } from "@/lib/domain/fees";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request, { params }: RouteContext<"/c/[club]/cuotas/export">) {
  const { club: slug } = await params;
  const { club } = await requireStaff(slug, "/cuotas");
  if (!clubHas(club, "fees")) return new Response("Forbidden", { status: 403 });
  const period = parsePeriod(new URL(req.url).searchParams.get("periodo"), periodOf(todayIn(club.timezone)));

  const supabase = await createClient();
  const [rows, { data: shifts }] = await Promise.all([feeStatuses(club.id, period), supabase.from("shifts").select("id, name").eq("club_id", club.id)]);
  const shiftName = (id: string | null) => shifts?.find((s) => s.id === id)?.name ?? "";
  const pesos = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ","));

  const csv = toCsv(
    ["Corredor", "Turno", "Período", "Monto", "Pagado (confirmado)", "Pagos sin confirmar", "Estado"],
    rows.map((r) => [r.full_name, shiftName(r.shift_id), period.slice(0, 7), pesos(r.amount_due), pesos(r.confirmed_cents), r.pending_count, FEE_STATUS_LABEL[r.status]]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cuotas-${club.slug}-${period.slice(0, 7)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
