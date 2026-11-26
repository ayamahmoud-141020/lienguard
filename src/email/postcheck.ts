import { formatMoney, parseMoney } from "@/domain/money";
import { parseDate } from "@/domain/dates";
import type { RuleId } from "@/domain/types";
import { allowedValues, type SubIssues } from "./issues";

/** Each issue must be recognisable in the email: its invoice number plus a phrase for its rule. */
export const REQUIRED_PHRASE: Record<RuleId, RegExp> = {
  R01: /waiver/i,
  R02: /amount|short/i,
  R03: /unconditional/i,
  R04: /through/i,
  R05: /sign/i,
  R06: /notar/i,
  R07: /final/i,
  R09: /insurance/i,
  R12: /legible|readable/i,
};

const AMOUNT = /\$\s?\d[\d,]*(?:\.\d{1,2})?/g;
const DATES = [
  /\b\d{4}-\d{2}-\d{2}\b/g,
  /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/g,
];

export type PostcheckResult = { ok: boolean; problems: string[] };

/** Rejects any amount or date not in the data, leftover placeholders, and missing issues. */
export function postcheck(text: string, sub: SubIssues, opts: { requireAllIssues?: boolean } = {}): PostcheckResult {
  const { cents, dates } = allowedValues(sub);
  const problems: string[] = [];
  for (const m of text.match(AMOUNT) ?? []) {
    const r = parseMoney(m.replace(/\s/g, ""));
    if (!r.ok || !cents.has(r.cents)) problems.push(`amount ${m} is not in the payment data`);
  }
  for (const re of DATES) {
    for (const m of text.match(re) ?? []) {
      const r = parseDate(m.replace(/^(Sept)/, "Sep"));
      if (!r.ok || !dates.has(r.date)) problems.push(`date ${m} is not in the payment data`);
    }
  }
  const left = text.match(/\{\{[^}]*\}\}/g);
  if (left) problems.push(`unfilled placeholders: ${left.join(", ")}`);
  if (opts.requireAllIssues !== false) {
    for (const i of sub.issues) {
      if (!text.includes(i.invoiceNo) || !REQUIRED_PHRASE[i.ruleId].test(text)) problems.push(`issue ${i.ruleId} for invoice ${i.invoiceNo} is not clearly mentioned`);
    }
  }
  return { ok: problems.length === 0, problems: [...new Set(problems)] };
}

export function fillPlaceholders(template: string, tokens: Record<string, string>): { ok: true; text: string } | { ok: false; error: string } {
  const unknown: string[] = [];
  const text = template.replace(/\{\{([A-Z]+_\d+)\}\}/g, (whole, key: string) => {
    const v = tokens[key];
    if (v === undefined) unknown.push(whole);
    return v ?? whole;
  });
  return unknown.length ? { ok: false, error: `unknown placeholders: ${unknown.join(", ")}` } : { ok: true, text };
}

export { formatMoney };
