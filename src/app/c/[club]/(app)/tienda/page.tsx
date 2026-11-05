import Link from "next/link";
import { Package, Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LockedFeature } from "@/components/ui/locked-feature";
import { PageHeader } from "@/components/shell/page-header";
import { signedUrls } from "@/features/fees/data";
import { clubHas, requireClub } from "@/lib/club";
import { formatMoney } from "@/lib/domain/money";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Tienda" };

export default async function StorePage({ params }: PageProps<"/c/[club]/tienda">) {
  const { club: slug } = await params;
  const { club, isStaff } = await requireClub(slug, "/tienda");
  if (!clubHas(club, "store")) {
    return (
      <div>
        <PageHeader title="Tienda" back="/" />
        <LockedFeature feature="store" title="Tienda del club" isStaff={isStaff} />
      </div>
    );
  }
  const supabase = await createClient();
  const [{ data: products }, { count: pendingOrders }] = await Promise.all([
    supabase.from("products").select("*, product_variants(size, stock)").eq("club_id", club.id).order("sort").order("name"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("club_id", club.id).in("status", isStaff ? ["pending_payment", "paid"] : ["pending_payment", "paid"]),
  ]);
  const photos = await signedUrls((products ?? []).map((p) => p.photo_path));

  return (
    <div>
      <PageHeader
        title="Tienda"
        back="/"
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/tienda/pedidos">
              <ShoppingBag /> {isStaff ? "Pedidos" : "Mis pedidos"}
              {pendingOrders ? <span className="rounded-full bg-accent px-1.5 font-mono text-[11px] text-accent-fg">{pendingOrders}</span> : null}
            </Link>
          </Button>
        }
      />
      {isStaff && (
        <Button asChild className="mb-4" size="sm">
          <Link href="/tienda/productos/nuevo">
            <Plus /> Nuevo producto
          </Link>
        </Button>
      )}
      {!products || products.length === 0 ? (
        <EmptyState icon={Package} title="Tienda vacía" description={isStaff ? "Cargá remeras, buzos o gorras del club con sus talles y stock." : "Pronto vas a encontrar la ropa del club acá."} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => {
            const stock = p.product_variants.reduce((s, v) => s + v.stock, 0);
            return (
              <Link key={p.id} href={isStaff ? `/tienda/productos/${p.id}` : `/tienda/${p.id}`} className="block">
                <Card className="h-full overflow-hidden p-0 hover:bg-surface-2">
                  <div className="grid aspect-square place-items-center bg-surface-2">
                    {p.photo_path && photos.get(p.photo_path) ? (
                      <img src={photos.get(p.photo_path)} alt={p.name} className="size-full object-cover" loading="lazy" />
                    ) : (
                      <Package className="size-10 text-subtle" aria-hidden />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 font-medium leading-tight">{p.name}</p>
                    <p className="mt-1 font-mono text-sm text-accent-text">{formatMoney(p.price_cents, club.currency)}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {!p.active && <Badge>oculto</Badge>}
                      {stock === 0 && <Badge tone="danger">sin stock</Badge>}
                      {isStaff && stock > 0 && <Badge>{stock} u.</Badge>}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
