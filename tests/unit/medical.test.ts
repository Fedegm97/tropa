import { describe, expect, it } from "vitest";
import { daysUntil, medicalStatus } from "@/lib/domain/medical";

const today = "2026-11-05";

describe("medicalStatus", () => {
  it("Sin cargar", () => {
    expect(medicalStatus(null, today)).toBe("missing");
  });
  it("Vencido: venció ayer", () => {
    expect(medicalStatus("2026-11-04", today)).toBe("expired");
  });
  it("Por vencer: vence hoy (vale hasta el día inclusive)", () => {
    expect(medicalStatus("2026-11-05", today)).toBe("expiring");
  });
  it("Por vencer: vence en exactamente 30 días", () => {
    expect(medicalStatus("2026-12-05", today)).toBe("expiring");
  });
  it("Vigente: vence en 31 días", () => {
    expect(medicalStatus("2026-12-06", today)).toBe("valid");
  });
  it("cruza años y bisiestos", () => {
    expect(daysUntil("2028-03-01", "2028-02-28")).toBe(2);
    expect(daysUntil("2027-01-01", "2026-12-31")).toBe(1);
  });
});
