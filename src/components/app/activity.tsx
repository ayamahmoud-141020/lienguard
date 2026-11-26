// Activity timeline (AC-20.1): every automatic and human event on a batch, newest first.
import { Bot, CheckCircle2, FileInput, Mail, MailCheck, MailX, OctagonX, RefreshCw, Send, User } from "lucide-react";
import type { ReactNode } from "react";
import { formatMoney } from "@/domain/money";
import { formatDate } from "@/domain/dates";
import { cn } from "@/lib/utils";

type Row = { id: string; at: Date; actor: string; action: string; detailsJson: unknown; subCode: string | null };

function d(row: Row): Record<string, unknown> {
  return row.detailsJson && typeof row.detailsJson === "object" ? (row.detailsJson as Record<string, unknown>) : {};
}

function describe(row: Row): { icon: ReactNode; text: ReactNode; tone?: "hold" | "safe" } {
  const x = d(row);
  switch (row.action) {
    case "document.received":
      return { icon: <FileInput aria-hidden />, text: <>Document received: <b>{String(x.fileName ?? "")}</b> ({String(x.read ?? "read")})</> };
    case "document.duplicate":
      return { icon: <FileInput aria-hidden />, text: <>Same document received again: {String(x.fileName ?? "")}. Nothing changed.</> };
    case "rules.rerun":
      return {
        icon: <RefreshCw aria-hidden />,
        text: (
          <>
            Rules re-run{x.reason ? ` (${String(x.reason)}${typeof x.today === "string" ? `, batch date ${formatDate(x.today)}` : ""})` : ""}. Exposed{" "}
            {typeof x.exposedCents === "number" ? formatMoney(x.exposedCents) : ""}.
          </>
        ),
      };
    case "payment.status_changed": {
      const toSafe = x.to === "SAFE";
      return {
        icon: toSafe ? <CheckCircle2 aria-hidden /> : <OctagonX aria-hidden />,
        tone: toSafe ? "safe" : "hold",
        text: (
          <>
            <b>{String(x.sub ?? "")}</b>, invoice {String(x.invoice ?? "")}: {String(x.from ?? "")} → <b>{String(x.to ?? "")}</b>
          </>
        ),
      };
    }
    case "notification.sent":
      return { icon: <MailCheck aria-hidden />, text: <>Notified the AP inbox: “{String(x.text ?? "")}”</> };
    case "notification.not_sent":
      return { icon: <MailX aria-hidden />, text: <>AP notification not sent ({String(x.reason ?? "")}): “{String(x.text ?? "")}”</> };
    case "reminder.drafted":
      return { icon: <Mail aria-hidden />, text: <>Reminder drafted for <b>{String(x.sub ?? "")}</b>. Waiting for a person to approve it.</> };
    case "digest.sent":
      return { icon: <Send aria-hidden />, text: <>Daily digest sent to the AP inbox ({String(x.newHolds ?? 0)} new holds, {String(x.cleared ?? 0)} cleared).</> };
    case "batch.create_sample":
      return { icon: <FileInput aria-hidden />, text: <>Created from sample data</> };
    case "email.generate_drafts":
      return { icon: <Mail aria-hidden />, text: <>Follow-up emails drafted ({String(x.created ?? "")})</> };
    case "email.approve":
      return { icon: <CheckCircle2 aria-hidden />, text: <>Approved the email to {row.subCode ?? "a subcontractor"}</> };
    case "email.send":
      return { icon: <Send aria-hidden />, text: <>Sent the email to {row.subCode ?? "a subcontractor"}</> };
    case "email.skip":
      return { icon: <MailX aria-hidden />, text: <>Skipped the email to {row.subCode ?? "a subcontractor"}</> };
    case "email.edit":
      return { icon: <Mail aria-hidden />, text: <>Edited the email to {row.subCode ?? "a subcontractor"}</> };
    default:
      return { icon: <RefreshCw aria-hidden />, text: row.action };
  }
}

const when = (at: Date) => at.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";

export function ActivityTimeline({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="px-5 py-6 text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="relative px-5 py-4">
      {rows.map((r, i) => {
        const v = describe(r);
        const auto = r.actor === "automation";
        return (
          <li key={r.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < rows.length - 1 ? <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-border" /> : null}
            <span
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-card [&_svg]:size-3.5",
                v.tone === "safe" ? "border-safe-line text-safe" : v.tone === "hold" ? "border-hold-line text-hold" : "text-muted-foreground",
              )}
            >
              {v.icon}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm text-foreground">{v.text}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="num">{when(r.at)}</span>
                <span className="ml-1 inline-flex items-center gap-1">
                  {auto ? <Bot aria-hidden className="size-3" /> : <User aria-hidden className="size-3" />}
                  {auto ? "Automation" : r.actor}
                </span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
