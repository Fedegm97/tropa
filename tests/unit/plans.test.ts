import { describe, expect, it } from "vitest";
import { checkLimit, effectivePlan, hasFeature } from "@/lib/domain/plans";

describe("effectivePlan", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  it("trial vigente mantiene el plan", () => {
    expect(effectivePlan({ planCode: "team", planStatus: "trialing", trialEndsAt: "2026-11-20T00:00:00Z", planOverride: false }, now)).toBe("team");
  });
  it("trial vencido vuelve a Free", () => {
    expect(effectivePlan({ planCode: "team", planStatus: "trialing", trialEndsAt: "2026-11-01T00:00:00Z", planOverride: false }, now)).toBe("free");
  });
  it("cancelado vuelve a Free", () => {
    expect(effectivePlan({ planCode: "coach", planStatus: "canceled", trialEndsAt: null, planOverride: false }, now)).toBe("free");
  });
  it("past_due conserva el plan (período de gracia)", () => {
    expect(effectivePlan({ planCode: "coach", planStatus: "past_due", trialEndsAt: null, planOverride: false }, now)).toBe("coach");
  });
  it("override manual (pilotos) gana siempre", () => {
    expect(effectivePlan({ planCode: "team", planStatus: "canceled", trialEndsAt: null, planOverride: true }, now)).toBe("team");
  });
});

describe("features y límites", () => {
  it("Free no incluye cuotas; Coach sí; tienda desde Team", () => {
    expect(hasFeature("free", "fees")).toBe(false);
    expect(hasFeature("coach", "fees")).toBe(true);
    expect(hasFeature("coach", "store")).toBe(false);
    expect(hasFeature("team", "store")).toBe(true);
  });
  it("Free: el corredor 11 dispara upsell a Coach", () => {
    expect(checkLimit("free", "runner", 9)).toMatchObject({ ok: true });
    expect(checkLimit("free", "runner", 10)).toEqual({ ok: false, limit: 10, used: 10, upgradeTo: "coach" });
  });
  it("Coach: el segundo coach dispara upsell a Team", () => {
    expect(checkLimit("coach", "staff", 1)).toEqual({ ok: false, limit: 1, used: 1, upgradeTo: "team" });
  });
  it("Club es ilimitado", () => {
    expect(checkLimit("club", "runner", 5000)).toMatchObject({ ok: true, limit: null });
  });
});
