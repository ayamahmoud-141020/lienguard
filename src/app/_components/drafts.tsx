"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "./client-api";
import type { EmailDraftRecord } from "@/email/workflow";

const statusStyle: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  approved: "bg-sky-100 text-sky-800",
  skipped: "bg-slate-100 text-slate-500",
  sent: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

export function GenerateDrafts({ batchId, label }: { batchId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await post(`/api/batches/${batchId}/drafts`);
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          }
          setBusy(false);
        }}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
      >
        {busy ? "Writing drafts…" : label}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export function BulkActions({ drafts }: { drafts: EmailDraftRecord[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const run = async (kind: "approve" | "send") => {
    setBusy(kind);
    setError("");
    const targets = drafts.filter((d) => (kind === "approve" ? d.status === "draft" : d.status === "approved" || (d.status === "failed" && d.approvedBy)));
    const failures: string[] = [];
    for (const d of targets) {
      try {
        await post(`/api/drafts/${d.id}/${kind}`);
      } catch (e) {
        failures.push(`${d.issues.subName}: ${(e as Error).message}`);
      }
    }
    if (failures.length) setError(failures.join(" · "));
    setBusy("");
    router.refresh();
  };
  const pendingApprove = drafts.filter((d) => d.status === "draft").length;
  const pendingSend = drafts.filter((d) => d.status === "approved").length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button disabled={!!busy || !pendingApprove} onClick={() => run("approve")} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
        {busy === "approve" ? "Approving…" : `Approve all (${pendingApprove})`}
      </button>
      <button disabled={!!busy || !pendingSend} onClick={() => run("send")} className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
        {busy === "send" ? "Sending…" : `Send approved (${pendingSend})`}
      </button>
      {error ? <p className="w-full text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export function DraftCard({ draft }: { draft: EmailDraftRecord }) {
  const router = useRouter();
  const [body, setBody] = useState(draft.body);
  const [subject, setSubject] = useState(draft.subject);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const dirty = body !== draft.body || subject !== draft.subject;
  const locked = draft.status === "sent";

  const act = async (action: "approve" | "skip" | "send" | "edit") => {
    setBusy(action);
    setError("");
    try {
      if (action === "edit") {
        const r = await post<{ warnings: string[] }>(`/api/drafts/${draft.id}/edit`, { body, subject });
        setWarnings(r.warnings);
      } else await post(`/api/drafts/${draft.id}/${action}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy("");
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <div className="font-semibold">{draft.issues.subName}</div>
          <div className="text-xs text-slate-500">
            To: {draft.toAddress} · {draft.issues.issues.length} issue{draft.issues.issues.length === 1 ? "" : "s"} ·{" "}
            {draft.source === "ai" ? "AI wording, numbers filled by code" : "code template (AI draft failed the check)"}
          </div>
        </div>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusStyle[draft.status] ?? ""}`}>
          {draft.status}
          {draft.approvedBy && draft.status !== "draft" ? ` · by ${draft.approvedBy}` : ""}
        </span>
      </header>
      <div className="space-y-2 p-4">
        <input disabled={locked} value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-medium disabled:bg-slate-50" />
        <textarea disabled={locked} value={body} onChange={(e) => setBody(e.target.value)} rows={Math.min(18, body.split("\n").length + 2)} className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-xs leading-relaxed disabled:bg-slate-50" />
        {warnings.length ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <b>Check before sending:</b> {warnings.join("; ")}
          </div>
        ) : null}
        {draft.error ? <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">Last send failed: {draft.error}</div> : null}
        {error ? <div className="text-xs text-red-700">{error}</div> : null}
        {!locked ? (
          <div className="flex flex-wrap gap-2">
            {dirty ? (
              <button disabled={!!busy} onClick={() => act("edit")} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50">
                {busy === "edit" ? "Saving…" : "Save edit"}
              </button>
            ) : null}
            {draft.status === "draft" && !dirty ? (
              <button disabled={!!busy} onClick={() => act("approve")} className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600">
                Approve
              </button>
            ) : null}
            {(draft.status === "approved" || (draft.status === "failed" && draft.approvedBy)) && !dirty ? (
              <button disabled={!!busy} onClick={() => act("send")} className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">
                {busy === "send" ? "Sending…" : draft.status === "failed" ? "Retry send" : "Send"}
              </button>
            ) : null}
            {draft.status !== "skipped" ? (
              <button disabled={!!busy} onClick={() => act("skip")} className="rounded px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                Skip
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-emerald-700">Sent {draft.sentAt?.slice(0, 16).replace("T", " ")} UTC</p>
        )}
      </div>
    </article>
  );
}
