"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, RotateCcw, Watch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requestWatchSync } from "./actions";

type Status = "queued" | "sending" | "on_watch" | "failed";

/** "Enviar al reloj" → "Enviando…" → "En el reloj". Mientras envía, refresca cada 2 s. */
export function WatchSyncButton({ sessionId, provider, providerLabel, status, error }: { sessionId: string; provider: string | null; providerLabel: string; status: Status | null; error: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const inFlight = status === "queued" || status === "sending";

  useEffect(() => {
    if (!inFlight) return;
    const t = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(t);
  }, [inFlight, router]);

  if (!provider) {
    return (
      <Link href="/perfil#reloj" className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm text-muted">
        <Watch className="size-4" aria-hidden /> Conectá tu reloj para enviar la sesión
      </Link>
    );
  }

  const send = () =>
    start(async () => {
      const res = await requestWatchSync(sessionId, provider);
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });

  if (status === "on_watch") {
    return (
      <Card className="flex items-center gap-3 border-success/40 p-3" role="status">
        <CheckCircle2 className="size-5 text-success" aria-hidden />
        <span className="flex-1 text-sm font-medium">En el reloj ({providerLabel})</span>
        <Button variant="ghost" size="sm" onClick={send} loading={pending}>
          Reenviar
        </Button>
      </Card>
    );
  }
  if (inFlight || pending) {
    return (
      <Card className="flex items-center gap-3 p-3" role="status" aria-live="polite">
        <Loader2 className="size-5 animate-spin text-accent-text" aria-hidden />
        <span className="text-sm font-medium">Enviando a tu {providerLabel}…</span>
      </Card>
    );
  }
  return (
    <div className="space-y-1">
      <Button variant="secondary" block onClick={send}>
        {status === "failed" ? <RotateCcw /> : <Watch />} {status === "failed" ? "Reintentar envío al reloj" : "Enviar al reloj"}
      </Button>
      {status === "failed" && error && <p className="text-center text-xs text-danger">No se pudo enviar: {error}</p>}
    </div>
  );
}
