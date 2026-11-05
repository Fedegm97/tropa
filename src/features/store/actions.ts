"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionClub, actionStaff, clubHas } from "@/lib/club";
import { errorMessage, zodFieldErrors, type ActionResult } from "@/lib/actions";
import { dispatchPushInBackground } from "@/lib/push/dispatch";
import { parseMoney } from "@/lib/domain/money";

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Poné un nombre").max(80),
  description: z.string().trim().max(1000).optional(),
  price: z.string().refine((v) => parseMoney(v) !== null, "Precio inválido"),
  active: z.boolean(),
  photoPath: z.string().nullable().optional(),
  variants: z
    .array(z.object({ id: z.string().uuid().optional(), size: z.string().trim().max(20).nullable(), stock: z.number().int().min(0).max(100000) }))
    .min(1, "Agregá al menos un talle")
    .max(20)
    .refine((vs) => new Set(vs.map((v) => (v.size ?? "").toUpperCase())).size === vs.length, "Hay talles repetidos"),
});
export type ProductInput = z.input<typeof productSchema>;

export async function saveProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const { club } = await actionStaff();
  if (!clubHas(club, "store")) return { ok: false, error: "La tienda está incluida desde el plan Team." };
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message, fieldErrors: zodFieldErrors(parsed.error.issues) };
  const v = parsed.data;
  if (v.photoPath && !v.photoPath.startsWith(`${club.id}/products/`)) return { ok: false, error: "Foto inválida" };
  const supabase = await createClient();
  const row = {
    name: v.name,
    description: v.description || null,
    price_cents: parseMoney(v.price)!,
    active: v.active,
    photo_path: v.photoPath ?? null,
  };

  let id = v.id;
  if (id) {
    const { error } = await supabase.from("products").update(row).eq("id", id).eq("club_id", club.id);
    if (error) return { ok: false, error: errorMessage(error) };
  } else {
    const { data, error } = await supabase.from("products").insert({ ...row, club_id: club.id }).select("id").single();
    if (error) return { ok: false, error: errorMessage(error) };
    id = data.id;
  }

  // Talles: actualizar los existentes, crear los nuevos y borrar los que se quitaron
  // (los pedidos viejos conservan nombre y talle copiados).
  const { data: existing } = await supabase.from("product_variants").select("id").eq("product_id", id);
  const keep = new Set(v.variants.filter((x) => x.id).map((x) => x.id!));
  const toDelete = (existing ?? []).filter((e) => !keep.has(e.id)).map((e) => e.id);
  if (toDelete.length) await supabase.from("product_variants").delete().in("id", toDelete);
  for (const [i, variant] of v.variants.entries()) {
    const data = { size: variant.size || null, stock: variant.stock, sort: i };
    const { error } = variant.id
      ? await supabase.from("product_variants").update(data).eq("id", variant.id).eq("product_id", id)
      : await supabase.from("product_variants").insert({ ...data, club_id: club.id, product_id: id });
    if (error) return { ok: false, error: errorMessage(error) };
  }

  revalidatePath("/tienda", "layout");
  return { ok: true, data: { id }, message: "Producto guardado." };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const { club } = await actionStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id).eq("club_id", club.id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/tienda", "layout");
  return { ok: true, message: "Producto eliminado." };
}

const orderSchema = z.object({
  items: z.array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(20) })).min(1).max(20),
  note: z.string().trim().max(300).optional(),
});

export async function placeOrder(input: z.input<typeof orderSchema>): Promise<ActionResult<{ number: number }>> {
  const { club } = await actionClub();
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisá el pedido" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("place_order", {
      p_club: club.id,
      p_items: parsed.data.items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
      p_note: parsed.data.note || undefined,
    })
    .single();
  if (error) {
    if (error.message.includes("out_of_stock")) return { ok: false, error: "No queda stock suficiente de ese talle." };
    if (error.message.includes("product_inactive")) return { ok: false, error: "Ese producto ya no está disponible." };
    if (error.message.includes("feature_not_in_plan")) return { ok: false, error: "La tienda del club no está activa." };
    return { ok: false, error: errorMessage(error) };
  }
  after(dispatchPushInBackground);
  revalidatePath("/tienda", "layout");
  return { ok: true, data: { number: data.order_number }, message: `¡Listo! Pedido #${data.order_number}. El coach te avisa cómo pagarlo.` };
}

export async function setOrderStatus(id: string, status: "paid" | "delivered" | "canceled"): Promise<ActionResult> {
  await actionClub();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_status", { p_order: id, p_status: status });
  if (error) return { ok: false, error: errorMessage(error) };
  after(dispatchPushInBackground);
  revalidatePath("/tienda", "layout");
  return { ok: true, message: { paid: "Marcado como pagado.", delivered: "Marcado como entregado.", canceled: "Pedido cancelado." }[status] };
}
