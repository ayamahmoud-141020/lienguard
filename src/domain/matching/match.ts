import { normalizeName } from "./normalize";
import { compareDates, daysBetween } from "../dates";
import type { Coi, Payment, Project, Subcontractor, Waiver } from "../types";

export const NAME_MATCH_THRESHOLD = 0.88;

/** Jaro-Winkler similarity in [0, 1]. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aM = new Array<boolean>(a.length).fill(false);
  const bM = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (bM[j] || a[i] !== b[j]) continue;
      aM[i] = bM[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aM[i]) continue;
    while (!bM[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

export type NameCandidate = { key: string; name: string };

/** Best candidate at or above the threshold; null if none, or if two candidates tie for best. */
export function matchByName(raw: string, candidates: NameCandidate[]): { key: string; score: number } | null {
  const n = normalizeName(raw);
  if (!n) return null;
  const scored = candidates
    .map((c) => ({ key: c.key, score: Math.round(jaroWinkler(n, normalizeName(c.name)) * 1000) / 1000 }))
    .sort((x, y) => y.score - x.score);
  const [best, second] = scored;
  if (!best || best.score < NAME_MATCH_THRESHOLD) return null;
  if (second && second.score === best.score) return null;
  return best;
}

export type WaiverMatch = { waiver: Waiver; subCode: string | null; projectCode: string | null; paymentId: string | null; score: number };
export type Unmatched = { documentId: string; fileName: string; reason: string };

function pickPayment(w: Waiver, candidates: Payment[]): Payment | null {
  if (candidates.length === 1 && !w.throughDate) return candidates[0] ?? null;
  if (!w.throughDate || candidates.length === 0) return null;
  const through = w.throughDate;
  const dist = (p: Payment) => Math.abs(daysBetween(p.periodEnd, through));
  const best = Math.min(...candidates.map(dist));
  let tied = candidates.filter((p) => dist(p) === best);
  if (tied.length > 1 && w.scope) tied = tied.filter((p) => p.isFinal === (w.scope === "final"));
  return tied.length === 1 ? (tied[0] ?? null) : null;
}

export function matchDocuments(input: {
  subs: Subcontractor[];
  projects: Project[];
  payments: Payment[];
  waivers: Waiver[];
  cois: Coi[];
}): { waivers: WaiverMatch[]; coiBySub: Map<string, Coi>; unmatched: Unmatched[] } {
  const subCands = input.subs.map((s) => ({ key: s.code, name: s.name }));
  const projCands = input.projects.map((p) => ({ key: p.code, name: p.name }));
  const unmatched: Unmatched[] = [];
  const miss = (d: { documentId: string; fileName: string }, reason: string) => unmatched.push({ documentId: d.documentId, fileName: d.fileName, reason });

  const waivers: WaiverMatch[] = input.waivers.map((w) => {
    const sub = matchByName(w.claimantName, subCands);
    if (!sub) {
      miss(w, "no subcontractor match");
      return { waiver: w, subCode: null, projectCode: null, paymentId: null, score: 0 };
    }
    const proj = matchByName(w.projectName, projCands);
    if (!proj) {
      miss(w, "no project match");
      return { waiver: w, subCode: sub.key, projectCode: null, paymentId: null, score: sub.score };
    }
    const candidates = input.payments.filter((p) => p.subCode === sub.key && p.projectCode === proj.key);
    const payment = pickPayment(w, candidates);
    if (!payment) miss(w, candidates.length ? "no single payment matches the through date" : "no payment for this subcontractor and project");
    return { waiver: w, subCode: sub.key, projectCode: proj.key, paymentId: payment?.id ?? null, score: Math.min(sub.score, proj.score) };
  });

  const coiBySub = new Map<string, Coi>();
  for (const c of input.cois) {
    const sub = matchByName(c.insuredName, subCands);
    if (!sub) {
      miss(c, "no subcontractor match");
      continue;
    }
    const prev = coiBySub.get(sub.key);
    // Keep the certificate with the latest GL expiry.
    if (!prev || (c.glExpiry && (!prev.glExpiry || compareDates(c.glExpiry, prev.glExpiry) > 0))) coiBySub.set(sub.key, c);
  }
  return { waivers, coiBySub, unmatched };
}
