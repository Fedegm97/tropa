import Link from "next/link";
import { MapPin } from "lucide-react";
import { AvatarStack } from "@/components/brand/club-badge";
import { Badge, Card } from "@/components/ui/card";
import { utcToZoned } from "@/lib/domain/dates";
import { EVENT_KINDS, countdownLabel, type EventKind } from "@/lib/domain/events";
import type { EventWithPeople } from "./data";

export function eventWhen(startsAt: string, tz: string) {
  const d = new Date(startsAt);
  const day = d.toLocaleDateString("es-AR", { timeZone: tz, weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("es-AR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${day} · ${time} h`;
}

export function EventCard({ event, tz, today, userId }: { event: EventWithPeople; tz: string; today: string; userId: string }) {
  const kind = EVENT_KINDS[event.kind as EventKind];
  const people = event.event_registrations.map((r) => ({ name: r.profiles?.full_name ?? "?", path: r.profiles?.avatar_path }));
  const mine = event.event_registrations.find((r) => r.user_id === userId);
  const date = utcToZoned(event.starts_at, tz).date;
  return (
    <Link href={`/eventos/${event.id}`} className="block">
      <Card className="hover:bg-surface-2">
        <div className="flex items-start justify-between gap-2">
          <Badge>
            {kind.emoji} {kind.label}
          </Badge>
          <span className="font-mono text-xs text-accent-text">{countdownLabel(today, date)}</span>
        </div>
        <p className="mt-2 font-display text-2xl font-bold uppercase leading-tight">{event.name}</p>
        <p className="font-mono text-xs text-muted">{eventWhen(event.starts_at, tz)}</p>
        {event.location && (
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5" aria-hidden /> {event.location}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          {people.length > 0 ? <AvatarStack people={people} max={5} /> : <span className="text-sm text-subtle">Sé el primero en anotarte</span>}
          {mine && <Badge tone="success">Vas{mine.distance ? ` · ${mine.distance}` : ""}</Badge>}
        </div>
      </Card>
    </Link>
  );
}
