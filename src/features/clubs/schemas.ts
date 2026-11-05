import { z } from "zod";
import { SLUG_REGEX } from "@/lib/domain/slug";

export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Elegí un color válido");

export const createClubSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_REGEX, "Entre 3 y 32 caracteres: letras, números y guiones")
    .refine((s) => !s.includes("--"), "Sin guiones dobles"),
  color: colorSchema,
});
export type CreateClubInput = z.infer<typeof createClubSchema>;

export const brandingSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(60),
  color: colorSchema,
});
