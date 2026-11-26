import { formatMoney } from "@/domain/money";
import type { BatchResult } from "@/pipeline/evaluate";
import type { RuleResult } from "@/domain/rules";

export type DashboardRow = {
  paymentId: string;
  sub: string;
  subCode: string;
  project: string;
  projectCode: string;
  invoice: string;
  amount: string;
  paidDate: string;
  decision: "SAFE" | "HOLD";
  readyToPay: boolean;
  rules: string[];
  reasons: string[];
  exposed: string;
  exposedCents: number;
};

export type Dashboard = {
  exposed: string;
  exposedCents: number;
  safe: number;
  hold: number;
  readyToPay: number;
  needsReview: number;
  byProject: { code: string; name: string; exposed: string; exposedCents: number }[];
  rows: DashboardRow[];
  unmatched: BatchResult["unmatched"];
};

export function buildDashboard(r: BatchResult): Dashboard {
  const rows: DashboardRow[] = r.payments.map((p) => ({
    paymentId: p.payment.id,
    sub: p.sub?.name ?? p.payment.subCode,
    subCode: p.payment.subCode,
    project: p.project?.name ?? p.payment.projectCode,
    projectCode: p.payment.projectCode,
    invoice: p.payment.invoiceNo,
    amount: formatMoney(p.payment.amountCents),
    paidDate: p.payment.paidDate ?? "not paid",
    decision: p.evaluation.decision,
    readyToPay: p.evaluation.decision === "SAFE" && p.payment.paidDate === null,
    rules: p.evaluation.findings.map((f) => f.ruleId),
    reasons: p.evaluation.findings.map((f) => f.message),
    exposed: formatMoney(p.evaluation.exposedCents),
    exposedCents: p.evaluation.exposedCents,
  }));
  const projects = new Map<string, { code: string; name: string; exposedCents: number }>();
  for (const row of rows) {
    const e = projects.get(row.projectCode) ?? { code: row.projectCode, name: row.project, exposedCents: 0 };
    e.exposedCents += row.exposedCents;
    projects.set(row.projectCode, e);
  }
  return {
    exposed: formatMoney(r.exposedCents),
    exposedCents: r.exposedCents,
    safe: r.counts.safe,
    hold: r.counts.hold,
    readyToPay: r.counts.readyToPay,
    needsReview: r.counts.needsReview,
    byProject: [...projects.values()].map((p) => ({ ...p, exposed: formatMoney(p.exposedCents) })).sort((a, b) => b.exposedCents - a.exposedCents),
    rows,
    unmatched: r.unmatched,
  };
}

export type PaymentDetail = {
  row: DashboardRow;
  documents: { id: string; fileName: string; kind: string; needsReview: boolean; reviewReasons: string[]; notes: string }[];
  rules: RuleResult[];
};

export function buildPaymentDetail(r: BatchResult, paymentId: string): PaymentDetail | null {
  const p = r.payments.find((x) => x.payment.id === paymentId);
  const row = buildDashboard(r).rows.find((x) => x.paymentId === paymentId);
  if (!p || !row) return null;
  const documents = r.documents
    .filter((d) => p.documentIds.includes(d.id))
    .map(({ id, fileName, kind, needsReview, reviewReasons, notes }) => ({ id, fileName, kind, needsReview, reviewReasons, notes }));
  return { row, documents, rules: p.evaluation.results };
}
