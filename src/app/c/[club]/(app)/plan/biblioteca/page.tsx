import Link from "next/link";
import { Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { DeleteTemplateButton } from "@/features/training/staff-actions";
import { totalsLabel } from "@/features/training/session-view";
import { SESSION_TYPES, parseBlocks, type SessionType } from "@/features/training/blocks";
import { requireStaff } from "@/lib/club";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Biblioteca" };

export default async function LibraryPage({ params }: PageProps<"/c/[club]/plan/biblioteca">) {
  const { club: slug } = await params;
  const { club } = await requireStaff(slug, "/plan/biblioteca");
  const supabase = await createClient();
  const { data: templates } = await supabase.from("session_templates").select("*").eq("club_id", club.id).order("title");

  return (
    <div>
      <PageHeader title="Biblioteca" back="/plan" subtitle="Sesiones guardadas para reutilizar" />
      {!templates || templates.length === 0 ? (
        <EmptyState
          icon={Library}
          title="Biblioteca vacía"
          description="Al crear una sesión, tildá “Guardar también en la biblioteca” para reutilizarla."
          action={
            <Button asChild>
              <Link href="/plan/nueva">Crear sesión</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {templates.map((t) => {
            const type = SESSION_TYPES[t.type as SessionType];
            const blocks = parseBlocks(t.blocks);
            return (
              <Card key={t.id} className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-xl" aria-hidden>
                  {type.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold uppercase">{t.title}</p>
                  <p className="truncate font-mono text-xs text-muted">
                    {type.label}
                    {blocks.length > 0 && ` · ${totalsLabel(blocks)}`}
                  </p>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/plan/nueva?plantilla=${t.id}`}>Usar</Link>
                </Button>
                <DeleteTemplateButton id={t.id} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
