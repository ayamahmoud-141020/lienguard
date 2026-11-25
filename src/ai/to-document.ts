import { parseMoney } from "@/domain/money";
import { parseDate } from "@/domain/dates";
import type { Coi, Waiver } from "@/domain/types";
import type { ExtractionT, FieldT } from "./schemas";

export const MIN_CONFIDENCE = 0.7;

export type DocumentRead = {
  kind: "waiver" | "coi" | "unknown";
  needsReview: boolean;
  reviewReasons: string[];
  waiver: Waiver | null;
  coi: Coi | null;
  notes: string;
};

type Meta = { documentId: string; fileName: string };

/** Collects review reasons for required fields that are missing or low-confidence. */
function req<T>(name: string, f: FieldT<T> | null | undefined, reasons: string[]): T | null {
  if (!f || f.value === null) {
    reasons.push(`${name} is missing`);
    return null;
  }
  if (f.confidence < MIN_CONFIDENCE) reasons.push(`${name} is unclear (confidence ${f.confidence.toFixed(2)})`);
  return f.value;
}

/** Turns raw model output into domain objects. Money and dates are parsed by code here, never by the model. */
export function toDocument(x: ExtractionT, meta: Meta): DocumentRead {
  if (x.kind === "waiver" && x.waiver) {
    const w = x.waiver;
    const reasons: string[] = [];
    const claimantName = req("claimantName", w.claimantName, reasons);
    const projectName = req("projectName", w.projectName, reasons);
    const type = req("type", w.type, reasons);
    const scope = req("scope", w.scope, reasons);
    const amountText = req("amount", w.amount, reasons);
    const throughText = req("throughDate", w.throughDate, reasons);
    const signed = req("signed", w.signed, reasons);
    const notarized = req("notarized", w.notarized, reasons);
    let amountCents: number | null = null;
    if (amountText !== null) {
      const m = parseMoney(amountText);
      if (m.ok) amountCents = m.cents;
      else reasons.push(`amount could not be parsed ("${amountText}")`);
    }
    let throughDate: string | null = null;
    if (throughText !== null) {
      const d = parseDate(throughText);
      if (d.ok) throughDate = d.date;
      else reasons.push(`throughDate could not be parsed ("${throughText}")`);
    }
    const waiver: Waiver = {
      ...meta,
      claimantName: claimantName ?? "",
      customerName: w.customerName.value,
      projectName: projectName ?? "",
      type,
      scope,
      amountCents,
      throughDate,
      signed,
      notarized,
      needsReview: reasons.length > 0,
      reviewReasons: reasons,
    };
    return { kind: "waiver", needsReview: waiver.needsReview, reviewReasons: reasons, waiver, coi: null, notes: x.notes };
  }
  if (x.kind === "coi" && x.coi) {
    const reasons: string[] = [];
    const insuredName = req("insuredName", x.coi.insuredName, reasons);
    const expiryText = req("glExpiry", x.coi.glExpiry, reasons);
    let glExpiry: string | null = null;
    if (expiryText !== null) {
      const d = parseDate(expiryText);
      if (d.ok) glExpiry = d.date;
      else reasons.push(`glExpiry could not be parsed ("${expiryText}")`);
    }
    const coi: Coi = { ...meta, insuredName: insuredName ?? "", glExpiry, needsReview: reasons.length > 0, reviewReasons: reasons };
    return { kind: "coi", needsReview: coi.needsReview, reviewReasons: reasons, waiver: null, coi, notes: x.notes };
  }
  return { kind: "unknown", needsReview: true, reviewReasons: ["not recognised as a lien waiver or insurance certificate"], waiver: null, coi: null, notes: x.notes };
}
