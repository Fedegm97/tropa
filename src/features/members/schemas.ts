import { z } from "zod";
import { parsePace } from "@/lib/domain/pace";

export const LEVELS = { beginner: "Inicial", intermediate: "Intermedio", advanced: "Avanzado" } as const;
export type Level = keyof typeof LEVELS;

const pace = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const s = parsePace(v);
    if (s === null || s < 150 || s > 900) {
      ctx.addIssue({ code: "custom", message: "Usá el formato min:seg, entre 2:30 y 15:00" });
      return z.NEVER;
    }
    return s;
  });

const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[+\d\s()-]*$/, "Solo números, espacios y +")
  .optional()
  .transform((v) => v || null);

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Poné tu nombre y apellido").max(80),
  birthDate: z
    .string()
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || (v >= "1920-01-01" && v <= new Date().toISOString().slice(0, 10)), "Fecha inválida"),
  phone,
  emergencyName: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || null),
  emergencyPhone: phone,
  pace,
  paceKind: z.enum(["5k", "threshold"]),
  avatarPath: z.string().nullable().optional(),
});
export type ProfileInput = z.input<typeof profileSchema>;

export const runnerAdminSchema = z.object({
  userId: z.string().uuid(),
  shiftId: z.string().uuid().nullable(),
  level: z.enum(["beginner", "intermediate", "advanced"]).nullable(),
  pace,
  paceKind: z.enum(["5k", "threshold"]),
});
export type RunnerAdminInput = z.input<typeof runnerAdminSchema>;
