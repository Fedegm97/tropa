"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ProgressSteps } from "@/components/ui/steps";
import { slugify } from "@/lib/domain/slug";
import { clubOrigin } from "@/lib/hosts";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/images/compress";
import { checkSlug, createClub, setClubLogo } from "./actions";
import { ColorPicker } from "./color-picker";
import { PhonePreview } from "./phone-preview";
import { createClubSchema, type CreateClubInput } from "./schemas";

type SlugState = { status: "idle" | "checking" | "ok" | "taken"; reason?: string };

export function CreateClubForm({ rootDomain }: { rootDomain: string }) {
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>({ status: "idle" });
  const [logo, setLogo] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<CreateClubInput>({
    resolver: zodResolver(createClubSchema),
    defaultValues: { name: "", slug: "", color: "#FF5A1F" },
    mode: "onChange",
  });
  const { register, watch, setValue, formState } = form;
  const name = watch("name");
  const slug = watch("slug");
  const color = watch("color");

  // El slug se genera solo a partir del nombre, hasta que el usuario lo edita.
  useEffect(() => {
    if (!slugEdited) setValue("slug", slugify(name), { shouldValidate: name.length > 0 });
  }, [name, slugEdited, setValue]);

  // Validación en vivo (debounce 350 ms)
  useEffect(() => {
    if (!slug || slug.length < 3) return setSlugState({ status: "idle" });
    setSlugState({ status: "checking" });
    const t = setTimeout(async () => {
      const res = await checkSlug(slug);
      setSlugState(res.available ? { status: "ok" } : { status: "taken", reason: res.reason });
    }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  async function onLogo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Subí una imagen (PNG, JPG o WebP).");
    const compressed = await compressImage(file, { maxSizeMB: 0.5, maxWidthOrHeight: 512, fileType: "image/png" });
    setLogo(compressed);
    setLogoUrl(URL.createObjectURL(compressed));
  }

  const onSubmit = form.handleSubmit((values) => {
    if (slugState.status === "taken") return;
    start(async () => {
      const res = await createClub(values);
      if (!res.ok) {
        if (res.fieldErrors?.slug || res.error.includes("dirección")) setSlugState({ status: "taken", reason: res.error });
        return void toast.error(res.error);
      }
      const club = res.data!;
      if (logo) {
        const path = `${club.id}/logo-${Date.now()}.png`;
        const supabase = createClient();
        const up = await supabase.storage.from("branding").upload(path, logo, { contentType: "image/png", upsert: true });
        if (!up.error) await setClubLogo(club.id, path);
        else toast.error("Creamos el club, pero no pudimos subir el logo. Lo podés cargar en Ajustes.");
      }
      toast.success("¡Listo! Tu club ya tiene su app.");
      window.location.assign(`${clubOrigin(club.slug, rootDomain)}/onboarding/invitar`);
    });
  });

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px] lg:items-start">
      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <ProgressSteps step={1} label="Creá tu club" />
        <div>
          <h1 className="font-display text-4xl font-extrabold uppercase leading-none">Creá la app de tu club</h1>
          <p className="mt-2 text-muted">Nombre, color y logo. Lo podés cambiar después.</p>
        </div>

        <Field label="Nombre del club" htmlFor="name" error={formState.errors.name?.message}>
          <Input id="name" placeholder="Río Norte Running Team" autoComplete="organization" {...register("name")} aria-invalid={!!formState.errors.name} />
        </Field>

        <Field
          label="Dirección de la app"
          htmlFor="slug"
          error={formState.errors.slug?.message ?? (slugState.status === "taken" ? slugState.reason : undefined)}
          hint={
            <span className="font-mono text-xs">
              {slug || "tuclub"}.{rootDomain.split(":")[0]}
            </span>
          }
        >
          <div className="relative">
            <Input
              id="slug"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="pr-12 font-mono"
              {...register("slug", { onChange: () => setSlugEdited(true) })}
              aria-invalid={!!formState.errors.slug || slugState.status === "taken"}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2" aria-live="polite">
              {slugState.status === "checking" && <Loader2 className="size-5 animate-spin text-subtle" aria-label="Verificando" />}
              {slugState.status === "ok" && <Check className="size-5 text-success" aria-label="Disponible" />}
              {slugState.status === "taken" && <X className="size-5 text-danger" aria-label="No disponible" />}
            </span>
          </div>
        </Field>

        <Field label="Color principal">
          <ColorPicker value={color} onChange={(c) => setValue("color", c, { shouldValidate: true })} />
        </Field>

        <Field label="Logo (opcional)" hint="Si no subís uno, usamos las iniciales sobre tu color.">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <ImagePlus /> {logo ? "Cambiar logo" : "Subir logo"}
            </Button>
            {logo && (
              <Button type="button" variant="ghost" onClick={() => (setLogo(null), setLogoUrl(null))}>
                Quitar
              </Button>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
          </div>
        </Field>

        <div className="lg:hidden">
          <PhonePreview name={name} color={color} logoUrl={logoUrl} slug={slug} rootDomain={rootDomain} />
        </div>

        <Button type="submit" size="lg" block loading={pending} disabled={slugState.status === "taken" || slugState.status === "checking"}>
          Crear mi club
        </Button>
      </form>
      <div className="sticky top-8 hidden lg:block">
        <PhonePreview name={name} color={color} logoUrl={logoUrl} slug={slug} rootDomain={rootDomain} />
      </div>
    </div>
  );
}
