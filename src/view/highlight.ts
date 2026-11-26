import { formatMoney } from "@/domain/money";
import { formatDate } from "@/domain/dates";
import { allowedValues, type SubIssues } from "@/email/issues";

export type Segment = { text: string; filled: boolean };

/** Splits an email body into plain text and the amounts/dates that code filled in from the data (AC-17.3). */
export function highlightFilled(body: string, sub: SubIssues): Segment[] {
  const { cents, dates } = allowedValues(sub);
  const tokens = [...[...cents].map(formatMoney), ...[...dates].map(formatDate)].sort((a, b) => b.length - a.length);
  if (tokens.length === 0) return [{ text: body, filled: false }];
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Whole tokens only: not preceded by a digit or comma, not followed by a digit.
  const re = new RegExp(`(?<![\\d,])(${escaped.join("|")})(?!\\d)`, "g");
  const out: Segment[] = [];
  let last = 0;
  for (const m of body.matchAll(re)) {
    if (m.index > last) out.push({ text: body.slice(last, m.index), filled: false });
    out.push({ text: m[0], filled: true });
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last), filled: false });
  return out;
}
