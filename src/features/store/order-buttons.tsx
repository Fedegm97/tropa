"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setOrderStatus } from "./actions";
import type { OrderStatus } from "./labels";

export function OrderButtons({ id, status, isStaff }: { id: string; status: OrderStatus; isStaff: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (s: "paid" | "delivered" | "canceled") =>
    start(async () => {
      if (s === "canceled" && !confirm("¿Cancelar el pedido? El stock vuelve a la tienda.")) return;
      const res = await setOrderStatus(id, s);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      router.refresh();
    });
  if (status === "canceled" || status === "delivered") return null;
  return (
    <div className="flex flex-wrap gap-2">
      {isStaff && status === "pending_payment" && (
        <Button size="sm" onClick={() => run("paid")} disabled={pending}>
          Marcar pagado
        </Button>
      )}
      {isStaff && status === "paid" && (
        <Button size="sm" onClick={() => run("delivered")} disabled={pending}>
          Marcar entregado
        </Button>
      )}
      {(isStaff || status === "pending_payment") && (
        <Button size="sm" variant="ghost" onClick={() => run("canceled")} disabled={pending}>
          Cancelar
        </Button>
      )}
    </div>
  );
}
