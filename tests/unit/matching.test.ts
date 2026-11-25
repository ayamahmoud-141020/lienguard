import { describe, expect, it } from "vitest";
import { matchDocuments, matchByName } from "@/domain/matching/match";
import type { Coi, Payment, Project, Subcontractor, Waiver } from "@/domain/types";

const subs: Subcontractor[] = [
  { code: "SUM", name: "Summit Air Mechanical", email: "a@x.example", contactName: "A" },
  { code: "BRW", name: "Brightway Electric", email: "b@x.example", contactName: "B" },
  { code: "BRL", name: "Brightline Electrical Services", email: "c@x.example", contactName: "C" },
  { code: "BLU", name: "BlueLine Plumbing", email: "d@x.example", contactName: "D" },
  { code: "COP", name: "Copperleaf Roofing", email: "e@x.example", contactName: "E" },
];
const projects: Project[] = [
  { code: "RVR", name: "Riverside Medical Office", state: "CA", ownerName: "O" },
  { code: "LKV", name: "Lakeview Apartments", state: "TX", ownerName: "O" },
];
const pay = (id: string, subCode: string, projectCode: string, periodEnd: string, isFinal = false): Payment => ({
  id, subCode, projectCode, invoiceNo: id, amountCents: 100, periodEnd, paidDate: "2026-11-10", isFinal,
});
const waiver = (over: Partial<Waiver>): Waiver => ({
  documentId: "w1", fileName: "w1.pdf", claimantName: "Summit Air Mechanical", customerName: null,
  projectName: "Riverside Medical Office", type: "unconditional", scope: "progress", amountCents: 100,
  throughDate: "2026-10-31", signed: true, notarized: false, needsReview: false, reviewReasons: [], ...over,
});

describe("S-6 matching", () => {
  it("AC-6.1 suffix and punctuation variants match with score 1.0", () => {
    expect(matchByName("Summit Air Mechanical, L.L.C.", subs.map((s) => ({ key: s.code, name: s.name })))).toEqual({ key: "SUM", score: 1 });
  });

  it("AC-6.2 similar sub names don't cross-match", () => {
    const m = matchByName("Brightway Electric Inc", subs.map((s) => ({ key: s.code, name: s.name })));
    expect(m?.key).toBe("BRW");
    const r = matchDocuments({
      subs, projects, payments: [pay("P1", "BRW", "RVR", "2026-10-31"), pay("P2", "BRL", "RVR", "2026-10-31")],
      waivers: [waiver({ claimantName: "Brightway Electric Inc" })], cois: [],
    });
    expect(r.waivers[0]?.paymentId).toBe("P1");
  });

  it("AC-6.3 picks the payment whose period end is closest to the through date", () => {
    const payments = [pay("SEP", "BLU", "LKV", "2026-09-30"), pay("OCT", "BLU", "LKV", "2026-10-31")];
    const base = { subs, projects, payments, cois: [] as Coi[] };
    const w = (throughDate: string, scope: "progress" | "final" = "progress") =>
      waiver({ claimantName: "BlueLine Plumbing Co.", projectName: "Lakeview Apartments", throughDate, scope });
    expect(matchDocuments({ ...base, waivers: [w("2026-09-30")] }).waivers[0]?.paymentId).toBe("SEP");
    // Period ends 30 days apart; Oct 15 is exactly 15 days from each → tie on distance.
    const tiePayments = [pay("SEP", "BLU", "LKV", "2026-09-30"), pay("OCT", "BLU", "LKV", "2026-10-30")];
    const tieNoFinal = matchDocuments({ ...base, payments: tiePayments, waivers: [w("2026-10-15")] });
    expect(tieNoFinal.waivers[0]?.paymentId ?? null).toBeNull();
    expect(tieNoFinal.unmatched[0]?.reason).toMatch(/payment/);
    const finalPayments = [pay("SEP", "BLU", "LKV", "2026-09-30"), pay("OCT", "BLU", "LKV", "2026-10-30", true)];
    const tieBroken = matchDocuments({ ...base, payments: finalPayments, waivers: [w("2026-10-15", "final")] });
    expect(tieBroken.waivers[0]?.paymentId).toBe("OCT");
  });

  it("AC-6.4 an unknown claimant is reported as unmatched, never dropped", () => {
    const r = matchDocuments({ subs, projects, payments: [pay("P1", "SUM", "RVR", "2026-10-31")], waivers: [waiver({ claimantName: "Acme Totally Different Glazing" })], cois: [] });
    expect(r.waivers[0]?.paymentId ?? null).toBeNull();
    expect(r.unmatched).toEqual([{ documentId: "w1", fileName: "w1.pdf", reason: "no subcontractor match" }]);
  });

  it("AC-6.5 a COI matches its sub by insured name", () => {
    const coi: Coi = { documentId: "c1", fileName: "c1.pdf", insuredName: "Copperleaf Roofing LLC", glExpiry: "2026-11-10", needsReview: false, reviewReasons: [] };
    const r = matchDocuments({ subs, projects, payments: [], waivers: [], cois: [coi] });
    expect(r.coiBySub.get("COP")?.documentId).toBe("c1");
  });
});
