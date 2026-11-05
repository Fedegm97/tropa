import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { ShiftForm } from "@/features/shifts/shift-form";
import { shiftFormOptions } from "@/features/shifts/data";
import { requireStaff } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Editar turno" };

export default async function EditShiftPage({ params }: PageProps<"/c/[club]/turnos/[id]">) {
  const { club: slug, id } = await params;
  const { club } = await requireStaff(slug);
  const supabase = await createClient();
  const { data: s } = await supabase.from("shifts").select("*").eq("id", id).eq("club_id", club.id).maybeSingle();
  if (!s) notFound();
  const options = await shiftFormOptions(club.id);
  return (
    <div>
      <PageHeader title={s.name} back="/turnos" />
      <ShiftForm
        {...options}
        initial={{
          id: s.id,
          name: s.name,
          days: s.days,
          startsAt: s.starts_at,
          endsAt: s.ends_at,
          location: s.location ?? "",
          coachUserId: s.coach_user_id,
          runnerIds: options.runners.filter((r) => r.shiftId === s.id).map((r) => r.id),
        }}
      />
    </div>
  );
}
