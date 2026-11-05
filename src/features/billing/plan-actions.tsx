"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelSubscription, startSubscription, startTrial } from "./actions";

export function PlanButtons({ plan, canTrial, isCurrentPaid, isTrialing }: { plan: "coach" | "team"; canTrial: boolean; isCurrentPaid: boolean; isTrialing: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (isCurrentPaid) return <CancelButton />;
  return (
    <div className="space-y-2">
      {canTrial && (
        <Button
          block
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await startTrial(plan);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              router.refresh();
            })
          }
        >
          Probar 30 días gratis
        </Button>
      )}
      <Button
        block
        variant={canTrial ? "outline" : "primary"}
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await startSubscription(plan);
            if (!res.ok) return void toast.error(res.error);
            window.location.assign(res.data!.url);
          })
        }
      >
        {isTrialing ? "Suscribirme y seguir" : "Suscribirme con Mercado Pago"}
      </Button>
    </div>
  );
}

function CancelButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      block
      variant="ghost"
      loading={pending}
      onClick={() => {
        if (!confirm("¿Cancelar la suscripción? El club vuelve al plan Free al terminar; los datos quedan guardados.")) return;
        start(async () => {
          const res = await cancelSubscription();
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        });
      }}
    >
      Cancelar suscripción
    </Button>
  );
}
