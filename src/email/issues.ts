import { formatMoney, type Cents } from "@/domain/money";
import { formatDate, type IsoDate } from "@/domain/dates";
import type { RuleId } from "@/domain/types";
import type { BatchResult } from "@/pipeline/evaluate";

export type Issue = {
  ruleId: RuleId;
  paymentId: string;
  projectName: string;
  invoiceNo: string;
  paid: boolean;
  amountCents: Cents;
  paidDate: IsoDate | null;
  periodEnd: IsoDate;
  waiverAmountCents: Cents | null;
  throughDate: IsoDate | null;
  coiExpiry: IsoDate | null;
};

export type SubIssues = { subCode: string; subName: string; contactName: string; email: string; issues: Issue[] };

/** One entry per subcontractor with at least one HOLD; one issue per HOLD finding. */
export function buildSubIssues(r: BatchResult): SubIssues[] {
  const bySub = new Map<string, SubIssues>();
  for (const p of r.payments) {
    if (p.evaluation.decision !== "HOLD" || !p.sub) continue;
    const entry = bySub.get(p.sub.code) ?? { subCode: p.sub.code, subName: p.sub.name, contactName: p.sub.contactName, email: p.sub.email, issues: [] };
    for (const f of p.evaluation.findings) {
      entry.issues.push({
        ruleId: f.ruleId,
        paymentId: p.payment.id,
        projectName: p.project?.name ?? p.payment.projectCode,
        invoiceNo: p.payment.invoiceNo,
        paid: p.payment.paidDate !== null,
        amountCents: p.payment.amountCents,
        paidDate: p.payment.paidDate,
        periodEnd: p.payment.periodEnd,
        waiverAmountCents: p.evaluation.waiverUsed?.amountCents ?? null,
        throughDate: p.evaluation.waiverUsed?.throughDate ?? null,
        coiExpiry: p.evaluation.coiExpiry,
      });
    }
    bySub.set(p.sub.code, entry);
  }
  return [...bySub.values()].sort((a, b) => a.subName.localeCompare(b.subName));
}

/** Every amount and date the email may mention. Anything else is rejected by the post-check. */
export function allowedValues(sub: SubIssues): { cents: Set<Cents>; dates: Set<IsoDate> } {
  const cents = new Set<Cents>();
  const dates = new Set<IsoDate>();
  for (const i of sub.issues) {
    cents.add(i.amountCents);
    if (i.waiverAmountCents !== null) {
      cents.add(i.waiverAmountCents);
      cents.add(i.amountCents - i.waiverAmountCents);
    }
    dates.add(i.periodEnd);
    for (const d of [i.paidDate, i.throughDate, i.coiExpiry]) if (d) dates.add(d);
  }
  return { cents, dates };
}

export type ModelIssue = { n: number; ruleId: RuleId; project: string; invoice: string; problem: string; needed: string };
export type WriterInput = {
  forModel: { contactName: string; subcontractor: string; issues: ModelIssue[] };
  tokens: Record<string, string>;
};

/** Builds the model's input with placeholders instead of numbers (the model never sees amounts or dates). */
export function buildWriterInput(sub: SubIssues): WriterInput {
  const tokens: Record<string, string> = {};
  const byValue = new Map<string, string>();
  const token = (kind: "AMOUNT" | "DATE", value: string) => {
    const key = `${kind}:${value}`;
    const existing = byValue.get(key);
    if (existing) return `{{${existing}}}`;
    const name = `${kind}_${Object.keys(tokens).filter((k) => k.startsWith(kind)).length + 1}`;
    tokens[name] = value;
    byValue.set(key, name);
    return `{{${name}}}`;
  };
  const amt = (c: Cents) => token("AMOUNT", formatMoney(c));
  const date = (d: IsoDate) => token("DATE", formatDate(d));

  const issues: ModelIssue[] = sub.issues.map((i, idx) => {
    const base = { n: idx + 1, ruleId: i.ruleId, project: i.projectName, invoice: i.invoiceNo };
    switch (i.ruleId) {
      case "R01":
        return { ...base, problem: `We have no lien waiver on file for this ${amt(i.amountCents)} payment.`, needed: `a signed ${i.paid ? "unconditional" : "conditional"} progress lien waiver for ${amt(i.amountCents)} through ${date(i.periodEnd)}` };
      case "R02":
        return { ...base, problem: `The waiver amount (${amt(i.waiverAmountCents ?? 0)}) is short of the ${amt(i.amountCents)} payment by ${amt(i.amountCents - (i.waiverAmountCents ?? 0))}.`, needed: `an updated lien waiver for the full amount of ${amt(i.amountCents)}` };
      case "R03":
        return { ...base, problem: `The ${amt(i.amountCents)} payment was made on ${date(i.paidDate ?? i.periodEnd)}, but we only have a conditional waiver.`, needed: `an unconditional progress lien waiver for ${amt(i.amountCents)} through ${date(i.periodEnd)}` };
      case "R04":
        return { ...base, problem: `The waiver runs through ${date(i.throughDate ?? i.periodEnd)}, but this payment covers work through ${date(i.periodEnd)}.`, needed: `a lien waiver with a through date of ${date(i.periodEnd)}` };
      case "R05":
        return { ...base, problem: "The lien waiver we received is not signed.", needed: "a signed copy of the lien waiver" };
      case "R06":
        return { ...base, problem: "This project requires a notarized lien waiver, and the one we received is not notarized.", needed: "a notarized copy of the lien waiver" };
      case "R07":
        return { ...base, problem: `This ${amt(i.amountCents)} payment is the final payment, but we received a progress waiver.`, needed: "a final lien waiver for this project" };
      case "R09":
        return {
          ...base,
          problem: i.coiExpiry ? `The general liability insurance certificate we have on file expired on ${date(i.coiExpiry)}.` : "We don't have a certificate of insurance on file for you.",
          needed: "a current certificate of insurance (general liability) naming us as certificate holder",
        };
      case "R12":
        return { ...base, problem: "The lien waiver we received is hard to read; parts of it are not legible.", needed: "a clear, legible copy of the lien waiver" };
    }
  });
  return { forModel: { contactName: sub.contactName, subcontractor: sub.subName, issues }, tokens };
}

/** Subject and body built only by code, used when the AI draft fails the post-check twice. */
export function codeTemplate(sub: SubIssues): { subject: string; body: string } {
  const { forModel, tokens } = buildWriterInput(sub);
  const fill = (t: string) => t.replace(/\{\{([A-Z]+_\d+)\}\}/g, (_, k: string) => tokens[k] ?? "");
  const lines = forModel.issues.map((i) => fill(`${i.n}. ${i.project}, invoice ${i.invoice}: ${i.problem} Please send ${i.needed}.`));
  return {
    subject: `Documents needed for your payments (${forModel.issues.length} item${forModel.issues.length === 1 ? "" : "s"})`,
    body: [
      `Hi ${sub.contactName},`,
      "",
      "Before we can release or finalize the payments below, we need a few documents from you:",
      "",
      ...lines,
      "",
      "Please reply to this email with the documents attached.",
      "",
      "Thank you,",
      "Accounts Payable",
    ].join("\n"),
  };
}
