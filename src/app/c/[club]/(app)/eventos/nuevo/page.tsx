import { PageHeader } from "@/components/shell/page-header";
import { EventForm } from "@/features/events/event-form";
import { requireStaff } from "@/lib/club";
import { addDays, todayIn } from "@/lib/domain/dates";

export const metadata = { title: "Nuevo evento" };

export default async function NewEventPage({ params }: PageProps<"/c/[club]/eventos/nuevo">) {
  const { club: slug } = await params;
  const { club } = await requireStaff(slug, "/eventos/nuevo");
  return (
    <div>
      <PageHeader title="Nuevo evento" back="/eventos" />
      <EventForm initial={{ name: "", kind: "road", date: addDays(todayIn(club.timezone), 14), time: "08:00", distances: "" }} />
    </div>
  );
}
