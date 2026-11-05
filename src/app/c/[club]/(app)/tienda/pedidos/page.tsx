import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Avatar } from "@/components/brand/club-badge";
import { Badge, Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { OrderButtons } from "@/features/store/order-buttons";
import { ORDER_STATUS, type OrderStatus } from "@/features/store/labels";
import { requireClub } from "@/lib/club";
import { formatMoney } from "@/lib/domain/money";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pedidos" };

export default async function OrdersPage({ params, searchParams }: PageProps<"/c/[club]/tienda/pedidos">) {
  const [{ club: slug }, sp] = await Promise.all([params, searchParams]);
  const { club, isStaff, userId } = await requireClub(slug, "/tienda/pedidos");
  const filter = (Object.keys(ORDER_STATUS) as OrderStatus[]).find((s) => s === sp.estado) ?? null;
  const supabase = await createClient();
  let q = supabase
    .from("orders")
    .select("id, number, status, total_cents, note, created_at, user_id, profiles(full_name, avatar_path), order_items(product_name, size, quantity, unit_price_cents)")
    .eq("club_id", club.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!isStaff) q = q.eq("user_id", userId);
  if (filter) q = q.eq("status", filter);
  const { data: orders } = await q;

  return (
    <div>
      <PageHeader title={isStaff ? "Pedidos" : "Mis pedidos"} back="/tienda" />
      {isStaff && (
        <div className="mb-4 flex flex-wrap gap-2">
          {([null, "pending_payment", "paid", "delivered", "canceled"] as (OrderStatus | null)[]).map((s) => (
            <Link
              key={s ?? "all"}
              href={s ? `/tienda/pedidos?estado=${s}` : "/tienda/pedidos"}
              className={cn("flex min-h-11 items-center rounded-full border px-4 text-sm font-medium", filter === s ? "border-accent bg-accent/15" : "border-border text-muted")}
            >
              {s ? ORDER_STATUS[s].label : "Todos"}
            </Link>
          ))}
        </div>
      )}
      {!orders || orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Sin pedidos" description={isStaff ? "Cuando un corredor pida algo de la tienda, te llega una notificación." : "Todavía no hiciste pedidos."} />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id} className="space-y-3">
              <div className="flex items-center gap-3">
                {isStaff && <Avatar name={o.profiles?.full_name ?? "?"} path={o.profiles?.avatar_path} />}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl font-bold">Pedido #{o.number}</p>
                  <p className="truncate text-xs text-muted">
                    {isStaff ? `${o.profiles?.full_name} · ` : ""}
                    {new Date(o.created_at).toLocaleDateString("es-AR")}
                  </p>
                </div>
                <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>
              </div>
              <ul className="space-y-1 text-sm">
                {o.order_items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>
                      {it.quantity}× {it.product_name}
                      {it.size ? ` · ${it.size}` : ""}
                    </span>
                    <span className="font-mono text-muted">{formatMoney(it.unit_price_cents * it.quantity, club.currency)}</span>
                  </li>
                ))}
              </ul>
              {o.note && <p className="text-sm text-muted">“{o.note}”</p>}
              <div className="flex items-center justify-between border-t border-border/60 pt-2">
                <span className="font-mono font-semibold">{formatMoney(o.total_cents, club.currency)}</span>
              </div>
              <OrderButtons id={o.id} status={o.status} isStaff={isStaff} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
