import Link from "next/link";
import { CalendarCheck, UserRoundPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, SectionTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PushToggle } from "@/components/pwa/push-toggle";
import { AnnouncementPreview } from "@/features/announcements/announcement-preview";
import { BlockList, ReferenceNote, SessionCard } from "@/features/training/session-view";
import { parseBlocks, type SessionType } from "@/features/training/blocks";
import { CompleteForm } from "@/features/training/complete-form";
import { mondayOf, todayIn } from "@/lib/domain/dates";
import type { ClubContext } from "@/lib/club";
import { getProfile } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { InstallNudge } from "./install-nudge";
import { StatusTile, icons } from "./status-cards";
import { EventCard } from "@/features/events/event-card";
import { loadEvents } from "@/features/events/data";
import { feeStatuses } from "@/features/fees/data";
import { clubHas } from "@/lib/club";
import { periodOf, FEE_STATUS_LABEL } from "@/lib/domain/fees";
import { MEDICAL_STATUS_LABEL, medicalStatus } from "@/lib/domain/medical";
import { WeekBars } from "./week-bars";

export async function RunnerHome({ ctx }: { ctx: ClubContext }) {
  const { club, membership, userId } = ctx;
  const today = todayIn(club.timezone);
  const supabase = await createClient();
  const profile = await getProfile();

  const [{ data: sessions }, { data: week }, { data: announcements }] = await Promise.all([
    supabase
      .from("training_sessions")
      .select("id, date, title, type, blocks, notes, published_at")
      .eq("club_id", club.id)
      .eq("date", today)
      .not("published_at", "is", null)
      .order("created_at"),
    supabase.rpc("my_week", { p_club: club.id, p_monday: mondayOf(today) }),
    supabase
      .from("announcements")
      .select("id, body, image_path, pinned_at, published_at, profiles(full_name)")
      .eq("club_id", club.id)
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("published_at", { ascending: false })
      .limit(3),
  ]);

  const hasFees = clubHas(club, "fees");
  const hasMedical = clubHas(club, "medical");
  const [fees, { data: cert }, events] = await Promise.all([
    hasFees ? feeStatuses(club.id, periodOf(today)) : Promise.resolve([]),
    hasMedical
      ? supabase.from("medical_certificates").select("expires_on").eq("club_id", club.id).eq("user_id", userId).order("uploaded_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    loadEvents(club.id, { upcoming: true, limit: 1 }),
  ]);
  const myFee = fees.find((f) => f.user_id === userId);
  const med = medicalStatus(cert?.expires_on, today);
  const nextEvent = events[0];

  const ids = (sessions ?? []).map((s) => s.id);
  const { data: completions } = ids.length
    ? await supabase.from("session_completions").select("session_id, feeling, comment").eq("user_id", userId).in("session_id", ids)
    : { data: [] };
  const doneBy = new Map((completions ?? []).map((c) => [c.session_id, c]));
  const reference = membership.ref_pace_s_per_km ? { secPerKm: membership.ref_pace_s_per_km, kind: membership.ref_pace_kind } : null;
  const firstName = profile?.full_name.split(" ")[0];

  return (
    <div>
      <h1 className="mb-4 font-display text-4xl font-extrabold uppercase leading-none">
        Hola{firstName ? `, ${firstName}` : ""} 👋
      </h1>

      <InstallNudge clubName={club.name} />

      {!profile?.completed_at && (
        <Link href="/perfil/completar">
          <Card className="mb-4 flex items-center gap-3 border-accent/40 hover:bg-surface-2">
            <UserRoundPen className="size-6 text-accent-text" aria-hidden />
            <p className="flex-1 text-sm">
              <b>Completá tu perfil</b> para que el coach calcule tus ritmos.
            </p>
          </Card>
        </Link>
      )}

      <SectionTitle>Plan de hoy</SectionTitle>
      {sessions && sessions.length > 0 ? (
        <div className="space-y-3">
          {sessions.map((s) => {
            const blocks = parseBlocks(s.blocks);
            const done = doneBy.get(s.id);
            return sessions.length === 1 ? (
              <div key={s.id} className="space-y-3">
                <Card>
                  <Link href={`/plan/${s.id}`}>
                    <CardTitle className="text-3xl">{s.title}</CardTitle>
                  </Link>
                  {s.notes && <p className="mt-1 text-sm text-muted">{s.notes}</p>}
                  {blocks.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <BlockList blocks={blocks} reference={reference} />
                      <ReferenceNote reference={reference} />
                    </div>
                  )}
                </Card>
                {s.type !== "rest" && <CompleteForm sessionId={s.id} done={done ? { feeling: done.feeling, comment: done.comment } : null} />}
              </div>
            ) : (
              <SessionCard key={s.id} session={{ ...s, type: s.type as SessionType }} done={!!done} />
            );
          })}
        </div>
      ) : (
        <EmptyState icon={CalendarCheck} title="Hoy no hay plan" description="Aprovechá para descansar o mirá lo que viene en la semana." action={<Button asChild variant="secondary"><Link href="/plan">Ver la semana</Link></Button>} />
      )}

      {(myFee || hasMedical) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {myFee && (
            <StatusTile
              href="/cuota"
              icon={icons.Wallet}
              label="Cuota"
              value={FEE_STATUS_LABEL[myFee.status]}
              tone={myFee.status === "paid" ? "success" : myFee.status === "pending" ? "warning" : "danger"}
            />
          )}
          {hasMedical && (
            <StatusTile
              href="/apto"
              icon={icons.HeartPulse}
              label="Apto médico"
              value={MEDICAL_STATUS_LABEL[med]}
              tone={med === "valid" ? "success" : med === "expiring" ? "warning" : med === "expired" ? "danger" : "neutral"}
            />
          )}
        </div>
      )}

      <SectionTitle>Tu semana</SectionTitle>
      <Card>
        <WeekBars days={(week ?? []).map((d) => ({ day: d.day, planned: d.planned, completed: d.completed }))} today={today} />
      </Card>

      {nextEvent && (
        <>
          <SectionTitle>Próximo evento</SectionTitle>
          <EventCard event={nextEvent} tz={club.timezone} today={today} userId={userId} />
        </>
      )}

      <SectionTitle>Últimos avisos</SectionTitle>
      {announcements && announcements.length > 0 ? (
        <div className="space-y-2">
          {announcements.map((a) => (
            <AnnouncementPreview key={a.id} a={a} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-subtle">Todavía no hay avisos.</p>
      )}

      <div className="mt-6">
        <PushToggle clubId={club.id} compact />
      </div>
    </div>
  );
}
