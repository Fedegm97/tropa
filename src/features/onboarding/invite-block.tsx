"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, QrCode, RefreshCw, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { regenerateInviteCode } from "@/features/clubs/actions";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.2 8.2 0 0 1-2.4-1.5 9 9 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.4-.5.3-.5v-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c.7.3 1.3.5 1.7.6a4.2 4.2 0 0 0 1.9.1 3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3zM12 21.8a9.9 9.9 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.8L.1 24l6.3-1.7a11.8 11.8 0 0 0 5.6 1.4 11.8 11.8 0 0 0 8.4-20.1z" />
    </svg>
  );
}

export function InviteBlock({ clubName, origin, initialCode, canRegenerate }: { clubName: string; origin: string; initialCode: string; canRegenerate: boolean }) {
  const [code, setCode] = useState(initialCode);
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [pending, start] = useTransition();
  const link = `${origin}/unirme/${code}`;
  const message = `¡Sumate a la app de ${clubName}! 🏃\nAhí vas a ver tus entrenamientos, avisos y más.\nEntrá acá: ${link}`;

  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 480, color: { dark: "#0B0907", light: "#FFFFFF" } }).then(setQr);
  }, [link]);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: clubName, text: message });
        return;
      } catch {
        /* cancelado */
      }
    }
    await navigator.clipboard.writeText(message);
    toast.success("Mensaje copiado.");
  }

  return (
    <Card id="invitar" className="scroll-mt-20 space-y-3">
      <p className="text-sm text-muted">Compartí este link. Quien lo abra se registra y queda en el club.</p>
      <div className="flex items-center gap-2 rounded-2xl bg-surface-2 p-1 pl-4">
        <span className="min-w-0 flex-1 truncate font-mono text-sm">{link.replace(/^https?:\/\//, "")}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Copiar link"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            toast.success("Link copiado.");
          }}
        >
          <Copy />
        </Button>
      </div>
      <Button asChild variant="whatsapp" block size="lg">
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
          <WhatsAppIcon /> Compartir por WhatsApp
        </a>
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={share}>
          <Share2 /> Compartir
        </Button>
        <Button variant="secondary" onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
          <QrCode /> QR
        </Button>
      </div>
      {showQr && qr && (
        <div className="rounded-2xl bg-white p-4">
          <img src={qr} alt={`Código QR para unirse a ${clubName}`} className="mx-auto w-full max-w-60" />
          <p className="mt-2 text-center text-sm text-[#0B0907]">Mostralo en el entrenamiento para que lo escaneen.</p>
        </div>
      )}
      {canRegenerate && (
        <Button
          variant="ghost"
          size="sm"
          loading={pending}
          onClick={() => {
            if (!confirm("¿Generar un link nuevo? El actual deja de funcionar.")) return;
            start(async () => {
              const res = await regenerateInviteCode();
              if (!res.ok) return void toast.error(res.error);
              setCode(res.data!.code);
              toast.success(res.message);
            });
          }}
        >
          <RefreshCw /> Generar link nuevo
        </Button>
      )}
    </Card>
  );
}
