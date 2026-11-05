"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Smartphone, X } from "lucide-react";
import { isStandalone } from "@/components/pwa/platform";

const KEY = "install-nudge-dismissed";
const store = {
  subscribe: () => () => {},
  getSnapshot: () => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {}
    return !isStandalone() && !dismissed;
  },
  getServerSnapshot: () => false,
};

export function InstallNudge({ clubName }: { clubName: string }) {
  const eligible = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [hidden, setHidden] = useState(false);
  if (!eligible || hidden) return null;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-card bg-accent p-4 text-accent-fg">
      <Smartphone className="size-6 shrink-0" aria-hidden />
      <Link href="/instalar" className="flex-1 text-sm font-semibold">
        Instalá la app de {clubName} en tu celular →
      </Link>
      <button
        aria-label="Cerrar"
        className="grid size-11 place-items-center"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {}
          setHidden(true);
        }}
      >
        <X className="size-5" />
      </button>
    </div>
  );
}
