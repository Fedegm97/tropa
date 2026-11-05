import { PageHeader } from "@/components/shell/page-header";
import { SessionBuilder } from "@/features/training/session-builder";
import { builderOptions } from "@/features/training/builder-data";
import { parseBlocks, type SessionType } from "@/features/training/blocks";
import { requireStaff } from "@/lib/club";
import { todayIn } from "@/lib/domain/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Nueva sesión" };

export default async function NewSessionPage({ params, searchParams }: PageProps<"/c/[club]/plan/nueva">) {
  const [{ club: slug }, sp] = await Promise.all([params, searchParams]);
  const { club } = await requireStaff(slug, "/plan/nueva");
  const options = await builderOptions(club.id);
  const date = typeof sp.fecha === "string" ? sp.fecha : todayIn(club.timezone);

  const initial = { date };
  if (typeof sp.plantilla === "string") {
    const supabase = await createClient();
    const { data: t } = await supabase.from("session_templates").select("*").eq("id", sp.plantilla).eq("club_id", club.id).maybeSingle();
    if (t) Object.assign(initial, { title: t.title, type: t.type as SessionType, blocks: parseBlocks(t.blocks), notes: t.notes ?? "" });
  }

  return (
    <div>
      <PageHeader title="Nueva sesión" back="/plan" />
      <SessionBuilder initial={initial} {...options} showPresets={typeof sp.plantilla !== "string"} />
    </div>
  );
}
