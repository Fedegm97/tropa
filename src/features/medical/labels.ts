import type { MedicalStatus } from "@/lib/domain/medical";
export const MEDICAL_TONE: Record<MedicalStatus, "success" | "warning" | "danger" | "neutral"> = {
  valid: "success",
  expiring: "warning",
  expired: "danger",
  missing: "neutral",
};
