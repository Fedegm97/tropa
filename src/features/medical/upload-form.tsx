"use client";

import { randomId } from "@/lib/utils";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/images/compress";
import { saveCertificate } from "./actions";

export function CertificateUploadForm({ clubId, userId, today }: { clubId: string; userId: string; today: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [expiresOn, setExpiresOn] = useState("");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  async function onFile(f?: File) {
    if (!f) return;
    if (f.type === "application/pdf") {
      if (f.size > 5 * 1024 * 1024) return void toast.error("El PDF pesa más de 5 MB.");
      return setFile(f);
    }
    if (!f.type.startsWith("image/")) return void toast.error("Subí una foto o un PDF.");
    setFile(await compressImage(f, { maxSizeMB: 1, maxWidthOrHeight: 2000 }));
  }

  return (
    <Card className="space-y-4">
      <p className="font-display text-xl font-bold uppercase">Cargar apto</p>
      {file ? (
        <div className="flex items-center gap-2 rounded-2xl bg-surface-2 py-1 pl-4 pr-1">
          <FileText className="size-4 text-accent-text" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
          <Button variant="ghost" size="icon" aria-label="Quitar archivo" onClick={() => setFile(null)}>
            <X />
          </Button>
        </div>
      ) : (
        <Button variant="outline" block onClick={() => ref.current?.click()}>
          <Upload /> Foto o PDF del certificado
        </Button>
      )}
      <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <Field label="Vence el" htmlFor="expires">
        <Input id="expires" type="date" min={today} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className="font-mono" />
      </Field>
      <Button
        block
        size="lg"
        loading={pending}
        disabled={!file || !expiresOn}
        onClick={() =>
          start(async () => {
            const ext = file!.type === "application/pdf" ? "pdf" : "webp";
            const path = `${clubId}/medical/${userId}/${randomId()}.${ext}`;
            const { error } = await createClient().storage.from("club-files").upload(path, file!, { contentType: file!.type });
            if (error) return void toast.error("No pudimos subir el archivo.");
            const res = await saveCertificate({ filePath: path, expiresOn });
            if (!res.ok) return void toast.error(res.error);
            toast.success(res.message);
            setFile(null);
            setExpiresOn("");
            router.refresh();
          })
        }
      >
        Guardar apto
      </Button>
    </Card>
  );
}
