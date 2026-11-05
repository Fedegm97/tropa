"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { VAPID_PUBLIC_KEY } from "@/lib/env";
import { isIos, isStandalone } from "./platform";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

export function PushToggle({ clubId, compact = false }: { clubId: string; compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // En iPhone, push solo funciona con la app instalada (iOS 16.4+).
        return setState(isIos() && !isStandalone() ? "needs-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, []);

  function enable() {
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
        const json = sub.toJSON();
        const { error } = await createClient().rpc("upsert_push_subscription", {
          p_club: clubId,
          p_endpoint: sub.endpoint,
          p_p256dh: json.keys?.p256dh ?? "",
          p_auth: json.keys?.auth ?? "",
          p_user_agent: navigator.userAgent,
        });
        if (error) throw error;
        setState("on");
        toast.success("Listo, vas a recibir los avisos del club.");
      } catch (e) {
        console.error(e);
        toast.error("No pudimos activar las notificaciones.");
      }
    });
  }

  function disable() {
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });
  }

  if (state === "loading") return null;
  if (state === "on")
    return compact ? null : (
      <Button variant="outline" onClick={disable} loading={pending}>
        <BellOff /> Desactivar notificaciones
      </Button>
    );
  if (state === "unsupported") return compact ? null : <p className="text-sm text-subtle">Este navegador no soporta notificaciones.</p>;
  if (state === "needs-install")
    return <p className="text-sm text-muted">Para recibir avisos en iPhone, primero instalá la app (Compartir → Agregar a inicio).</p>;
  if (state === "denied")
    return <p className="text-sm text-muted">Bloqueaste las notificaciones. Activalas desde los ajustes del navegador.</p>;
  return (
    <Button onClick={enable} loading={pending} block={compact}>
      <Bell /> Activar notificaciones
    </Button>
  );
}
