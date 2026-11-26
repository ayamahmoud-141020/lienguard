import { daysBetween } from "@/domain/dates";
import { codeTemplate, type SubIssues } from "@/email/issues";

export const REMINDER_AFTER_DAYS = 3;

/**
 * Subcontractors due a reminder (AC-19.3): their follow-up was sent at least 3 batch days ago,
 * no document from them arrived after that, and they have no reminder yet.
 */
export function dueReminders(i: {
  sent: { subCode: string; sentOn: string }[];
  received: { subCode: string | null; receivedOn: string | null }[];
  reminded: Set<string>;
  today: string;
  days?: number;
}): string[] {
  const days = i.days ?? REMINDER_AFTER_DAYS;
  return i.sent
    .filter((s) => !i.reminded.has(s.subCode))
    .filter((s) => daysBetween(s.sentOn, i.today) >= days)
    .filter((s) => !i.received.some((r) => r.subCode === s.subCode && r.receivedOn !== null && daysBetween(s.sentOn, r.receivedOn) > 0))
    .map((s) => s.subCode);
}

/** A reminder written by code from the same issues, so it passes the email post-check. Never sent without approval. */
export function reminderDraft(sub: SubIssues): { subject: string; body: string } {
  const t = codeTemplate(sub);
  const [greeting, ...rest] = t.body.split("\n");
  return {
    subject: `Reminder: ${t.subject}`,
    body: [greeting ?? "", "", "This is a friendly reminder about our earlier email. We are still waiting for the items below.", ...rest].join("\n"),
  };
}
