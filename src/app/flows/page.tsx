import type { Metadata } from "next";
import { FlowExplorer } from "@/components/app/flows/flow-explorer";
import { footerText, shortSha } from "@/flows/commit";

export const metadata: Metadata = { title: "System flows · LienGuard" };

/** R-22: six system flows, played step by step, each step naming the file that does the work. */
export default function FlowsPage() {
  const sha = shortSha(process.env.NEXT_PUBLIC_COMMIT_SHA);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand">System flows, in motion</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">LienGuard, end to end</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a flow, then play it, step through it, or click any step. Every step names the file that does the work.
          <span className="ml-2 hidden text-xs xl:inline">
            Keys: <kbd className="rounded border px-1">Space</kbd> play/pause · <kbd className="rounded border px-1">←</kbd> <kbd className="rounded border px-1">→</kbd> step ·{" "}
            <kbd className="rounded border px-1">1</kbd>–<kbd className="rounded border px-1">6</kbd> flow
          </span>
        </p>
      </div>
      <FlowExplorer sha={sha} />
      <p className="text-xs text-muted-foreground">{footerText(sha)}</p>
    </div>
  );
}
