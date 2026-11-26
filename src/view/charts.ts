import type { BatchResult } from "@/pipeline/evaluate";
import { ruleShort } from "./rule-labels";

const ORDER = ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R09", "R12"];

/** Payments on hold per rule id (a payment counts once per rule). Display only. */
export function holdsByReason(r: BatchResult): { ruleId: string; label: string; payments: number }[] {
  const counts = new Map<string, number>();
  for (const p of r.payments) for (const id of new Set(p.evaluation.findings.map((f) => f.ruleId))) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))
    .map(([ruleId, payments]) => ({ ruleId, label: ruleShort(ruleId), payments }));
}

export function decisionSplit(r: BatchResult): { safe: number; hold: number } {
  return { safe: r.counts.safe, hold: r.counts.hold };
}
