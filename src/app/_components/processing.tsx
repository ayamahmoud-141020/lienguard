"use client";

import { CheckCircle2, CircleDashed, CircleHelp, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { post } from "./client-api";
import { runQueue, type QueueStatus } from "@/lib/queue";
import { Panel, PanelHeader } from "@/components/ui/layout";
import { PasscodeNote } from "@/components/app/demo-access";
import { cn } from "@/components/ui/cn";

type Doc = { id: string; fileName: string; status: string };

const view: Record<QueueStatus, { label: string; icon: React.ReactNode; cls: string }> = {
  queued: { label: "Waiting", icon: <CircleDashed aria-hidden />, cls: "text-muted" },
  reading: { label: "Reading", icon: <Loader2 aria-hidden className="animate-spin" />, cls: "text-ink-2" },
  done: { label: "Read", icon: <CheckCircle2 aria-hidden />, cls: "text-safe" },
  "needs review": { label: "Needs review", icon: <CircleHelp aria-hidden />, cls: "text-review" },
};

/** Sends one extraction request per PDF (max 4 in flight), then applies the rules. Unchanged logic, new look. */
export function Processing({ batchId, documents }: { batchId: string; documents: Doc[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<Record<string, QueueStatus>>(() =>
    Object.fromEntries(documents.map((d) => [d.id, d.status === "done" ? "done" : d.status === "needs_review" ? "needs review" : "queued"])),
  );
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"reading" | "deciding" | "failed">("reading");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const todo = documents.filter((d) => d.status === "queued").map((d) => d.id);
    (async () => {
      try {
        await runQueue(
          todo,
          4,
          async (id) => (await post<{ status: "done" | "needs review" }>(`/api/batches/${batchId}/documents/${id}/extract`)).status,
          (id, s) => setStatus((prev) => ({ ...prev, [id]: s })),
        );
        setPhase("deciding");
        await post(`/api/batches/${batchId}/evaluate`);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
        setPhase("failed");
      }
    })();
  }, [batchId, documents, router]);

  const done = Object.values(status).filter((s) => s === "done" || s === "needs review").length;
  const pct = documents.length ? Math.round((done / documents.length) * 100) : 0;
  return (
    <Panel>
      <PanelHeader
        title={phase === "deciding" ? "Applying the rules" : "Reading documents"}
        description="One request per PDF, four at a time. A document that can't be read with confidence goes to review, never silently passes."
        actions={
          <span className="num text-[13px] font-medium text-ink-2">
            {done} of {documents.length}
          </span>
        }
      />
      <div className="px-4 pt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-[#eef1f4]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        {error ? (
          <div className="mt-3 rounded-[6px] border border-hold-line bg-hold-bg px-3 py-2 text-[13px] text-hold">
            {error}
            <PasscodeNote className="mt-1" />
          </div>
        ) : null}
      </div>
      <ul className="mt-3 grid grid-cols-2 border-t border-line">
        {documents.map((d, i) => {
          const s = view[status[d.id] ?? "queued"];
          return (
            <li key={d.id} className={cn("flex h-10 items-center justify-between gap-3 border-b border-line px-4 text-[13px]", i % 2 === 0 && "border-r")}>
              <span className="flex min-w-0 items-center gap-2 text-ink">
                <FileText aria-hidden className="size-4 shrink-0 text-muted" />
                <span className="truncate">{d.fileName}</span>
              </span>
              <span className={cn("flex shrink-0 items-center gap-1 text-xs font-medium [&_svg]:size-3.5", s.cls)}>
                {s.icon}
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
