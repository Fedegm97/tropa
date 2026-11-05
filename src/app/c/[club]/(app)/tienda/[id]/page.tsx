import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { OrderForm } from "@/features/store/order-form";
import { signedUrls } from "@/features/fees/data";
import { clubHas, requireClub } from "@/lib/club";
import { formatMoney } from "@/lib/domain/money";
import { createClient } from "@/lib/supabase/server";

export default async function ProductPage({ params }: PageProps<"/c/[club]/tienda/[id]">) {
  const { club: slug, id } = await params;
  const { club } = await requireClub(slug, `/tienda/${id}`);
  if (!clubHas(club, "store")) notFound();
  const supabase = await createClient();
  const { data: p } = await supabase.from("products").select("*, product_variants(id, size, stock, sort)").eq("id", id).eq("club_id", club.id).maybeSingle();
  if (!p) notFound();
  const photo = (await signedUrls([p.photo_path])).get(p.photo_path ?? "");
  const variants = [...p.product_variants].sort((a, b) => a.sort - b.sort);
  return (
    <div>
      <PageHeader title={p.name} back="/tienda" />
      <div className="mb-4 grid aspect-square place-items-center overflow-hidden rounded-card bg-surface">
        {photo ? <img src={photo} alt={p.name} className="size-full object-cover" /> : <Package className="size-14 text-subtle" aria-hidden />}
      </div>
      <p className="font-display text-3xl font-extrabold">{formatMoney(p.price_cents, club.currency)}</p>
      {p.description && <p className="mt-2 whitespace-pre-line text-muted">{p.description}</p>}
      <div className="mt-4">
        <OrderForm variants={variants} priceCents={p.price_cents} currency={club.currency} />
      </div>
    </div>
  );
}
