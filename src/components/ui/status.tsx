import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, OctagonX, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type Status = "safe" | "hold" | "warn" | "review" | "neutral" | "brand";

const tones: Record<Status, string> = {
  safe: "bg-safe-bg text-safe ring-safe-line",
  hold: "bg-hold-bg text-hold ring-hold-line",
  warn: "bg-warn-bg text-warn ring-warn-line",
  review: "bg-review-bg text-review ring-review-line",
  neutral: "bg-subtle text-ink-2 ring-line",
  brand: "bg-brand-soft text-brand ring-[#bcd9cc]",
};

export function Pill({ tone, icon, children, className }: { tone: Status; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-[6px] px-2 text-xs font-medium ring-1 ring-inset [&_svg]:size-3.5", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/** Decision for a payment or a single rule. */
export function DecisionBadge({ decision }: { decision: "SAFE" | "HOLD" | "PASS" | "WARN" }) {
  if (decision === "HOLD") return <Pill tone="hold" icon={<OctagonX aria-hidden />}>Hold</Pill>;
  if (decision === "WARN") return <Pill tone="warn" icon={<AlertTriangle aria-hidden />}>Warn</Pill>;
  if (decision === "PASS") return <Pill tone="safe" icon={<CheckCircle2 aria-hidden />}>Pass</Pill>;
  return <Pill tone="safe" icon={<CheckCircle2 aria-hidden />}>Safe</Pill>;
}

export function NeedsReviewBadge() {
  return <Pill tone="review" icon={<CircleHelp aria-hidden />}>Needs review</Pill>;
}

/** Batch lifecycle status. */
export function BatchStatusBadge({ status }: { status: string }) {
  if (status === "ready") return <Pill tone="neutral" icon={<CheckCircle2 aria-hidden className="text-safe" />}>Ready</Pill>;
  if (status === "failed") return <Pill tone="hold" icon={<XCircle aria-hidden />}>Failed</Pill>;
  return <Pill tone="neutral" icon={<Loader2 aria-hidden className="animate-spin" />}>Reading documents</Pill>;
}
