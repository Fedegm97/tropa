import { PageHeader } from "@/components/shell/page-header";
import { ShiftForm } from "@/features/shifts/shift-form";
import { shiftFormOptions } from "@/features/shifts/data";
import { requireStaff } from "@/lib/club";

export const metadata = { title: "Nuevo turno" };

export default async function NewShiftPage({ params }: PageProps<"/c/[club]/turnos/nuevo">) {
  const { club: slug } = await params;
  const { club } = await requireStaff(slug, "/turnos/nuevo");
  const options = await shiftFormOptions(club.id);
  return (
    <div>
      <PageHeader title="Nuevo turno" back="/turnos" />
      <ShiftForm {...options} />
    </div>
  );
}
