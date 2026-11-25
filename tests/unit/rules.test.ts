import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { evaluatePayment, batchExposure, type PaymentContext } from "@/domain/rules";
import { stateConfigFor } from "@/domain/rules/config";
import type { Coi, Payment, Waiver } from "@/domain/types";

const TODAY = "2026-11-20";

const payment = (over: Partial<Payment> = {}): Payment => ({
  id: "P1", projectCode: "PRK", subCode: "SUM", invoiceNo: "INV-1", amountCents: 2000000,
  periodEnd: "2026-10-31", paidDate: "2026-11-14", isFinal: false, ...over,
});
const waiver = (over: Partial<Waiver> = {}): Waiver => ({
  documentId: "w1", fileName: "w1.pdf", claimantName: "Summit Air Mechanical", customerName: "Harborline Builders",
  projectName: "Parkway Retail Center", type: "unconditional", scope: "progress", amountCents: 2000000,
  throughDate: "2026-10-31", signed: true, notarized: false, needsReview: false, reviewReasons: [], ...over,
});
const coi = (over: Partial<Coi> = {}): Coi => ({
  documentId: "c1", fileName: "c1.pdf", insuredName: "Summit Air Mechanical", glExpiry: "2027-06-30",
  needsReview: false, reviewReasons: [], ...over,
});
const ctx = (over: Partial<PaymentContext> = {}): PaymentContext => ({
  payment: payment(), state: "AZ", stateConfig: stateConfigFor("AZ"), waivers: [waiver()], coi: coi(), today: TODAY, ...over,
});
const holds = (c: PaymentContext) => evaluatePayment(c).findings.map((f) => f.ruleId).sort();

describe("S-7 rules", () => {
  it("AC-7.1 R01 no waiver → HOLD, exposure full when paid, $0 when unpaid", () => {
    const r = evaluatePayment(ctx({ waivers: [] }));
    expect(r.decision).toBe("HOLD");
    expect(holds(ctx({ waivers: [] }))).toEqual(["R01"]);
    expect(r.exposedCents).toBe(2000000);
    expect(evaluatePayment(ctx({ waivers: [], payment: payment({ paidDate: null }) })).exposedCents).toBe(0);
  });

  it("AC-7.2 R02 waiver amount short → exposure is the difference", () => {
    const r = evaluatePayment(ctx({ waivers: [waiver({ amountCents: 1800000 })] }));
    expect(r.findings.map((f) => f.ruleId)).toEqual(["R02"]);
    expect(r.exposedCents).toBe(200000);
  });

  it("AC-7.3 R03 conditional after the grace period → HOLD; within grace → no R03", () => {
    const late = ctx({ payment: payment({ paidDate: "2026-11-06" }), waivers: [waiver({ type: "conditional" })] });
    expect(holds(late)).toEqual(["R03"]);
    expect(evaluatePayment(late).exposedCents).toBe(2000000);
    const inGrace = ctx({ payment: payment({ paidDate: "2026-11-15" }), waivers: [waiver({ type: "conditional" })] });
    expect(holds(inGrace)).toEqual([]);
  });

  it("AC-7.4 R04 through date before period end → HOLD full amount", () => {
    const c = ctx({ waivers: [waiver({ throughDate: "2026-09-30" })] });
    expect(holds(c)).toEqual(["R04"]);
    expect(evaluatePayment(c).exposedCents).toBe(2000000);
  });

  it("AC-7.5 R05 unsigned → HOLD full amount", () => {
    const c = ctx({ waivers: [waiver({ signed: false })] });
    expect(holds(c)).toEqual(["R05"]);
    expect(evaluatePayment(c).exposedCents).toBe(2000000);
  });

  it("AC-7.6 R06 not notarized in TX → HOLD; same waiver in AZ → no R06", () => {
    const tx = ctx({ state: "TX", stateConfig: stateConfigFor("TX") });
    expect(holds(tx)).toEqual(["R06"]);
    expect(evaluatePayment(tx).exposedCents).toBe(2000000);
    expect(holds(ctx())).toEqual([]);
  });

  it("AC-7.7 R07 final payment with a progress waiver → HOLD full amount", () => {
    const c = ctx({ payment: payment({ isFinal: true }) });
    expect(holds(c)).toEqual(["R07"]);
    expect(evaluatePayment(c).exposedCents).toBe(2000000);
  });

  it("AC-7.8 R09 no COI or COI expired before payment → HOLD with $0 exposure; unpaid compares to today", () => {
    expect(holds(ctx({ coi: null }))).toEqual(["R09"]);
    const expired = ctx({ payment: payment({ paidDate: "2026-11-15" }), coi: coi({ glExpiry: "2026-11-10" }) });
    expect(holds(expired)).toEqual(["R09"]);
    expect(evaluatePayment(expired).exposedCents).toBe(0);
    const unpaidExpired = ctx({ payment: payment({ paidDate: null }), waivers: [waiver({ type: "conditional" })], coi: coi({ glExpiry: "2026-11-19" }) });
    expect(holds(unpaidExpired)).toEqual(["R09"]);
    const unpaidValid = ctx({ payment: payment({ paidDate: null }), waivers: [waiver({ type: "conditional" })], coi: coi({ glExpiry: "2026-11-20" }) });
    expect(holds(unpaidValid)).toEqual([]);
  });

  it("AC-7.9 R12 matched waiver needs review → HOLD full paid amount; that waiver is not used by R02–R07", () => {
    const c = ctx({ waivers: [waiver({ needsReview: true, reviewReasons: ["amount is unclear"], amountCents: 100, signed: false })] });
    expect(holds(c)).toEqual(["R12"]);
    expect(evaluatePayment(c).exposedCents).toBe(2000000);
  });

  it("AC-7.10 the base case is SAFE with no findings and $0 exposure", () => {
    const r = evaluatePayment(ctx());
    expect(r).toMatchObject({ decision: "SAFE", findings: [], exposedCents: 0 });
  });

  it("AC-7.11 unpaid with a full conditional waiver and valid COI → SAFE (ready to pay)", () => {
    const r = evaluatePayment(ctx({ payment: payment({ paidDate: null }), waivers: [waiver({ type: "conditional" })] }));
    expect(r.decision).toBe("SAFE");
  });

  it("AC-7.12 R02 + R04 on one payment → exposure is the max, not the sum", () => {
    const r = evaluatePayment(ctx({ waivers: [waiver({ amountCents: 1800000, throughDate: "2026-09-30" })] }));
    expect(r.findings.map((f) => f.ruleId).sort()).toEqual(["R02", "R04"]);
    expect(r.exposedCents).toBe(2000000);
  });

  it("AC-7.13 batch exposure sums payments; findings are holds with plain-English messages containing the numbers", () => {
    const a = evaluatePayment(ctx({ waivers: [waiver({ amountCents: 1800000 })] }));
    const b = evaluatePayment(ctx({ waivers: [] }));
    expect(batchExposure([a, b])).toBe(2200000);
    const f = a.findings[0]!;
    expect(f).toMatchObject({ ruleId: "R02", severity: "hold", paymentId: "P1" });
    expect(f.message).toContain("$18,000.00");
    expect(f.message).toContain("$20,000.00");
    const r04 = evaluatePayment(ctx({ waivers: [waiver({ throughDate: "2026-09-30" })] })).findings[0]!;
    expect(r04.message).toContain("September 30, 2026");
    expect(r04.message).toContain("October 31, 2026");
  });

  it("AC-7.14 domain code never reads the clock; today is a parameter", () => {
    const out = execSync(`grep -rnE "Date\\.now|new Date\\(\\)" src/domain || true`).toString();
    expect(out.trim()).toBe("");
    expect(readFileSync("src/domain/rules/index.ts", "utf8")).toContain("today");
  });
});
