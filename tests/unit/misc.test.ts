import { describe, expect, it } from "vitest";
import { SWATCHES, accentForDarkBg, contrastRatio, DARK_BG, initials, readableOn } from "@/lib/domain/color";
import { isValidSlug, slugify } from "@/lib/domain/slug";
import { addDays, isoDay, mondayOf, todayIn, weekDays } from "@/lib/domain/dates";

describe("slug", () => {
  it("genera slugs cortos sin acentos", () => {
    expect(slugify("Río Norte Running Team")).toBe("rionorte");
    expect(slugify("Los Ñandúes")).toBe("losnandues");
    expect(isValidSlug("rionorte")).toBe(true);
    expect(isValidSlug("-mal")).toBe(false);
    expect(isValidSlug("a--b")).toBe(false);
    expect(isValidSlug("ab")).toBe(false);
  });
});

describe("color", () => {
  it("iniciales ignoran palabras genéricas", () => {
    expect(initials("Río Norte Running Team")).toBe("RN");
    expect(initials("Tropa")).toBe("T");
  });
  it("todos los swatches alcanzan contraste AA sobre el fondo oscuro tras ajustarse", () => {
    for (const s of SWATCHES) {
      expect(contrastRatio(accentForDarkBg(s), DARK_BG)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(readableOn(s), s)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("un color muy oscuro se aclara", () => {
    expect(contrastRatio(accentForDarkBg("#1A1A60"), DARK_BG)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("dates", () => {
  it("semana L–D", () => {
    expect(isoDay("2026-11-08")).toBe(7);
    expect(mondayOf("2026-11-08")).toBe("2026-11-02");
    expect(mondayOf("2026-11-02")).toBe("2026-11-02");
    expect(weekDays("2026-11-02")).toHaveLength(7);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("hoy en la zona del club", () => {
    // 02:00 UTC del 6/11 todavía es 5/11 en Buenos Aires
    expect(todayIn("America/Argentina/Buenos_Aires", new Date("2026-11-06T02:00:00Z"))).toBe("2026-11-05");
  });
});

import { authCookieDomain, clubOrigin, clubSlugFromHost, safeNext } from "@/lib/hosts";

describe("hosts", () => {
  it("resuelve el club por subdominio", () => {
    expect(clubSlugFromHost("rionorte.tropa.app", "tropa.app")).toBe("rionorte");
    expect(clubSlugFromHost("RioNorte.tropa.app", "tropa.app")).toBe("rionorte");
    expect(clubSlugFromHost("rionorte.lvh.me:3000", "lvh.me:3000")).toBe("rionorte");
    expect(clubSlugFromHost("tropa.app", "tropa.app")).toBeNull();
    expect(clubSlugFromHost("www.tropa.app", "tropa.app")).toBeNull();
    expect(clubSlugFromHost("a.b.tropa.app", "tropa.app")).toBeNull();
    expect(clubSlugFromHost("tropa.app.evil.com", "tropa.app")).toBeNull();
    expect(clubSlugFromHost("eviltropa.app", "tropa.app")).toBeNull();
  });
  it("arma orígenes y dominio de cookie", () => {
    expect(clubOrigin("rionorte", "tropa.app")).toBe("https://rionorte.tropa.app");
    expect(clubOrigin("rionorte", "lvh.me:3000")).toBe("http://rionorte.lvh.me:3000");
    expect(authCookieDomain("tropa.app")).toBe(".tropa.app");
    expect(authCookieDomain("localhost:3000")).toBeUndefined();
  });
  it("evita open redirects", () => {
    expect(safeNext("/plan")).toBe("/plan");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext(null, "/x")).toBe("/x");
  });
});
