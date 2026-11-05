"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteCoach, revokeInvitation } from "./actions";

export function CoachInviteForm({ origin, pending: invites }: { origin: string; pending: { id: string; email: string; token: string }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, start] = useTransition();
  const copy = async (token: string) => {
    await navigator.clipboard.writeText(`${origin}/invitacion/${token}`);
    toast.success("Link de invitación copiado. Mandáselo al coach.");
  };
  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await inviteCoach({ email });
            if (!res.ok) return void toast.error(res.error);
            setEmail("");
            await copy(res.data!.token);
            router.refresh();
          });
        }}
      >
        <Input type="email" placeholder="email del coach" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email del coach" />
        <Button type="submit" loading={busy}>
          Invitar
        </Button>
      </form>
      {invites.map((i) => (
        <div key={i.id} className="flex items-center gap-2 rounded-2xl bg-surface-2 py-1 pl-4 pr-1">
          <span className="min-w-0 flex-1 truncate text-sm">{i.email}</span>
          <span className="font-mono text-[11px] text-subtle">pendiente</span>
          <Button variant="ghost" size="icon" aria-label="Copiar link de invitación" onClick={() => copy(i.token)}>
            <Copy />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancelar invitación"
            onClick={() =>
              start(async () => {
                await revokeInvitation(i.id);
                router.refresh();
              })
            }
          >
            <Trash2 />
          </Button>
        </div>
      ))}
    </div>
  );
}
