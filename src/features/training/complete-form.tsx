"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { completeSession, uncompleteSession } from "./actions";

const FEELINGS = [
  { v: 1, e: "😫", l: "Muy duro" },
  { v: 2, e: "😓", l: "Duro" },
  { v: 3, e: "🙂", l: "Bien" },
  { v: 4, e: "😄", l: "Muy bien" },
  { v: 5, e: "🚀", l: "Volando" },
];

export function CompleteForm({ sessionId, done }: { sessionId: string; done: { feeling: number | null; comment: string | null } | null }) {
  const [editing, setEditing] = useState(!done);
  const [feeling, setFeeling] = useState<number | null>(done?.feeling ?? null);
  const [comment, setComment] = useState(done?.comment ?? "");
  const [pending, start] = useTransition();

  if (done && !editing) {
    const f = FEELINGS.find((x) => x.v === done.feeling);
    return (
      <Card className="border-success/40">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-7 text-success" aria-hidden />
          <div className="flex-1">
            <p className="font-display text-xl font-bold uppercase">¡Hecho!</p>
            <p className="text-sm text-muted">
              {f ? `${f.e} ${f.l}` : "Sin sensación"}
              {done.comment ? ` · “${done.comment}”` : ""}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await uncompleteSession(sessionId);
                if (!res.ok) toast.error(res.error);
              })
            }
          >
            Desmarcar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <p className="mb-3 font-display text-xl font-bold uppercase">¿Cómo te sentiste?</p>
      <div className="mb-3 grid grid-cols-5 gap-1" role="radiogroup" aria-label="Sensación">
        {FEELINGS.map((f) => (
          <button
            key={f.v}
            type="button"
            role="radio"
            aria-checked={feeling === f.v}
            aria-label={f.l}
            onClick={() => setFeeling(f.v)}
            className={cn("flex min-h-14 flex-col items-center justify-center rounded-2xl border text-2xl transition", feeling === f.v ? "border-accent bg-accent/15" : "border-border bg-surface-2")}
          >
            {f.e}
            <span className="mt-0.5 font-mono text-[10px] text-muted">{f.v}</span>
          </button>
        ))}
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentario para el coach (opcional)" maxLength={500} className="min-h-20" />
      <Button
        block
        size="lg"
        className="mt-3"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await completeSession({ sessionId, feeling, comment });
            if (!res.ok) return void toast.error(res.error);
            toast.success(res.message);
            setEditing(false);
          })
        }
      >
        Marcar como hecho
      </Button>
    </Card>
  );
}
