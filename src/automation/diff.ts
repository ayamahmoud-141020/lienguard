import type { BatchResult } from "@/pipeline/evaluate";

export type DecisionChange = {
  paymentId: string;
  subCode: string;
  subName: string;
  invoice: string;
  amountCents: number;
  from: "SAFE" | "HOLD";
  to: "SAFE" | "HOLD";
};

/** Payments whose SAFE/HOLD decision differs between two results of the same batch. */
export function diffDecisions(before: BatchResult | null, after: BatchResult): DecisionChange[] {
  if (!before) return [];
  const old = new Map(before.payments.map((p) => [p.payment.id, p.evaluation.decision]));
  return after.payments
    .filter((p) => old.has(p.payment.id) && old.get(p.payment.id) !== p.evaluation.decision)
    .map((p) => ({
      paymentId: p.payment.id,
      subCode: p.payment.subCode,
      subName: p.sub?.name ?? p.payment.subCode,
      invoice: p.payment.invoiceNo,
      amountCents: p.payment.amountCents,
      from: old.get(p.payment.id) as "SAFE" | "HOLD",
      to: p.evaluation.decision,
    }));
}
