import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPace, thresholdPace, type ReferencePace } from "@/lib/domain/pace";
import { BLOCK_LABELS, SESSION_TYPES, blockPace, blockSummary, formatAmount, parseBlocks, sessionTotals, type Block, type SessionType } from "./blocks";

export type SessionLite = {
  id: string;
  date: string;
  title: string;
  type: SessionType;
  blocks: unknown;
  published_at: string | null;
};

export function totalsLabel(blocks: Block[]) {
  const { meters, seconds } = sessionTotals(blocks);
  const parts = [];
  if (meters) parts.push(formatAmount({ unit: "m", value: meters }));
  if (seconds) parts.push(formatAmount({ unit: "s", value: seconds }));
  return parts.join(" + ");
}

/** Tarjeta compacta de una sesión (lista semanal, home). */
export function SessionCard({ session, done, extra, href }: { session: SessionLite; done?: boolean; extra?: React.ReactNode; href?: string }) {
  const blocks = parseBlocks(session.blocks);
  const t = SESSION_TYPES[session.type];
  return (
    <Link href={href ?? `/plan/${session.id}`} className="block">
      <Card className={cn("flex items-center gap-3 transition hover:bg-surface-2", done && "border-success/40")}>
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface-2 text-xl" aria-hidden>
          {t.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-display text-lg font-bold uppercase leading-tight">{session.title}</p>
            {!session.published_at && <Badge tone="warning">borrador</Badge>}
          </div>
          <p className="truncate font-mono text-xs text-muted">
            {t.label}
            {blocks.length > 0 && ` · ${totalsLabel(blocks)}`}
          </p>
          {extra}
        </div>
        {done ? <CheckCircle2 className="size-6 shrink-0 text-success" aria-label="Completada" /> : <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />}
      </Card>
    </Link>
  );
}

/** Bloques con el ritmo calculado para el corredor. */
export function BlockList({ blocks, reference }: { blocks: Block[]; reference: ReferencePace | null }) {
  return (
    <ol className="space-y-2">
      {blocks.map((b, i) => {
        const { pace, target } = blockPace(b, reference);
        return (
          <li key={i} className="flex gap-3 rounded-2xl bg-surface p-4">
            <span className="mt-0.5 font-mono text-xs text-subtle">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{BLOCK_LABELS[b.kind]}</p>
              <p className="font-display text-xl font-bold uppercase leading-tight">{blockSummary(b)}</p>
              <p className="mt-1 font-mono text-sm">
                {pace ? <span className="text-accent-text">{pace}</span> : null}
                <span className="text-subtle">{pace ? " · " : ""}{target}</span>
              </p>
              {b.note && <p className="mt-1 text-sm text-muted">{b.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ReferenceNote({ reference }: { reference: ReferencePace | null }) {
  if (!reference) {
    return (
      <p className="rounded-2xl bg-warning/10 p-3 text-sm text-warning">
        Cargá tu ritmo de referencia en <Link href="/perfil" className="underline">tu perfil</Link> para ver los ritmos calculados para vos.
      </p>
    );
  }
  return (
    <p className="font-mono text-xs text-subtle">
      Ritmos calculados con tu {reference.kind === "5k" ? "ritmo de 5K" : "umbral"} ({formatPace(reference.secPerKm)}/km
      {reference.kind === "5k" ? ` → umbral ${formatPace(thresholdPace(reference))}/km` : ""}).
    </p>
  );
}
