import { describe, expect, it } from "vitest";
import { feeStatus, periodOf, resolveFeeAmount, summarizeFees, type FeeRule } from "@/lib/domain/fees";

describe("feeStatus", () => {
  it("Debe: sin pagos", () => {
    expect(feeStatus(20000, [])).toBe("owed");
  });
  it("Pendiente de confirmar: hay un pago declarado sin revisar", () => {
    expect(feeStatus(20000, [{ amountCents: 20000, status: "pending" }])).toBe("pending");
  });
  it("Al día: pago confirmado por el total", () => {
    expect(feeStatus(20000, [{ amountCents: 20000, status: "confirmed" }])).toBe("paid");
  });
  it("Al día: pagos parciales confirmados que suman el total", () => {
    expect(
      feeStatus(20000, [
        { amountCents: 10000, status: "confirmed" },
        { amountCents: 10000, status: "confirmed" },
      ]),
    ).toBe("paid");
  });
  it("Debe: pago parcial confirmado sin nada pendiente", () => {
    expect(feeStatus(20000, [{ amountCents: 5000, status: "confirmed" }])).toBe("owed");
  });
  it("Pendiente: parcial confirmado + resto declarado", () => {
    expect(
      feeStatus(20000, [
        { amountCents: 5000, status: "confirmed" },
        { amountCents: 15000, status: "pending" },
      ]),
    ).toBe("pending");
  });
  it("Debe: el único pago fue rechazado", () => {
    expect(feeStatus(20000, [{ amountCents: 20000, status: "rejected" }])).toBe("owed");
  });
  it("Al día: becados / sin cuota", () => {
    expect(feeStatus(0, [])).toBe("paid");
    expect(feeStatus(null, [])).toBe("paid");
  });
  it("Al día aunque haya un pago pendiente extra", () => {
    expect(
      feeStatus(20000, [
        { amountCents: 20000, status: "confirmed" },
        { amountCents: 20000, status: "pending" },
      ]),
    ).toBe("paid");
  });
});

describe("resolveFeeAmount", () => {
  const rules: FeeRule[] = [
    { shiftId: null, userId: null, amountCents: 20000, validFrom: "2026-01-01" },
    { shiftId: null, userId: null, amountCents: 25000, validFrom: "2026-07-01" },
    { shiftId: "manana", userId: null, amountCents: 18000, validFrom: "2026-01-01" },
    { shiftId: null, userId: "becado", amountCents: 0, validFrom: "2026-03-01" },
  ];

  it("usa la regla general vigente más reciente", () => {
    expect(resolveFeeAmount(rules, { userId: "u1", shiftId: null }, "2026-06-01")).toBe(20000);
    expect(resolveFeeAmount(rules, { userId: "u1", shiftId: null }, "2026-07-01")).toBe(25000);
  });
  it("la regla del turno pisa la general", () => {
    expect(resolveFeeAmount(rules, { userId: "u1", shiftId: "manana" }, "2026-11-01")).toBe(18000);
  });
  it("la regla del corredor pisa a todas", () => {
    expect(resolveFeeAmount(rules, { userId: "becado", shiftId: "manana" }, "2026-11-01")).toBe(0);
  });
  it("una regla futura todavía no aplica", () => {
    expect(resolveFeeAmount(rules, { userId: "becado", shiftId: null }, "2026-02-01")).toBe(20000);
  });
  it("null si no hay ninguna regla", () => {
    expect(resolveFeeAmount([], { userId: "u1", shiftId: null }, "2026-11-01")).toBeNull();
  });
});

describe("resumen", () => {
  it("cuenta por estado ('19 de 24 al día')", () => {
    const statuses = [
      ...Array(19).fill("paid"),
      ...Array(2).fill("pending"),
      ...Array(3).fill("owed"),
    ] as ("paid" | "pending" | "owed")[];
    expect(summarizeFees(statuses)).toEqual({ paid: 19, pending: 2, owed: 3, total: 24 });
  });
  it("periodOf", () => {
    expect(periodOf("2026-11-15")).toBe("2026-11-01");
  });
});
