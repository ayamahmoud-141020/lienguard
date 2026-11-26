import { formatMoney, type Cents } from "../money";
import { compareDates, daysBetween, formatDate, type IsoDate } from "../dates";
import type { Coi, Decision, Finding, Payment, RuleId, StateConfig, Waiver } from "../types";

/**
 * Pure rules (ADR-0001). `today` is always passed in; rules never read the clock.
 * Exposure = paid dollars not protected by a valid waiver. Unpaid payments have $0 exposure.
 */
export type PaymentContext = {
  payment: Payment;
  state: string;
  stateConfig: StateConfig;
  /** Waivers matched to this payment. */
  waivers: Waiver[];
  /** The sub's current COI, if any. */
  coi: Coi | null;
  today: IsoDate;
};

/** PASS = this rule does not block the payment (including "not applicable"); HOLD = it does. */
export type RuleStatus = "PASS" | "HOLD";
export type RuleResult = { ruleId: RuleId; name: string; status: RuleStatus; message: string; exposedCents: Cents };

export type PaymentEvaluation = {
  paymentId: string;
  decision: Decision;
  exposedCents: Cents;
  findings: Finding[];
  results: RuleResult[];
  waiverUsed: Waiver | null;
  /** GL expiry of the certificate used for R09 (null if none or unreadable). */
  coiExpiry: IsoDate | null;
};

export const RULE_NAMES: Record<RuleId, string> = {
  R01: "Waiver on file",
  R02: "Waiver amount covers payment",
  R03: "Unconditional after payment",
  R04: "Through date covers period",
  R05: "Waiver signed",
  R06: "Notarized where required",
  R07: "Final payment has final waiver",
  R09: "Insurance certificate valid",
  R12: "Documents readable",
};

/** Prefer unconditional, then the larger amount, then the later through date. */
function bestWaiver(ws: Waiver[]): Waiver | null {
  const sorted = [...ws].sort((a, b) => {
    const t = Number(b.type === "unconditional") - Number(a.type === "unconditional");
    if (t) return t;
    const amt = (b.amountCents ?? 0) - (a.amountCents ?? 0);
    if (amt) return amt;
    return compareDates(b.throughDate ?? "", a.throughDate ?? "");
  });
  return sorted[0] ?? null;
}

export function evaluatePayment(ctx: PaymentContext): PaymentEvaluation {
  const { payment: p, stateConfig, today } = ctx;
  const paid = p.paidDate !== null;
  const full = paid ? p.amountCents : 0;
  const amount = formatMoney(p.amountCents);
  const results: RuleResult[] = [];
  const add = (ruleId: RuleId, status: RuleStatus, message: string, exposedCents = 0) =>
    results.push({ ruleId, name: RULE_NAMES[ruleId], status, message, exposedCents: status === "HOLD" ? exposedCents : 0 });

  const unreadable = ctx.waivers.filter((w) => w.needsReview);
  const usable = ctx.waivers.filter((w) => !w.needsReview);
  const best = bestWaiver(usable);

  // R12: documents that couldn't be read reliably. Fail safe: no proven coverage (Gate A, Q1 → full amount).
  const coiUnreadable = ctx.coi?.needsReview ? [ctx.coi] : [];
  if (unreadable.length || coiUnreadable.length) {
    const files = [...unreadable, ...coiUnreadable].map((d) => `${d.fileName} (${d.reviewReasons.join("; ")})`).join(", ");
    add("R12", "HOLD", `A matched document couldn't be read reliably and needs a person to check it: ${files}.`, unreadable.length && !best ? full : 0);
  } else add("R12", "PASS", "All matched documents were read with high confidence.");

  // R01: no waiver at all.
  if (ctx.waivers.length === 0) {
    add("R01", "HOLD", paid ? `No lien waiver on file for this ${amount} payment.` : `No lien waiver on file yet for this ${amount} payment (not paid yet).`, full);
  } else add("R01", "PASS", "A lien waiver is on file.");

  if (!best) {
    for (const id of ["R02", "R03", "R04", "R05", "R06", "R07"] as const) add(id, "PASS", "Not checked: no readable waiver (see R01 / R12).");
  } else {
    const wAmt = best.amountCents ?? 0;
    if (wAmt < p.amountCents) {
      const gap = p.amountCents - wAmt;
      add("R02", "HOLD", `Waiver covers ${formatMoney(wAmt)} but the payment is ${amount}; ${formatMoney(gap)} is not covered.`, paid ? gap : 0);
    } else add("R02", "PASS", `Waiver amount ${formatMoney(wAmt)} covers ${amount}.`);

    const daysSincePaid = p.paidDate ? daysBetween(p.paidDate, today) : 0;
    if (p.paidDate && best.type === "conditional" && daysSincePaid > stateConfig.unconditionalGraceDays) {
      add("R03", "HOLD", `Paid on ${formatDate(p.paidDate)} (${daysSincePaid} days ago) but only a conditional waiver is on file; an unconditional waiver is needed.`, full);
    } else add("R03", "PASS", best.type === "conditional" ? "Conditional waiver is fine for now (not paid, or within the grace period)." : "Unconditional waiver on file.");

    if (best.throughDate && compareDates(best.throughDate, p.periodEnd) < 0) {
      add("R04", "HOLD", `Waiver runs through ${formatDate(best.throughDate)} but the payment covers work through ${formatDate(p.periodEnd)}.`, full);
    } else add("R04", "PASS", `Through date covers the period ending ${formatDate(p.periodEnd)}.`);

    if (best.signed === false) add("R05", "HOLD", "The waiver is not signed.", full);
    else add("R05", "PASS", "The waiver is signed.");

    if (stateConfig.requiresNotary && best.notarized === false) {
      add("R06", "HOLD", `${ctx.state} requires a notarized waiver (demo setting); this one is not notarized.`, full);
    } else add("R06", "PASS", stateConfig.requiresNotary ? "The waiver is notarized." : `${ctx.state} doesn't require notarization (demo setting).`);

    if (p.isFinal && best.scope === "progress") add("R07", "HOLD", "This is the final payment but the waiver is a progress waiver; a final waiver is needed.", full);
    else add("R07", "PASS", p.isFinal ? "Final waiver on file for the final payment." : "Not a final payment.");
  }

  // R09: insurance. A hold reason only; no lien exposure (Gate A, Q2).
  const asOf = p.paidDate ?? today;
  if (!ctx.coi) add("R09", "HOLD", "No certificate of insurance on file for this subcontractor.");
  else if (ctx.coi.needsReview || !ctx.coi.glExpiry) add("R09", "PASS", "Not checked: the certificate couldn't be read (see R12).");
  else if (compareDates(ctx.coi.glExpiry, asOf) < 0) {
    add("R09", "HOLD", `General liability insurance expired on ${formatDate(ctx.coi.glExpiry)}, before ${p.paidDate ? `the payment date ${formatDate(asOf)}` : `today (${formatDate(asOf)})`}.`);
  } else add("R09", "PASS", `Insurance valid until ${formatDate(ctx.coi.glExpiry)}.`);

  const order: RuleId[] = ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R09", "R12"];
  results.sort((a, b) => order.indexOf(a.ruleId) - order.indexOf(b.ruleId));
  const findings: Finding[] = results
    .filter((r) => r.status === "HOLD")
    .map((r) => ({ paymentId: p.id, ruleId: r.ruleId, severity: "hold", message: r.message, exposedCents: r.exposedCents }));
  return {
    paymentId: p.id,
    decision: findings.length ? "HOLD" : "SAFE",
    exposedCents: findings.reduce((m, f) => Math.max(m, f.exposedCents), 0),
    findings,
    results,
    waiverUsed: best,
    coiExpiry: ctx.coi && !ctx.coi.needsReview ? ctx.coi.glExpiry : null,
  };
}

export function batchExposure(evals: Pick<PaymentEvaluation, "exposedCents">[]): Cents {
  return evals.reduce((s, e) => s + e.exposedCents, 0);
}
