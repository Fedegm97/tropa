"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Pin, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/images/compress";
import { cn, randomId } from "@/lib/utils";
import { createAnnouncement } from "./actions";

export function AnnouncementComposer({ clubId, userId, shifts }: { clubId: string; userId: string; shifts: { id: string; name: string }[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"club" | "shift">("club");
  const [shiftId, setShiftId] = useState(shifts[0]?.id ?? null);
  const [pin, setPin] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Subí una imagen.");
    const c = await compressImage(file, { maxSizeMB: 1, maxWidthOrHeight: 1600 });
    setImage(c);
    setPreview(URL.createObjectURL(c));
  }

  function submit() {
    start(async () => {
      let imagePath: string | null = null;
      if (image) {
        imagePath = `${clubId}/announcements/${userId}/${randomId()}.webp`;
        const { error } = await createClient().storage.from("club-files").upload(imagePath, image, { contentType: "image/webp" });
        if (error) return void toast.error("No pudimos subir la imagen.");
      }
      const res = await createAnnouncement({ body, audience, shiftId, imagePath, pin });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      setBody("");
      setImage(null);
      setPreview(null);
      setPin(false);
      router.refresh();
    });
  }

  return (
    <Card id="nuevo" className="mb-5 scroll-mt-20 space-y-3">
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribí un aviso para el club…" maxLength={2000} aria-label="Texto del aviso" />
      {preview && (
        <div className="relative">
          <img src={preview} alt="Imagen del aviso" className="max-h-56 w-full rounded-2xl object-cover" />
          <Button size="icon" variant="secondary" className="absolute right-2 top-2" aria-label="Quitar imagen" onClick={() => (setImage(null), setPreview(null))}>
            <X />
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={audience === "club" ? "club" : (shiftId ?? "")} onChange={(e) => (e.target.value === "club" ? setAudience("club") : (setAudience("shift"), setShiftId(e.target.value)))} className="h-11 w-auto flex-1" aria-label="Destinatarios">
          <option value="club">Todo el club</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              Turno {s.name}
            </option>
          ))}
        </Select>
        <Button type="button" variant="ghost" size="icon" aria-label="Agregar imagen" onClick={() => fileRef.current?.click()}>
          <ImagePlus />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-pressed={pin} aria-label="Fijar aviso" onClick={() => setPin((p) => !p)} className={cn(pin && "bg-accent/15 text-accent-text")}>
          <Pin />
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onImage(e.target.files?.[0])} />
      </div>
      <Button block loading={pending} disabled={!body.trim()} onClick={submit}>
        Publicar aviso
      </Button>
    </Card>
  );
}
