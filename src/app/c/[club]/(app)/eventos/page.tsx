import Link from "next/link";
import { CalendarHeart, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { EventCard } from "@/features/events/event-card";
import { loadEvents } from "@/features/events/data";
import { requireClub } from "@/lib/club";
import { todayIn } from "@/lib/domain/dates";

export const metadata = { title: "Eventos" };

export default async function EventsPage({ params }: PageProps<"/c/[club]/eventos">) {
  const { club: slug } = await params;
  const { club, isStaff, userId } = await requireClub(slug, "/eventos");
  const today = todayIn(club.timezone);
  const [upcoming, past] = await Promise.all([loadEvents(club.id, { upcoming: true }), loadEvents(club.id, { upcoming: false, limit: 6 })]);

  return (
    <div>
      <PageHeader
        title="Eventos"
        action={
          isStaff ? (
            <Button asChild size="sm">
              <Link href="/eventos/nuevo">
                <Plus /> Nuevo
              </Link>
            </Button>
          ) : undefined
        }
      />
      {upcoming.length === 0 ? (
        <EmptyState
          icon={CalendarHeart}
          title="Sin eventos próximos"
          description={isStaff ? "Cargá carreras, salidas especiales o viajes y tus corredores se anotan desde la app." : "Cuando el club organice una carrera o salida, aparece acá."}
          action={
            isStaff ? (
              <Button asChild>
                <Link href="/eventos/nuevo">Crear evento</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {upcoming.map((e) => (
            <EventCard key={e.id} event={e} tz={club.timezone} today={today} userId={userId} />
          ))}
        </div>
      )}
      {past.length > 0 && (
        <>
          <SectionTitle className="mt-8">Anteriores</SectionTitle>
          <div className="space-y-3 opacity-70">
            {past.map((e) => (
              <EventCard key={e.id} event={e} tz={club.timezone} today={today} userId={userId} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
