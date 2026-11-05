"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/images/compress";
import { randomId } from "@/lib/utils";
import { deleteProduct, saveProduct, type ProductInput } from "./actions";
import { SIZE_PRESETS } from "./labels";

type Variant = { id?: string; size: string | null; stock: number };

export function ProductForm({ clubId, initial, photoUrl }: { clubId: string; initial?: ProductInput; photoUrl?: string | null }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [photoPath, setPhotoPath] = useState<string | null>(initial?.photoPath ?? null);
  const [preview, setPreview] = useState<string | null>(photoUrl ?? null);
  const [variants, setVariants] = useState<Variant[]>((initial?.variants as Variant[]) ?? [{ size: "M", stock: 10 }]);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPhoto(file?: File) {
    if (!file) return;
    const c = await compressImage(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1200 });
    const path = `${clubId}/products/${randomId()}.webp`;
    const { error } = await createClient().storage.from("club-files").upload(path, c, { contentType: "image/webp" });
    if (error) return void toast.error("No pudimos subir la foto.");
    setPhotoPath(path);
    setPreview(URL.createObjectURL(c));
  }

  const setVariant = (i: number, patch: Partial<Variant>) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => fileRef.current?.click()} className="grid aspect-square w-full max-w-60 place-items-center overflow-hidden rounded-card border border-dashed border-border bg-surface" aria-label="Foto del producto">
        {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <ImagePlus className="size-8 text-subtle" />}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      <Field label="Nombre" htmlFor="name">
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Remera técnica del club" maxLength={80} />
      </Field>
      <Field label="Descripción" htmlFor="desc">
        <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
      </Field>
      <Field label="Precio" htmlFor="price">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-subtle">$</span>
          <Input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="pl-8 font-mono" placeholder="18.000" />
        </div>
      </Field>
      <Field label="Talles y stock">
        <div className="space-y-2">
          {variants.map((v, i) => (
            <div key={v.id ?? i} className="flex gap-2">
              <Input value={v.size ?? ""} onChange={(e) => setVariant(i, { size: e.target.value || null })} placeholder="Talle único" aria-label="Talle" className="flex-1" />
              <Input type="number" min={0} value={v.stock} onChange={(e) => setVariant(i, { stock: Math.max(0, parseInt(e.target.value || "0", 10)) })} aria-label="Stock" className="w-24 font-mono" />
              <Button variant="ghost" size="icon" aria-label="Quitar talle" onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))} disabled={variants.length === 1}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setVariants((vs) => [...vs, { size: null, stock: 0 }])}>
              <Plus /> Talle
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setVariants(SIZE_PRESETS.map((s) => ({ size: s, stock: 5 })))}>
              XS a XXL
            </Button>
          </div>
        </div>
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-[var(--accent)]" />
        Visible en la tienda
      </label>
      <Button
        block
        size="lg"
        loading={pending}
        onClick={() =>
          start(async () => {
            const res = await saveProduct({ id: initial?.id, name, description, price, active, photoPath, variants });
            if (!res.ok) return void toast.error(res.error);
            toast.success(res.message);
            router.push("/tienda");
            router.refresh();
          })
        }
      >
        Guardar producto
      </Button>
      {initial?.id && (
        <Button
          block
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (!confirm("¿Eliminar el producto? Los pedidos ya hechos se conservan.")) return;
            start(async () => {
              const res = await deleteProduct(initial.id!);
              if (!res.ok) return void toast.error(res.error);
              router.replace("/tienda");
            });
          }}
        >
          <Trash2 /> Eliminar producto
        </Button>
      )}
    </div>
  );
}
