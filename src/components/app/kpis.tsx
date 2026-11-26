// KPI cards in the shadcn/ui dashboard-01 "section cards" pattern (MIT), with LienGuard content.
import { CheckCircle2, CircleHelp, OctagonX, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "./cn";

type Props = { exposed: string; exposedCents: number; hold: number; safe: number; readyToPay: number; needsReview: number; total: number };

const pill = {
  hold: "border-hold-line bg-hold-bg text-hold",
  safe: "border-safe-line bg-safe-bg text-safe",
  review: "border-review-line bg-review-bg text-review",
};

export function KpiStrip(p: Props) {
  return (
    <div className="grid grid-cols-[1.25fr_1fr_1fr_1fr] gap-4 *:data-[slot=card]:shadow-xs">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Exposed</CardDescription>
          <CardTitle className={cn("num text-3xl font-semibold tracking-tight", p.exposedCents ? "text-hold" : "text-safe")}>{p.exposed}</CardTitle>
          <CardAction>
            <Badge variant="outline" className={pill.hold} aria-label="At risk" title="At risk">
              <ShieldAlert aria-hidden />
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">Paid but not covered by a valid waiver. Could be paid twice if a lien is filed.</CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Payments on hold</CardDescription>
          <CardTitle className="num text-3xl font-semibold tracking-tight">{p.hold}</CardTitle>
          <CardAction>
            <Badge variant="outline" className={pill.hold} aria-label="Hold" title="Hold">
              <OctagonX aria-hidden />
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">of {p.total} payments have at least one problem</CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Safe to pay</CardDescription>
          <CardTitle className="num text-3xl font-semibold tracking-tight">{p.safe}</CardTitle>
          <CardAction>
            <Badge variant="outline" className={pill.safe} aria-label="Safe" title="Safe">
              <CheckCircle2 aria-hidden />
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">{p.readyToPay} not paid yet and ready to release</CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Docs needing review</CardDescription>
          <CardTitle className="num text-3xl font-semibold tracking-tight">{p.needsReview}</CardTitle>
          <CardAction>
            <Badge variant="outline" className={pill.review} aria-label="Review" title="Review">
              <CircleHelp aria-hidden />
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">Couldn&apos;t be read with confidence, so they hold</CardFooter>
      </Card>
    </div>
  );
}
