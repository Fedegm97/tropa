"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Download, MoreVertical, PlusSquare, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { platformStore } from "./platform";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-display text-lg font-bold text-accent-fg">{n}</span>
      <span className="pt-1">{children}</span>
    </li>
  );
}

/** Guía de instalación según el dispositivo (iOS / Android / escritorio). */
export function InstallGuide({ clubName }: { clubName: string }) {
  const detected = useSyncExternalStore(platformStore.subscribe, platformStore.getSnapshot, platformStore.getServerSnapshot);
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const platform = installed ? "installed" : detected;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!platform) return null;

  if (platform === "installed") {
    return (
      <Card className="flex items-center gap-3">
        <CheckCircle2 className="size-6 text-success" aria-hidden />
        <p>Ya tenés la app de {clubName} instalada.</p>
      </Card>
    );
  }

  if (platform === "ios") {
    return (
      <Card>
        <p className="mb-4 text-sm text-muted">En iPhone se instala desde Safari:</p>
        <ol className="space-y-4">
          <Step n={1}>
            Tocá <Share className="inline size-5 align-text-bottom text-accent-text" aria-label="Compartir" /> <b>Compartir</b> en la barra de Safari.
          </Step>
          <Step n={2}>
            Elegí <PlusSquare className="inline size-5 align-text-bottom text-accent-text" aria-hidden /> <b>Agregar a inicio</b>.
          </Step>
          <Step n={3}>
            Tocá <b>Agregar</b>. Vas a ver el ícono de {clubName} en tu pantalla.
          </Step>
        </ol>
        <p className="mt-4 text-xs text-subtle">¿Usás Chrome en iPhone? Abrí este link en Safari.</p>
      </Card>
    );
  }

  return (
    <Card>
      {prompt ? (
        <Button
          block
          size="lg"
          onClick={async () => {
            await prompt.prompt();
            const choice = await prompt.userChoice;
            if (choice.outcome === "accepted") setInstalled(true);
            setPrompt(null);
          }}
        >
          <Download /> Instalar la app
        </Button>
      ) : (
        <ol className="space-y-4">
          <Step n={1}>
            Abrí el menú <MoreVertical className="inline size-5 align-text-bottom text-accent-text" aria-label="menú" /> del navegador.
          </Step>
          <Step n={2}>
            Tocá <b>{platform === "android" ? "Instalar app" : "Instalar"}</b> o <b>Agregar a pantalla principal</b>.
          </Step>
          <Step n={3}>Confirmá. La app de {clubName} queda junto a tus otras apps.</Step>
        </ol>
      )}
    </Card>
  );
}
