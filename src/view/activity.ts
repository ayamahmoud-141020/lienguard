import { formatMoney } from "@/domain/money";
import { formatDate } from "@/domain/dates";

export type ActivityItem = { kind: "document" | "rerun" | "safe" | "hold" | "notify" | "not_sent" | "reminder" | "digest" | "email" | "other"; text: string; tone?: "safe" | "hold" };

/** Who did it, as shown in the timeline (AC-20.1). */
export function activitySource(actor: string): string {
  return actor === "automation" ? "Automation" : actor;
}

const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));

/** One timeline event as a plain sentence (AC-20.1). Display only. */
export function activityItem(action: string, x: Record<string, unknown>, subCode: string | null): ActivityItem {
  switch (action) {
    case "document.received":
      return { kind: "document", text: `Document received: ${s(x.fileName)} (${s(x.read) || "read"})` };
    case "document.duplicate":
      return { kind: "document", text: `Same document received again: ${s(x.fileName)}. Nothing changed.` };
    case "rules.rerun": {
      const when = typeof x.today === "string" ? `, batch date ${formatDate(x.today)}` : "";
      const reason = x.reason ? ` (${s(x.reason)}${when})` : "";
      const exposed = typeof x.exposedCents === "number" ? ` Exposed ${formatMoney(x.exposedCents)}.` : "";
      return { kind: "rerun", text: `Rules re-run${reason}.${exposed}` };
    }
    case "payment.status_changed": {
      const safe = x.to === "SAFE";
      return { kind: safe ? "safe" : "hold", tone: safe ? "safe" : "hold", text: `${s(x.sub)}, invoice ${s(x.invoice)}: ${s(x.from)} → ${s(x.to)}` };
    }
    case "notification.sent":
      return { kind: "notify", text: `Notified the AP inbox: “${s(x.text)}”` };
    case "notification.not_sent":
      return { kind: "not_sent", text: `AP notification not sent (${s(x.reason)}): “${s(x.text)}”` };
    case "reminder.drafted":
      return { kind: "reminder", text: `Reminder drafted for ${s(x.sub)}. Waiting for a person to approve it.` };
    case "digest.sent":
      return { kind: "digest", text: `Daily digest sent to the AP inbox (${s(x.newHolds) || "0"} new holds, ${s(x.cleared) || "0"} cleared).` };
    case "batch.create_sample":
      return { kind: "document", text: "Created from sample data" };
    case "email.generate_drafts":
      return { kind: "email", text: `Follow-up emails drafted (${s(x.created)})` };
    case "email.approve":
      return { kind: "email", text: `Approved the email to ${subCode ?? "a subcontractor"}` };
    case "email.send":
      return { kind: "email", text: `Sent the email to ${subCode ?? "a subcontractor"}` };
    case "email.skip":
      return { kind: "email", text: `Skipped the email to ${subCode ?? "a subcontractor"}` };
    case "email.edit":
      return { kind: "email", text: `Edited the email to ${subCode ?? "a subcontractor"}` };
    default:
      return { kind: "other", text: action };
  }
}
