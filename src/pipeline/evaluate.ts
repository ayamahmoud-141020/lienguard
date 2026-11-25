import { toDocument, type DocumentRead } from "@/ai/to-document";
import type { ExtractOutcome } from "@/ai/extractor";
import { matchDocuments, type Unmatched } from "@/domain/matching/match";
import { batchExposure, evaluatePayment, type PaymentEvaluation } from "@/domain/rules";
import { stateConfigFor } from "@/domain/rules/config";
import type { Coi, Payment, Project, Subcontractor, Waiver } from "@/domain/types";

export type BatchInput = {
  projects: Project[];
  subs: Subcontractor[];
  payments: Payment[];
};

export type ExtractedDocument = { id: string; fileName: string; outcome: ExtractOutcome };

export type DocumentSummary = {
  id: string;
  fileName: string;
  kind: DocumentRead["kind"];
  needsReview: boolean;
  reviewReasons: string[];
  notes: string;
  matchedPaymentId: string | null;
  matchedSubCode: string | null;
};

export type PaymentRow = {
  payment: Payment;
  project: Project | null;
  sub: Subcontractor | null;
  evaluation: PaymentEvaluation;
  documentIds: string[];
};

export type BatchResult = {
  today: string;
  exposedCents: number;
  counts: { safe: number; hold: number; readyToPay: number; needsReview: number };
  payments: PaymentRow[];
  documents: DocumentSummary[];
  unmatched: Unmatched[];
};

function read(d: ExtractedDocument): DocumentRead {
  if (d.outcome.ok) return toDocument(d.outcome.extraction, { documentId: d.id, fileName: d.fileName });
  return { kind: "unknown", needsReview: true, reviewReasons: [d.outcome.reason], waiver: null, coi: null, notes: "" };
}

/** Pure: extracted documents + spreadsheets + today → decisions. No I/O, no LLM. */
export function evaluateBatch(input: BatchInput, docs: ExtractedDocument[], today: string): BatchResult {
  const reads = docs.map((d) => ({ doc: d, read: read(d) }));
  const waivers: Waiver[] = reads.flatMap((r) => (r.read.waiver ? [r.read.waiver] : []));
  const cois: Coi[] = reads.flatMap((r) => (r.read.coi ? [r.read.coi] : []));
  const m = matchDocuments({ subs: input.subs, projects: input.projects, payments: input.payments, waivers, cois });

  const unknown: Unmatched[] = reads
    .filter((r) => r.read.kind === "unknown")
    .map((r) => ({ documentId: r.doc.id, fileName: r.doc.fileName, reason: r.read.reviewReasons.join("; ") }));

  const payments: PaymentRow[] = input.payments.map((payment) => {
    const project = input.projects.find((p) => p.code === payment.projectCode) ?? null;
    const sub = input.subs.find((s) => s.code === payment.subCode) ?? null;
    const matched = m.waivers.filter((w) => w.paymentId === payment.id).map((w) => w.waiver);
    const coi = m.coiBySub.get(payment.subCode) ?? null;
    const state = project?.state ?? "default";
    const evaluation = evaluatePayment({ payment, state, stateConfig: stateConfigFor(state), waivers: matched, coi, today });
    return { payment, project, sub, evaluation, documentIds: [...matched.map((w) => w.documentId), ...(coi ? [coi.documentId] : [])] };
  });

  const documents: DocumentSummary[] = reads.map(({ doc, read: r }) => {
    const wm = m.waivers.find((w) => w.waiver.documentId === doc.id);
    const coiSub = [...m.coiBySub.entries()].find(([, c]) => c.documentId === doc.id)?.[0] ?? null;
    const unmatched = m.unmatched.find((u) => u.documentId === doc.id);
    return {
      id: doc.id,
      fileName: doc.fileName,
      kind: r.kind,
      needsReview: r.needsReview || Boolean(unmatched),
      reviewReasons: [...r.reviewReasons, ...(unmatched ? [unmatched.reason] : [])],
      notes: r.notes,
      matchedPaymentId: wm?.paymentId ?? null,
      matchedSubCode: wm?.subCode ?? coiSub,
    };
  });

  const evals = payments.map((p) => p.evaluation);
  return {
    today,
    exposedCents: batchExposure(evals),
    counts: {
      safe: evals.filter((e) => e.decision === "SAFE").length,
      hold: evals.filter((e) => e.decision === "HOLD").length,
      readyToPay: payments.filter((p) => p.evaluation.decision === "SAFE" && p.payment.paidDate === null).length,
      needsReview: documents.filter((d) => d.needsReview).length,
    },
    payments,
    documents,
    unmatched: [...m.unmatched, ...unknown],
  };
}
