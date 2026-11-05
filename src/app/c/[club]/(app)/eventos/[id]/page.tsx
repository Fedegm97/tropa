import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MapPin, Pencil } from "lucide-react";
import { Avatar } from "@/components/brand/club-badge";
import { Button } from "@/components/ui/button";
import { Badge, Card, SectionTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/page-header";
import { RegisterControl } from "@/features/events/register-control";
import { eventWhen } from "@/features/events/event-card";
import { loadEvents } from "@/features/events/data";
import { requireClub } from "@/lib/club";
import { todayIn, utcToZoned } from "@/lib/domain/dates";
import { EVENT_KINDS, countdownLabel, type EventKind } from "@/lib/domain/events";
import { formatMoney } from "@/lib/domain/money";

export default async function EventPage({ params }: PageProps<"/c/[club]/eventos/[id]">) {
  const { club: slug, id } = await params;
  const { club, isStaff, userId } = await requireClub(slug, `/eventos/${id}`);
  const [event] = await loadEvents(club.id, { id });
  if (!event) notFound();
  const today = todayIn(club.timezone);
  const date = utcToZoned(event.starts_at, club.timezone).date;
  const kind = EVENT_KINDS[event.kind as EventKind];
  const mine = event.event_registrations.find((r) => r.user_id === userId) ?? null;
  const past = date < today;
  const groups = event.distances.length > 0 ? event.distances : [null];

  return (
    <div>
      <PageHeader
        title={event.name}
        back="/eventos"
        action={
          isStaff ? (
            <Button asChild variant="secondary" size="icon" aria-label="Editar evento">
              <Link href={`/eventos/${id}/editar`}>
                <Pencil />
              </Link>
            </Button>
          ) : undefined
        }
      />
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge>
            {kind.emoji} {kind.label}
          </Badge>
          <span className="font-display text-xl font-bold uppercase text-accent-text">{countdownLabel(today, date)}</span>
        </div>
        <p className="font-mono text-sm">{eventWhen(event.starts_at, club.timezone)}</p>
        {event.location && (
          <p className="flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-4" aria-hidden /> {event.location}
          </p>
        )}
        {event.price_cents !== null && <p className="text-sm text-muted">Inscripción: {formatMoney(event.price_cents, club.currency)}</p>}
        {event.notes && <p className="whitespace-pre-line pt-1 text-sm">{event.notes}</p>}
        {event.registration_url && (
          <Button asChild variant="outline" block className="mt-2">
            <a href={event.registration_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Inscripción oficial
            </a>
          </Button>
        )}
      </Card>

      {!past && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-muted">{mine ? "Estás anotado. Podés cambiar la distancia o bajarte." : "Avisale al club que vas:"}</p>
          <RegisterControl eventId={event.id} distances={event.distances} mine={mine} past={past} />
        </div>
      )}

      <SectionTitle className="mt-6">Van · {event.event_registrations.length}</SectionTitle>
      {groups.map((g) => {
        const people = event.event_registrations.filter((r) => (g ? r.distance === g : true));
        if (people.length === 0) return null;
        return (
          <div key={g ?? "all"} className="mb-4">
            {g && <p className="mb-2 font-mono text-xs text-accent-text">{g} · {people.length}</p>}
            <div className="flex flex-wrap gap-2">
              {people.map((r) => (
                <span key={r.user_id} className="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-sm">
                  <Avatar name={r.profiles?.full_name ?? "?"} path={r.profiles?.avatar_path} size={26} />
                  {r.profiles?.full_name}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      {event.event_registrations.length === 0 && <p className="text-sm text-subtle">Todavía nadie se anotó.</p>}
    </div>
  );
}
