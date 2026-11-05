"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/domain/money";
import { cn } from "@/lib/utils";
import { placeOrder } from "./actions";

export function OrderForm({ variants, priceCents, currency }: { variants: { id: string; size: string | null; stock: number }[]; priceCents: number; currency: string }) {
  const router = useRouter();
  const available = variants.filter((v) => v.stock > 0);
  const [variantId, setVariantId] = useState(available[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const selected = variants.find((v) => v.id === variantId);
  const max = Math.min(20, selected?.stock ?? 0);

  if (available.length === 0) return <p className="rounded-2xl bg-surface p-4 text-center text-sm text-muted">Sin stock por ahora.</p>;

  return (
    <div className="space-y-3">
      {variants.some((v) => v.size) && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Talle">
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={variantId === v.id}
              disabled={v.stock === 0}
              onClick={() => (setVariantId(v.id), setQty(1))}
              className={cn(
                "min-h-11 min-w-11 rounded-xl border px-3 font-mono text-sm disabled:opacity-30 disabled:line-through",
                variantId === v.id ? "border-accent bg-accent/15" : "border-border",
              )}
            >
              {v.size ?? "Único"}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-2xl bg-surface">
          <Button variant="ghost" size="icon" aria-label="Menos" onClick={() => setQty((q) => Math.max(1, q - 1))}>
            <Minus />
          </Button>
          <span className="w-8 text-center font-mono" aria-live="polite">
            {qty}
          </span>
          <Button variant="ghost" size="icon" aria-label="Más" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max}>
            <Plus />
          </Button>
        </div>
        <p className="font-mono text-sm text-muted">{selected && selected.stock <= 3 ? `¡Quedan ${selected.stock}!` : ""}</p>
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Nota para el coach (opcional)" aria-label="Nota" />
      <Button
        block
        size="lg"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await placeOrder({ items: [{ variantId, quantity: qty }], note });
            if (!res.ok) return void toast.error(res.error);
            toast.success(res.message);
            router.push("/tienda/pedidos");
            router.refresh();
          })
        }
      >
        Pedir · {formatMoney(priceCents * qty, currency)}
      </Button>
    </div>
  );
}
