"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setRegistration } from "./actions";

export function RegisterControl({
  eventId,
  distances,
  mine,
  past,
}: {
  eventId: string;
  distances: string[];
  mine: { distance: string | null } | null;
  past: boolean;
}) {
  const router = useRouter();
  const [distance, setDistance] = useState<string | null>(mine?.distance ?? distances[0] ?? null);
  const [pending, start] = useTransition();
  if (past) return null;

  const run = (going: boolean, d: string | null = distance) =>
    start(async () => {
      const res = await setRegistration(eventId, going, d);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      router.refresh();
    });

  return (
    <div className="space-y-2">
      {distances.length > 0 && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Distancia">
          {distances.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={distance === d}
              onClick={() => {
                setDistance(d);
                if (mine && mine.distance !== d) run(true, d);
              }}
              className={cn("min-h-11 rounded-full border px-4 font-mono text-sm", distance === d ? "border-accent bg-accent/15 text-fg" : "border-border text-muted")}
            >
              {d}
            </button>
          ))}
        </div>
      )}
      {mine ? (
        <Button variant="outline" block loading={pending} onClick={() => run(false)}>
          Me bajo
        </Button>
      ) : (
        <Button block loading={pending} onClick={() => run(true)}>
          Me anoto{distance ? ` · ${distance}` : ""}
        </Button>
      )}
    </div>
  );
}
