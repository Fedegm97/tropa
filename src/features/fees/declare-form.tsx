"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/images/compress";
import { cn, randomId } from "@/lib/utils";
import { declarePayment } from "./actions";
import { METHOD_LABELS, type PaymentMethod } from "./labels";

const MAX_BYTES = 1024 * 1024;

export function DeclarePaymentForm({ clubId, userId, period, suggestedAmount }: { clubId: string; userId: string; period: string; suggestedAmount: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState(suggestedAmount);
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(f?: File) {
    if (!f) return;
    if (f.type === "application/pdf") {
      if (f.size > MAX_BYTES) return void toast.error("El PDF pesa más de 1 MB. Mandá una foto del comprobante.");
      return setFile(f);
    }
    if (!f.type.startsWith("image/")) return void toast.error("Subí una imagen o un PDF.");
    setFile(await compressImage(f, { maxSizeMB: 1, maxWidthOrHeight: 1600 }));
  }

  function submit() {
    start(async () => {
      let receiptPath: string | null = null;
      if (file) {
        const ext = file.type === "application/pdf" ? "pdf" : "webp";
        receiptPath = `${clubId}/receipts/${userId}/${randomId()}.${ext}`;
        const { error } = await createClient().storage.from("club-files").upload(receiptPath, file, { contentType: file.type });
        if (error) return void toast.error("No pudimos subir el comprobante.");
      }
      const res = await declarePayment({ period, amount, method, receiptPath, note });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      setFile(null);
      setNote("");
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4">
      <p className="font-display text-xl font-bold uppercase">Informar un pago</p>
      <Field label="Monto" htmlFor="amount">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-subtle">$</span>
          <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-8 font-mono" />
        </div>
      </Field>
      <Field label="Medio de pago">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Medio de pago">
          {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={method === m}
              onClick={() => setMethod(m)}
              className={cn("min-h-11 rounded-2xl border text-sm font-medium", method === m ? "border-accent bg-accent/15 text-fg" : "border-border bg-surface text-muted")}
            >
              {METHOD_LABELS[m]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Comprobante" hint="Foto o PDF, hasta 1 MB. La comprimimos antes de subirla.">
        {file ? (
          <div className="flex items-center gap-2 rounded-2xl bg-surface-2 py-1 pl-4 pr-1">
            <FileText className="size-4 text-accent-text" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </span>
            <Button variant="ghost" size="icon" aria-label="Quitar comprobante" onClick={() => setFile(null)}>
              <X />
            </Button>
          </div>
        ) : (
          <Button variant="outline" block onClick={() => fileRef.current?.click()}>
            <Paperclip /> Adjuntar comprobante
          </Button>
        )}
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </Field>
      <Field label="Nota (opcional)" htmlFor="note">
        <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Ej.: pagué desde la cuenta de mi pareja" />
      </Field>
      <Button block size="lg" loading={pending} onClick={submit}>
        Informar pago
      </Button>
    </Card>
  );
}
