"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/brand/club-badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/images/compress";
import { updateMyProfile } from "./actions";
import type { ProfileInput } from "./schemas";

export function ProfileForm({
  userId,
  initial,
  avatarPath,
  complete = false,
  doneHref,
}: {
  userId: string;
  initial: ProfileInput;
  avatarPath: string | null;
  complete?: boolean;
  doneHref?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [avatar, setAvatar] = useState<{ path: string | null; preview?: string }>({ path: avatarPath });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, watch } = useForm<ProfileInput>({ defaultValues: initial });
  const name = watch("fullName");

  async function onAvatar(file?: File) {
    if (!file) return;
    const c = await compressImage(file, { maxSizeMB: 0.3, maxWidthOrHeight: 512 });
    const path = `${userId}/${Date.now()}.webp`;
    const { error } = await createClient().storage.from("avatars").upload(path, c, { contentType: "image/webp" });
    if (error) return void toast.error("No pudimos subir la foto.");
    setAvatar({ path, preview: URL.createObjectURL(c) });
  }

  const onSubmit = handleSubmit((values) =>
    start(async () => {
      setErrors({});
      const res = await updateMyProfile({ ...values, avatarPath: avatar.path, complete });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(res.message);
      if (doneHref) router.push(doneHref);
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => fileRef.current?.click()} className="relative rounded-full" aria-label="Cambiar foto">
          {avatar.preview ? (
            <img src={avatar.preview} alt="" className="size-20 rounded-full object-cover" />
          ) : (
            <Avatar name={name || "?"} path={avatar.path} size={80} />
          )}
          <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-accent text-accent-fg">
            <Camera className="size-4" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onAvatar(e.target.files?.[0])} />
        <p className="text-sm text-muted">Una foto ayuda al coach a reconocerte.</p>
      </div>

      <Field label="Nombre y apellido" htmlFor="fullName" error={errors.fullName}>
        <Input id="fullName" autoComplete="name" {...register("fullName")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nacimiento" htmlFor="birthDate" error={errors.birthDate}>
          <Input id="birthDate" type="date" className="font-mono" {...register("birthDate")} />
        </Field>
        <Field label="Teléfono" htmlFor="phone" error={errors.phone}>
          <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+54 9 11…" {...register("phone")} />
        </Field>
      </div>

      <fieldset className="space-y-3 rounded-card border border-border/60 p-4">
        <legend className="px-1 text-sm font-medium text-muted">Contacto de emergencia</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre" htmlFor="emergencyName" error={errors.emergencyName}>
            <Input id="emergencyName" {...register("emergencyName")} />
          </Field>
          <Field label="Teléfono" htmlFor="emergencyPhone" error={errors.emergencyPhone}>
            <Input id="emergencyPhone" type="tel" inputMode="tel" {...register("emergencyPhone")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-card border border-border/60 p-4">
        <legend className="px-1 text-sm font-medium text-muted">Ritmo de referencia</legend>
        <p className="text-sm text-subtle">Con este dato calculamos tus ritmos en cada sesión. Si no lo sabés, dejalo vacío y lo carga tu coach.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="min:seg por km" htmlFor="pace" error={errors.pace}>
            <Input id="pace" placeholder="5:10" inputMode="numeric" className="font-mono" {...register("pace")} />
          </Field>
          <Field label="Medido en" htmlFor="paceKind">
            <Select id="paceKind" {...register("paceKind")}>
              <option value="5k">Ritmo de 5K</option>
              <option value="threshold">Umbral</option>
            </Select>
          </Field>
        </div>
      </fieldset>

      <Button type="submit" block size="lg" loading={pending}>
        {complete ? "Listo, seguir" : "Guardar cambios"}
      </Button>
    </form>
  );
}
