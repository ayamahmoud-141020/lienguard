import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney } from "@/domain/money";
import { compareDates, daysBetween, parseDate } from "@/domain/dates";
import { normalizeName } from "@/domain/matching/normalize";

describe("S-2 money", () => {
  it("AC-2.1 parses money text into integer cents", () => {
    expect(parseMoney("$18,000.00")).toEqual({ ok: true, cents: 1800000 });
    expect(parseMoney("18000")).toEqual({ ok: true, cents: 1800000 });
    expect(parseMoney("$1,234.5")).toEqual({ ok: true, cents: 123450 });
  });
  it("AC-2.1 unparseable money is an error result, not a throw and not 0", () => {
    const r = parseMoney("eighteen");
    expect(r.ok).toBe(false);
  });
  it("AC-2.2 formats cents as dollars", () => {
    expect(formatMoney(200000)).toBe("$2,000.00");
    expect(formatMoney(123450)).toBe("$1,234.50");
  });
});

describe("S-2 dates", () => {
  it("AC-2.3 parses common date formats to ISO", () => {
    for (const s of ["10/31/2026", "October 31, 2026", "2026-10-31", "Oct. 31, 2026"]) {
      expect(parseDate(s)).toEqual({ ok: true, date: "2026-10-31" });
    }
  });
  it("AC-2.3 invalid dates are error results", () => {
    expect(parseDate("2026-02-30").ok).toBe(false);
    expect(parseDate("soon").ok).toBe(false);
  });
  it("AC-2.4 days between and compare", () => {
    expect(daysBetween("2026-11-06", "2026-11-20")).toBe(14);
    expect(compareDates("2026-09-30", "2026-10-31")).toBeLessThan(0);
    expect(compareDates("2026-10-31", "2026-10-31")).toBe(0);
  });
});

describe("S-2 normalize", () => {
  it("AC-2.5 normalizes company names", () => {
    expect(normalizeName("Summit Air Mechanical, LLC")).toBe("summit air mechanical");
    expect(normalizeName("Granite Drywall & Paint Inc.")).toBe("granite drywall and paint");
    expect(normalizeName("  BLUELINE  Plumbing Co. ")).toBe("blueline plumbing");
  });
});
