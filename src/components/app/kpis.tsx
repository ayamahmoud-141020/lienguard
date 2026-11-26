import { CheckCircle2, CircleHelp, OctagonX } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

function Cell({ label, value, hint, icon, tone }: { label: string; value: ReactNode; hint: string; icon: ReactNode; tone: "hold" | "safe" | "review" }) {
  const color = tone === "hold" ? "text-hold" : tone === "safe" ? "text-safe" : "text-review";
  return (
    <div className="px-5 py-4">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
        <span className={cn("[&_svg]:size-4", color)}>{icon}</span>
        {label}
      </p>
      <p className="num mt-2 text-[28px] font-semibold leading-8 tracking-[-0.02em] text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

/**
 * One connected strip: the exposed dollars lead (largest, red); the three counts follow.
 */
export function KpiStrip(props: { exposed: string; exposedCents: number; hold: number; safe: number; readyToPay: number; needsReview: number; total: number }) {
  return (
    <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] divide-x divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
      <div className="relative px-5 py-4">
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] rounded-l-[var(--radius-card)] bg-hold" />
        <p className="text-[13px] font-medium text-ink-2">Exposed</p>
        <p className={cn("num mt-1 text-[40px] font-semibold leading-[44px] tracking-[-0.025em]", props.exposedCents ? "text-hold" : "text-safe")}>{props.exposed}</p>
        <p className="mt-1 text-xs text-muted">Paid but not covered by a valid waiver. Could be paid twice if a lien is filed.</p>
      </div>
      <Cell tone="hold" icon={<OctagonX aria-hidden />} label="Payments on hold" value={props.hold} hint={`of ${props.total} payments have at least one problem`} />
      <Cell tone="safe" icon={<CheckCircle2 aria-hidden />} label="Safe to pay" value={props.safe} hint={`${props.readyToPay} not paid yet and ready to release`} />
      <Cell tone="review" icon={<CircleHelp aria-hidden />} label="Docs needing review" value={props.needsReview} hint="Couldn't be read with confidence, so they hold" />
    </div>
  );
}
