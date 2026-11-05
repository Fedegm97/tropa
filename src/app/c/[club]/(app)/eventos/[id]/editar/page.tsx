import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { EventForm } from "@/features/events/event-form";
import { requireStaff } from "@/lib/club";
import { utcToZoned } from "@/lib/domain/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Editar evento" };

export default async function EditEventPage({ params }: PageProps<"/c/[club]/eventos/[id]/editar">) {
  const { club: slug, id } = await params;
  const { club } = await requireStaff(slug);
  const supabase = await createClient();
  const { data: e } = await supabase.from("events").select("*").eq("id", id).eq("club_id", club.id).maybeSingle();
  if (!e) notFound();
  const { date, time } = utcToZoned(e.starts_at, club.timezone);
  return (
    <div>
      <PageHeader title="Editar evento" back={`/eventos/${id}`} />
      <EventForm
        initial={{
          id: e.id,
          name: e.name,
          kind: e.kind,
          date,
          time,
          location: e.location ?? "",
          distances: e.distances.join(", "),
          registrationUrl: e.registration_url ?? "",
          price: e.price_cents !== null ? String(e.price_cents / 100).replace(".", ",") : "",
          notes: e.notes ?? "",
        }}
      />
    </div>
  );
}
