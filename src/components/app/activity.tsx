// Activity timeline (AC-20.1): every automatic and human event on a batch, newest first.
import { Bot, CheckCircle2, FileInput, Mail, MailCheck, MailX, OctagonX, RefreshCw, Send, User } from "lucide-react";
import type { ReactNode } from "react";
import { activityItem, activitySource, type ActivityItem } from "@/view/activity";
import { cn } from "@/lib/utils";

type Row = { id: string; at: Date; actor: string; action: string; detailsJson: unknown; subCode: string | null };

const icons: Record<ActivityItem["kind"], ReactNode> = {
  document: <FileInput aria-hidden />,
  rerun: <RefreshCw aria-hidden />,
  safe: <CheckCircle2 aria-hidden />,
  hold: <OctagonX aria-hidden />,
  notify: <MailCheck aria-hidden />,
  not_sent: <MailX aria-hidden />,
  reminder: <Mail aria-hidden />,
  digest: <Send aria-hidden />,
  email: <Mail aria-hidden />,
  other: <RefreshCw aria-hidden />,
};

const when = (at: Date) => at.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";

export function ActivityTimeline({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return <p className="px-5 py-6 text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="relative px-5 py-4">
      {rows.map((r, i) => {
        const details = r.detailsJson && typeof r.detailsJson === "object" ? (r.detailsJson as Record<string, unknown>) : {};
        const v = activityItem(r.action, details, r.subCode);
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
              {icons[v.kind]}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm text-foreground">{v.text}</p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="num">{when(r.at)}</span>
                <span className="inline-flex items-center gap-1">
                  {auto ? <Bot aria-hidden className="size-3" /> : <User aria-hidden className="size-3" />}
                  {activitySource(r.actor)}
                </span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
