"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { ClubBadge } from "@/components/brand/club-badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/images/compress";
import { setClubLogo, updateBranding } from "./actions";
import { ColorPicker } from "./color-picker";

export function BrandingForm({ clubId, name: initialName, color: initialColor, logoPath }: { clubId: string; name: string; color: string; logoPath: string | null }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onLogo(file?: File) {
    if (!file) return;
    start(async () => {
      const c = await compressImage(file, { maxSizeMB: 0.5, maxWidthOrHeight: 512, fileType: "image/png" });
      const path = `${clubId}/logo-${Date.now()}.png`;
      const { error } = await createClient().storage.from("branding").upload(path, c, { contentType: "image/png" });
      if (error) return void toast.error("No pudimos subir el logo.");
      const res = await setClubLogo(clubId, path);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Logo actualizado. Los íconos de la app se regeneran solos.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <ClubBadge name={name} color={color} logoPath={logoPath} size={64} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={pending}>
            <ImagePlus /> {logoPath ? "Cambiar logo" : "Subir logo"}
          </Button>
          {logoPath && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await setClubLogo(clubId, null);
                  router.refresh();
                })
              }
            >
              Usar iniciales
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
      </div>
      <Field label="Nombre del club" htmlFor="club-name">
        <Input id="club-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </Field>
      <Field label="Color principal">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <Button
        block
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await updateBranding({ name, color });
            if (!res.ok) return void toast.error(res.error);
            toast.success(res.message);
            router.refresh();
          })
        }
      >
        Guardar marca
      </Button>
    </div>
  );
}
