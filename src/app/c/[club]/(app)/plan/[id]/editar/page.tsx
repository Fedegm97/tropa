import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { SessionBuilder } from "@/features/training/session-builder";
import { builderOptions } from "@/features/training/builder-data";
import { parseBlocks, type SessionType } from "@/features/training/blocks";
import { requireStaff } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Editar sesión" };

export default async function EditSessionPage({ params }: PageProps<"/c/[club]/plan/[id]/editar">) {
  const { club: slug, id } = await params;
  const { club } = await requireStaff(slug);
  const supabase = await createClient();
  const [{ data: s }, { data: targets }, options] = await Promise.all([
    supabase.from("training_sessions").select("*").eq("id", id).eq("club_id", club.id).maybeSingle(),
    supabase.from("training_session_targets").select("user_id").eq("session_id", id),
    builderOptions(club.id),
  ]);
  if (!s) notFound();

  return (
    <div>
      <PageHeader title="Editar sesión" back={`/plan/${id}`} />
      <SessionBuilder
        {...options}
        onDoneHref={`/plan/${id}`}
        initial={{
          id: s.id,
          date: s.date,
          title: s.title,
          type: s.type as SessionType,
          blocks: parseBlocks(s.blocks),
          notes: s.notes ?? "",
          audience: s.audience,
          shiftId: s.shift_id,
          runnerIds: (targets ?? []).map((t) => t.user_id),
        }}
      />
    </div>
  );
}
