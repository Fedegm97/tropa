import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { Avatar } from "@/components/brand/club-badge";
import { Button } from "@/components/ui/button";
import { Badge, Card, SectionTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shell/page-header";
import { BlockList, ReferenceNote, totalsLabel } from "@/features/training/session-view";
import { CompleteForm } from "@/features/training/complete-form";
import { SessionStaffActions } from "@/features/training/staff-actions";
import { SESSION_TYPES, parseBlocks, type SessionType } from "@/features/training/blocks";
import { shortDate } from "@/lib/domain/dates";
import { requireClub } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";

const FEELING = ["", "😫", "😓", "🙂", "😄", "🚀"];

export default async function SessionPage({ params }: PageProps<"/c/[club]/plan/[id]">) {
  const { club: slug, id } = await params;
  const { club, isStaff, membership, userId } = await requireClub(slug, `/plan/${id}`);
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("training_sessions")
    .select("*, shifts(name)")
    .eq("id", id)
    .eq("club_id", club.id)
    .maybeSingle();
  if (!s) notFound();

  const blocks = parseBlocks(s.blocks);
  const type = SESSION_TYPES[s.type as SessionType];
  const header = (
    <>
      <PageHeader
        title={s.title}
        back={`/plan?semana=${s.date}`}
        subtitle={
          <span className="font-mono">
            {type.emoji} {type.label} · {shortDate(s.date)}
            {blocks.length > 0 && ` · ${totalsLabel(blocks)}`}
          </span>
        }
        action={
          isStaff ? (
            <Button asChild variant="secondary" size="icon" aria-label="Editar sesión">
              <Link href={`/plan/${id}/editar`}>
                <Pencil />
              </Link>
            </Button>
          ) : undefined
        }
      />
      {s.notes && <Card className="mb-3 whitespace-pre-line text-sm text-muted">{s.notes}</Card>}
    </>
  );

  if (!isStaff) {
    const reference = membership.ref_pace_s_per_km ? { secPerKm: membership.ref_pace_s_per_km, kind: membership.ref_pace_kind } : null;
    const { data: done } = await supabase.from("session_completions").select("feeling, comment").eq("session_id", id).eq("user_id", userId).maybeSingle();
    return (
      <div className="space-y-3">
        {header}
        {blocks.length > 0 && (
          <>
            <BlockList blocks={blocks} reference={reference} />
            <ReferenceNote reference={reference} />
          </>
        )}
        {s.type !== "rest" && <CompleteForm sessionId={id} done={done} />}
      </div>
    );
  }

  // Vista del coach: quién completó
  const [{ data: completions }, { data: members }, { data: targets }] = await Promise.all([
    supabase.from("session_completions").select("user_id, feeling, comment, completed_at").eq("session_id", id),
    supabase.from("memberships").select("user_id, shift_id, profiles(full_name, avatar_path)").eq("club_id", club.id).eq("status", "active").eq("role", "runner"),
    supabase.from("training_session_targets").select("user_id").eq("session_id", id),
  ]);
  const expected = (members ?? []).filter((m) =>
    s.audience === "club" ? true : s.audience === "shift" ? m.shift_id === s.shift_id : (targets ?? []).some((t) => t.user_id === m.user_id),
  );
  const doneMap = new Map((completions ?? []).map((c) => [c.user_id, c]));
  const doneList = expected.filter((m) => doneMap.has(m.user_id));
  const pendingList = expected.filter((m) => !doneMap.has(m.user_id));

  return (
    <div>
      {header}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!s.published_at && <Badge tone="warning">borrador</Badge>}
        <Badge>{s.audience === "club" ? "Todo el club" : s.audience === "shift" ? `Turno ${s.shifts?.name}` : `${targets?.length ?? 0} corredores`}</Badge>
      </div>
      {blocks.length > 0 && (
        <>
          <BlockList blocks={blocks} reference={{ secPerKm: 300, kind: "threshold" }} />
          <p className="mt-2 font-mono text-xs text-subtle">Ritmos de ejemplo para un umbral de 5:00/km. Cada corredor ve los suyos.</p>
        </>
      )}

      <SectionTitle className="mt-6">
        Completaron · {doneList.length} de {expected.length}
      </SectionTitle>
      <div className="space-y-2">
        {doneList.map((m) => {
          const c = doneMap.get(m.user_id)!;
          return (
            <Card key={m.user_id} className="flex items-start gap-3 p-3">
              <Avatar name={m.profiles?.full_name ?? "?"} path={m.profiles?.avatar_path} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {m.profiles?.full_name} {c.feeling ? <span aria-label={`Sensación ${c.feeling} de 5`}>{FEELING[c.feeling]}</span> : null}
                </p>
                {c.comment && <p className="text-sm text-muted">“{c.comment}”</p>}
              </div>
            </Card>
          );
        })}
        {doneList.length === 0 && <p className="text-sm text-subtle">Todavía nadie la marcó como hecha.</p>}
      </div>
      {pendingList.length > 0 && (
        <>
          <SectionTitle>Pendientes · {pendingList.length}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {pendingList.map((m) => (
              <span key={m.user_id} className="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-sm text-muted">
                <Avatar name={m.profiles?.full_name ?? "?"} path={m.profiles?.avatar_path} size={26} />
                {m.profiles?.full_name}
              </span>
            ))}
          </div>
        </>
      )}
      <div className="mt-6">
        <SessionStaffActions id={id} published={!!s.published_at} />
      </div>
    </div>
  );
}
