import { formatMoney } from "@/domain/money";
import { formatDate } from "@/domain/dates";
import type { DecisionChange } from "./diff";

export type DigestInput = {
  date: string;
  batches: { name: string; exposedCents: number; newHolds: DecisionChange[]; cleared: DecisionChange[]; waitingDrafts: number }[];
};
export type DigestTotals = { newHolds: number; cleared: number; exposedCents: number; waiting: number };

/** The daily digest for the AP inbox (AC-19.4). Every number comes from the data. */
export function buildDigest(i: DigestInput): { subject: string; text: string; totals: DigestTotals } {
  const totals: DigestTotals = {
    newHolds: i.batches.reduce((s, b) => s + b.newHolds.length, 0),
    cleared: i.batches.reduce((s, b) => s + b.cleared.length, 0),
    exposedCents: i.batches.reduce((s, b) => s + b.exposedCents, 0),
    waiting: i.batches.reduce((s, b) => s + b.waitingDrafts, 0),
  };
  const line = (c: DecisionChange) => `  - ${c.subName}, ${c.invoice}, ${formatMoney(c.amountCents)}`;
  const text = [
    `LienGuard daily check, ${formatDate(i.date)}`,
    "",
    `New holds: ${totals.newHolds}`,
    ...i.batches.flatMap((b) => b.newHolds.map(line)),
    `Cleared holds: ${totals.cleared}`,
    ...i.batches.flatMap((b) => b.cleared.map(line)),
    `Exposed: ${formatMoney(totals.exposedCents)}`,
    `Drafts waiting for approval: ${totals.waiting}`,
    "",
    ...i.batches.map((b) => `${b.name}: ${formatMoney(b.exposedCents)} exposed, ${b.waitingDrafts} draft${b.waitingDrafts === 1 ? "" : "s"} waiting`),
    "",
    "Nothing is sent to a subcontractor until a person approves it.",
  ].join("\n");
  return { subject: `LienGuard daily check: ${totals.newHolds} new holds, ${totals.cleared} cleared, ${formatMoney(totals.exposedCents)} exposed`, text, totals };
}

/** Post-check: the headline numbers in the text must equal the totals computed from the data. */
export function checkDigest(text: string, t: DigestTotals): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const num = (label: string) => Number(new RegExp(`^${label}: (\\d+)$`, "m").exec(text)?.[1] ?? NaN);
  if (num("New holds") !== t.newHolds) problems.push("new holds count does not match the data");
  if (num("Cleared holds") !== t.cleared) problems.push("cleared holds count does not match the data");
  if (num("Drafts waiting for approval") !== t.waiting) problems.push("drafts waiting does not match the data");
  if (!new RegExp(`^Exposed: ${formatMoney(t.exposedCents).replace(/[$.]/g, "\\$&")}$`, "m").test(text)) problems.push("exposed amount does not match the data");
  return { ok: problems.length === 0, problems };
}
