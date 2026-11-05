import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { ProductForm } from "@/features/store/product-form";
import { signedUrls } from "@/features/fees/data";
import { requireStaff } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Editar producto" };

export default async function EditProductPage({ params }: PageProps<"/c/[club]/tienda/productos/[id]">) {
  const { club: slug, id } = await params;
  const { club } = await requireStaff(slug);
  const supabase = await createClient();
  const { data: p } = await supabase.from("products").select("*, product_variants(id, size, stock, sort)").eq("id", id).eq("club_id", club.id).maybeSingle();
  if (!p) notFound();
  const photo = (await signedUrls([p.photo_path])).get(p.photo_path ?? "") ?? null;
  return (
    <div>
      <PageHeader title="Editar producto" back="/tienda" />
      <ProductForm
        clubId={club.id}
        photoUrl={photo}
        initial={{
          id: p.id,
          name: p.name,
          description: p.description ?? "",
          price: String(p.price_cents / 100).replace(".", ","),
          active: p.active,
          photoPath: p.photo_path,
          variants: [...p.product_variants].sort((a, b) => a.sort - b.sort).map((v) => ({ id: v.id, size: v.size, stock: v.stock })),
        }}
      />
    </div>
  );
}
