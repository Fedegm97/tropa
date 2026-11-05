"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deletePayment, reviewPayment } from "./actions";

export function ReviewButtons({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (approve: boolean) =>
    start(async () => {
      let reason: string | undefined;
      if (!approve) {
        const r = prompt("¿Por qué lo rechazás? (lo ve el corredor)");
        if (r === null) return;
        reason = r || undefined;
      }
      const res = await reviewPayment(id, approve, reason);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      router.refresh();
    });
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => run(true)} disabled={pending} aria-label="Confirmar pago">
        <Check /> Confirmar
      </Button>
      <Button size="sm" variant="danger" onClick={() => run(false)} disabled={pending} aria-label="Rechazar pago">
        <X /> Rechazar
      </Button>
    </div>
  );
}

export function DeletePaymentButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Borrar pago"
      loading={pending}
      onClick={() => {
        if (!confirm("¿Borrar este pago informado?")) return;
        start(async () => {
          const res = await deletePayment(id);
          if (!res.ok) toast.error(res.error);
          router.refresh();
        });
      }}
    >
      {!pending && <Trash2 />}
    </Button>
  );
}
