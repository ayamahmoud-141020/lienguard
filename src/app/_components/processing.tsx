"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { post } from "./client-api";
import { runQueue, type QueueStatus } from "@/lib/queue";

type Doc = { id: string; fileName: string; status: string };

const label: Record<QueueStatus, string> = { queued: "Queued", reading: "Reading…", done: "Done", "needs review": "Needs review" };
const tone: Record<QueueStatus, string> = {
  queued: "text-slate-500",
  reading: "text-sky-700",
  done: "text-emerald-700",
  "needs review": "text-amber-700",
};

/** Sends one extraction request per PDF (max 4 in flight), then re-runs the rules. */
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
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reading documents</h2>
        <span className="text-sm text-slate-600 tabular-nums">
          {done} / {documents.length} {phase === "deciding" ? "· applying rules…" : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-slate-200">
        <div className="h-full bg-emerald-600 transition-all" style={{ width: `${documents.length ? (done / documents.length) * 100 : 0}%` }} />
      </div>
      {error ? <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {documents.map((d) => {
          const s = status[d.id] ?? "queued";
          return (
            <li key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="font-mono text-xs">{d.fileName}</span>
              <span className={`font-medium ${tone[s]}`}>{label[s]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
