import { PageHeader } from "@/components/shell/page-header";
import { LockedFeature } from "@/components/ui/locked-feature";
import { ProductForm } from "@/features/store/product-form";
import { clubHas, requireStaff } from "@/lib/club";

export const metadata = { title: "Nuevo producto" };

export default async function NewProductPage({ params }: PageProps<"/c/[club]/tienda/productos/nuevo">) {
  const { club: slug } = await params;
  const { club } = await requireStaff(slug, "/tienda/productos/nuevo");
  return (
    <div>
      <PageHeader title="Nuevo producto" back="/tienda" />
      {clubHas(club, "store") ? <ProductForm clubId={club.id} /> : <LockedFeature feature="store" title="Tienda del club" isStaff />}
    </div>
  );
}
