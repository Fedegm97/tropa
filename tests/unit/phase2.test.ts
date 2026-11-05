import { describe, expect, it } from "vitest";
import { addMonths, formatMoney, parseMoney, periodLabel } from "@/lib/domain/money";
import { toCsv } from "@/lib/domain/csv";
import { countdownLabel, daysBetween, parseDistances } from "@/lib/domain/events";

describe("money", () => {
  it("formatea pesos sin decimales innecesarios", () => {
    expect(formatMoney(2500000).replace(/\s/g, " ")).toBe("$ 25.000");
    expect(formatMoney(2500050).replace(/\s/g, " ")).toBe("$ 25.000,50");
    expect(formatMoney(null)).toBe("—");
  });
  it("parsea lo que escribe un usuario argentino", () => {
    expect(parseMoney("25000")).toBe(2500000);
    expect(parseMoney("25.000")).toBe(2500000);
    expect(parseMoney("$ 25.000,5")).toBe(2500050);
    expect(parseMoney("25,50")).toBe(2550);
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("2.50.0")).toBeNull();
  });
  it("períodos", () => {
    expect(periodLabel("2026-11-01")).toBe("Noviembre 2026");
    expect(addMonths("2026-11-01", 2)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
  });
});

describe("csv", () => {
  it("usa ; con BOM, escapa comillas y neutraliza fórmulas", () => {
    const csv = toCsv(["Nombre", "Monto"], [["Pérez; Juan", 25000], ['Dice "hola"', null], ["=HYPERLINK()", -5]]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Nombre;Monto");
    expect(lines[1]).toBe('"Pérez; Juan";25000');
    expect(lines[2]).toBe('"Dice ""hola""";');
    expect(lines[3]).toBe("'=HYPERLINK();-5");
  });
});

describe("eventos", () => {
  it("cuenta regresiva", () => {
    expect(daysBetween("2026-11-05", "2026-11-15")).toBe(10);
    expect(countdownLabel("2026-11-05", "2026-11-15")).toBe("Faltan 10 días");
    expect(countdownLabel("2026-11-05", "2026-11-06")).toBe("Es mañana");
    expect(countdownLabel("2026-11-05", "2026-11-05")).toBe("¡Es hoy!");
    expect(countdownLabel("2026-11-05", "2026-11-01")).toBe("Finalizado");
  });
  it("normaliza distancias", () => {
    expect(parseDistances("5k, 10K ,10k; 21 k")).toEqual(["5K", "10K", "21 K"]);
    expect(parseDistances("")).toEqual([]);
  });
});

import { utcToZoned, zonedToUtc } from "@/lib/domain/dates";

describe("zonas horarias", () => {
  it("convierte hora local del club a UTC y vuelta", () => {
    expect(zonedToUtc("2026-11-15", "08:00", "America/Argentina/Buenos_Aires")).toBe("2026-11-15T11:00:00.000Z");
    expect(zonedToUtc("2026-07-01", "07:30", "Europe/Madrid")).toBe("2026-07-01T05:30:00.000Z"); // horario de verano
    expect(utcToZoned("2026-11-15T11:00:00.000Z", "America/Argentina/Buenos_Aires")).toEqual({ date: "2026-11-15", time: "08:00" });
  });
});
