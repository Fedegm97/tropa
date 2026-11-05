import Link from "next/link";
import { Cake, CalendarPlus, CheckCircle2, Circle, MessageSquareText, Megaphone } from "lucide-react";
import { Avatar } from "@/components/brand/club-badge";
import { Button } from "@/components/ui/button";
import { Card, SectionTitle, Stat } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SessionCard } from "@/features/training/session-view";
import type { SessionType } from "@/features/training/blocks";
import { addDays, mondayOf, todayIn } from "@/lib/domain/dates";
import { PLANS, effectivePlan, type PlanCode } from "@/lib/domain/plans";
import type { ClubContext } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";
import { formatDistanceToNow } from "date-fns";
import { StatusTile, icons } from "./status-cards";
import { feeStatuses } from "@/features/fees/data";
import { loadEvents } from "@/features/events/data";
import { eventWhen } from "@/features/events/event-card";
import { clubHas } from "@/lib/club";
import { periodOf, summarizeFees } from "@/lib/domain/fees";
import { es } from "date-fns/locale";

const FEELING = ["", "😫", "😓", "🙂", "😄", "🚀"];

export async function CoachHome({ ctx }: { ctx: ClubContext }) {
  const { club, isOwner } = ctx;
  const today = todayIn(club.timezone);
  const monday = mondayOf(today);
  const supabase = await createClient();

  const [{ data: members }, { data: todaySessions }, { count: weekDone }, { data: comments }] = await Promise.all([
    supabase.from("memberships").select("user_id, role, profiles(full_name, avatar_path)").eq("club_id", club.id).eq("status", "active"),
    supabase.from("training_sessions").select("id, date, title, type, blocks, published_at, audience").eq("club_id", club.id).eq("date", today).order("created_at"),
    supabase
      .from("session_completions")
      .select("session_id", { count: "exact", head: true })
      .eq("club_id", club.id)
      .gte("completed_at", `${monday}T00:00:00`)
      .lt("completed_at", `${addDays(monday, 7)}T00:00:00`),
    supabase
      .from("session_completions")
      .select("comment, feeling, completed_at, user_id, training_sessions(title), profiles(full_name, avatar_path)")
      .eq("club_id", club.id)
      .not("comment", "is", null)
      .order("completed_at", { ascending: false })
      .limit(4),
  ]);

  const runners = (members ?? []).filter((m) => m.role === "runner");
  const ids = (todaySessions ?? []).map((s) => s.id);
  const { data: todayDone } = ids.length
    ? await supabase.from("session_completions").select("session_id").in("session_id", ids)
    : { data: [] as { session_id: string }[] };
  const doneCount = (id: string) => (todayDone ?? []).filter((c) => c.session_id === id).length;

  // Cumpleaños del día (el staff puede leer profile_private de su club)
  const { data: birthdays } = await supabase
    .from("profile_private")
    .select("user_id, birth_date")
    .in("user_id", (members ?? []).map((m) => m.user_id))
    .not("birth_date", "is", null);
  const mmdd = today.slice(5);
  const todaysBirthdays = (birthdays ?? [])
    .filter((b) => b.birth_date!.slice(5) === mmdd)
    .map((b) => members!.find((m) => m.user_id === b.user_id)?.profiles?.full_name)
    .filter(Boolean);

  const hasFees = clubHas(club, "fees");
  const hasMedical = clubHas(club, "medical");
  const [fees, medical, events, { count: pendingPayments }] = await Promise.all([
    hasFees ? feeStatuses(club.id, periodOf(today)) : Promise.resolve([]),
    hasMedical ? supabase.rpc("club_medical_statuses", { p_club: club.id }).then((r) => r.data ?? []) : Promise.resolve([]),
    loadEvents(club.id, { upcoming: true, limit: 1 }),
    hasFees
      ? supabase.from("fee_payments").select("id", { count: "exact", head: true }).eq("club_id", club.id).eq("status", "pending")
      : Promise.resolve({ count: 0 }),
  ]);
  const feeSummary = summarizeFees(fees.map((f) => f.status));
  const medExpired = medical.filter((m) => m.status === "expired").length;
  const medExpiring = medical.filter((m) => m.status === "expiring").length;
  const nextEvent = events[0];

  const plan = PLANS[effectivePlan({ planCode: club.plan_code as PlanCode, planStatus: club.plan_status, trialEndsAt: club.trial_ends_at, planOverride: club.plan_override })];
  const nearLimit = plan.maxRunners !== null && runners.length >= plan.maxRunners * 0.8;

  return (
    <div>
      <h1 className="mb-4 font-display text-4xl font-extrabold uppercase leading-none">Panel del coach</h1>

      {isOwner && club.onboarding_step < 4 && (
        <Card className="mb-4 border-accent/40">
          <p className="mb-2 font-display text-xl font-bold uppercase">Terminá de armar tu club</p>
          <ul className="space-y-1 text-sm">
            {[
              { step: 2, label: "Invitá a tus corredores", href: "/onboarding/invitar" },
              { step: 3, label: "Creá tu primer plan", href: "/onboarding/primer-plan" },
            ].map((s) => (
              <li key={s.step}>
                <Link href={s.href} className="flex min-h-11 items-center gap-2">
                  {club.onboarding_step > s.step ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-subtle" />}
                  <span className={club.onboarding_step > s.step ? "text-subtle line-through" : ""}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Corredores activos"
          value={runners.length}
          sub={plan.maxRunners ? <span className={nearLimit ? "text-warning" : ""}>de {plan.maxRunners} en plan {plan.name}</span> : `Plan ${plan.name}`}
        />
        <Stat label="Completadas" value={weekDone ?? 0} sub="sesiones esta semana" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button asChild size="lg">
          <Link href={`/plan/nueva?fecha=${today}`}>
            <CalendarPlus /> Crear plan
          </Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/avisos#nuevo">
            <Megaphone /> Publicar aviso
          </Link>
        </Button>
      </div>

      {(hasFees || hasMedical || nextEvent) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {hasFees && (
            <StatusTile
              href="/cuotas"
              icon={icons.Wallet}
              label="Cuotas del mes"
              value={`${feeSummary.paid} de ${feeSummary.total}`}
              sub={pendingPayments ? `${pendingPayments} para confirmar` : "al día"}
              tone={pendingPayments ? "warning" : "neutral"}
            />
          )}
          {hasMedical && (
            <StatusTile
              href="/aptos"
              icon={icons.HeartPulse}
              label="Aptos"
              value={medExpired + medExpiring > 0 ? `${medExpired} vencidos` : "Todo en orden"}
              sub={medExpiring ? `${medExpiring} por vencer` : undefined}
              tone={medExpired ? "danger" : medExpiring ? "warning" : "success"}
            />
          )}
          {nextEvent && (
            <StatusTile
              href={`/eventos/${nextEvent.id}`}
              icon={icons.CalendarHeart}
              label="Próximo evento"
              value={nextEvent.name}
              sub={`${eventWhen(nextEvent.starts_at, club.timezone)} · ${nextEvent.event_registrations.length} van`}
            />
          )}
        </div>
      )}

      {todaysBirthdays.length > 0 && (
        <Card className="mt-4 flex items-center gap-3">
          <Cake className="size-7 text-accent-text" aria-hidden />
          <p className="text-sm">
            Hoy cumple{todaysBirthdays.length > 1 ? "n" : ""} <b>{todaysBirthdays.join(", ")}</b> 🎉
          </p>
        </Card>
      )}

      <SectionTitle>Hoy</SectionTitle>
      {todaySessions && todaySessions.length > 0 ? (
        <div className="space-y-2">
          {todaySessions.map((s) => (
            <SessionCard
              key={s.id}
              session={{ ...s, type: s.type as SessionType }}
              extra={<p className="mt-1 font-mono text-xs text-accent-text">{doneCount(s.id)} completaron</p>}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={CalendarPlus} title="Nada para hoy" description="Creá una sesión y le llega a tus corredores al instante." />
      )}

      <SectionTitle>Últimos comentarios</SectionTitle>
      {comments && comments.length > 0 ? (
        <div className="space-y-2">
          {comments.map((c, i) => (
            <Card key={i} className="flex gap-3">
              <Avatar name={c.profiles?.full_name ?? "?"} path={c.profiles?.avatar_path} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <b>{c.profiles?.full_name}</b> <span className="text-subtle">en {c.training_sessions?.title}</span> {c.feeling ? FEELING[c.feeling] : ""}
                </p>
                <p className="text-sm text-muted">“{c.comment}”</p>
                <p className="font-mono text-[11px] text-subtle">{formatDistanceToNow(new Date(c.completed_at), { locale: es, addSuffix: true })}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-subtle">
          <MessageSquareText className="size-4" /> Cuando tus corredores comenten sus sesiones, aparecen acá.
        </p>
      )}
    </div>
  );
}
