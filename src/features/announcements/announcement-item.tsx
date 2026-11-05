"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pin, PinOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Avatar } from "@/components/brand/club-badge";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { deleteAnnouncement, togglePin, toggleReaction } from "./actions";
import { REACTIONS } from "./reactions";

export type AnnouncementItemData = {
  id: string;
  body: string;
  imageUrl: string | null;
  pinned: boolean;
  publishedAt: string;
  author: { name: string; avatar: string | null };
  shiftName: string | null;
  views: number;
  reactions: Record<string, number>;
  mine: string[];
};

export function AnnouncementItem({ a, isStaff }: { a: AnnouncementItemData; isStaff: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setOptimistic] = useOptimistic({ reactions: a.reactions, mine: a.mine }, (s, { emoji, on }: { emoji: string; on: boolean }) => ({
    reactions: { ...s.reactions, [emoji]: Math.max(0, (s.reactions[emoji] ?? 0) + (on ? 1 : -1)) },
    mine: on ? [...s.mine, emoji] : s.mine.filter((e) => e !== emoji),
  }));

  function react(emoji: string) {
    const on = !state.mine.includes(emoji);
    start(async () => {
      setOptimistic({ emoji, on });
      const res = await toggleReaction(a.id, emoji, on);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <Card id={a.id} className={cn("scroll-mt-20", a.pinned && "border-accent/40")}>
      <div className="mb-2 flex items-center gap-2">
        <Avatar name={a.author.name} path={a.author.avatar} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{a.author.name}</p>
          <p className="font-mono text-[11px] text-subtle">{formatDistanceToNow(new Date(a.publishedAt), { locale: es, addSuffix: true })}</p>
        </div>
        {a.pinned && (
          <Badge tone="accent">
            <Pin className="size-3" /> Fijado
          </Badge>
        )}
        {a.shiftName && <Badge>Turno {a.shiftName}</Badge>}
      </div>
      <p className="whitespace-pre-line">{a.body}</p>
      {a.imageUrl && <img src={a.imageUrl} alt="" className="mt-3 max-h-96 w-full rounded-2xl object-cover" loading="lazy" />}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {REACTIONS.map((e) => {
          const n = state.reactions[e] ?? 0;
          const mine = state.mine.includes(e);
          if (!n && !mine && Object.keys(state.reactions).length > 2) return null;
          return (
            <button
              key={e}
              onClick={() => react(e)}
              aria-pressed={mine}
              aria-label={`Reaccionar con ${e}`}
              className={cn("flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-3 text-base transition", mine ? "border-accent bg-accent/15" : "border-border bg-surface-2")}
            >
              {e}
              {n > 0 && <span className="font-mono text-xs text-muted">{n}</span>}
            </button>
          );
        })}
      </div>
      {isStaff && (
        <div className="mt-3 flex items-center gap-1 border-t border-border/60 pt-2">
          <span className="flex flex-1 items-center gap-1.5 font-mono text-xs text-muted">
            <Eye className="size-4" /> Visto por {a.views}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={a.pinned ? "Desfijar" : "Fijar"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                await togglePin(a.id, !a.pinned);
                router.refresh();
              })
            }
          >
            {a.pinned ? <PinOff /> : <Pin />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Eliminar aviso"
            disabled={pending}
            onClick={() => {
              if (!confirm("¿Eliminar este aviso?")) return;
              start(async () => {
                const res = await deleteAnnouncement(a.id);
                if (!res.ok) toast.error(res.error);
                router.refresh();
              });
            }}
          >
            <Trash2 />
          </Button>
        </div>
      )}
    </Card>
  );
}
