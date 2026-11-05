"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Watch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { disconnectWatch } from "./actions";

export function WatchConnections({
  providers,
  connected,
  rootOrigin,
  back,
}: {
  providers: { name: string; label: string }[];
  connected: { provider: string; connected_at: string }[];
  rootOrigin: string;
  back: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (providers.length === 0) return <p className="text-sm text-subtle">La conexión con relojes todavía no está disponible.</p>;
  return (
    <div className="space-y-2">
      {providers.map((p) => {
        const conn = connected.find((c) => c.provider === p.name);
        return conn ? (
          <div key={p.name} className="flex items-center gap-3 rounded-2xl bg-surface-2 py-1 pl-4 pr-1">
            <Watch className="size-4 text-success" aria-hidden />
            <span className="flex-1 text-sm">{p.label} conectado</span>
            <Button
              variant="ghost"
              size="sm"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await disconnectWatch(p.name);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(res.message);
                  router.refresh();
                })
              }
            >
              Desconectar
            </Button>
          </div>
        ) : (
          <Button key={p.name} asChild variant="outline" block>
            <a href={`${rootOrigin}/api/watch/${p.name}/connect?back=${encodeURIComponent(back)}`}>
              <Watch /> Conectar {p.label}
            </a>
          </Button>
        );
      })}
    </div>
  );
}
