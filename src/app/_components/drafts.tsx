"use client";

import { AlertTriangle, Check, CheckCheck, Loader2, Mail, Send, ShieldCheck, SkipForward } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { post } from "./client-api";
import type { EmailDraftRecord } from "@/email/workflow";
import { postcheck } from "@/email/postcheck";
import { formatMoney } from "@/domain/money";
import { ruleShort } from "@/view/rule-labels";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pill } from "@/components/ui/status";
import { PasscodeNote, useUnlocked } from "@/components/app/demo-access";
import { cn } from "@/components/ui/cn";

/** Batch page CTA: write the drafts (open to everyone), or open them if they exist. */
export function DraftEmailsButton({ batchId, existing, toWrite }: { batchId: string; existing: number; toWrite: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (existing > 0) {
    return (
      <ButtonLink href={`/batches/${batchId}/drafts`} variant="primary">
        <Mail aria-hidden />
        Review follow-up emails ({existing})
      </ButtonLink>
    );
  }
  if (toWrite === 0) {
    return (
      <Button variant="primary" disabled>
        <Mail aria-hidden />
        No follow-up emails needed
      </Button>
    );
  }
  return (
    <Button
      variant="primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await post<{ created: number }>(`/api/batches/${batchId}/drafts`);
          toast.success(`Drafted ${r.created} follow-up email${r.created === 1 ? "" : "s"}`);
          router.push(`/batches/${batchId}/drafts`);
        } catch (e) {
          toast.error((e as Error).message);
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Mail aria-hidden />}
      {busy ? "Drafting emails…" : `Draft follow-up emails (${toWrite})`}
    </Button>
  );
}

const statusPill: Record<string, { tone: "neutral" | "brand" | "safe" | "hold"; label: string }> = {
  draft: { tone: "neutral", label: "Draft" },
  approved: { tone: "brand", label: "Approved" },
  skipped: { tone: "neutral", label: "Skipped" },
  sent: { tone: "safe", label: "Sent" },
  failed: { tone: "hold", label: "Send failed" },
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "";

export function DraftCard({ draft }: { draft: EmailDraftRecord }) {
  const router = useRouter();
  const unlocked = useUnlocked();
  const [body, setBody] = useState(draft.body);
  const [subject, setSubject] = useState(draft.subject);
  const [busy, setBusy] = useState("");
  const dirty = body !== draft.body || subject !== draft.subject;
  const locked = draft.status === "sent";
  const check = useMemo(() => postcheck(`${subject}\n${body}`, draft.issues), [subject, body, draft.issues]);
  const pill = statusPill[draft.status] ?? statusPill.draft!;

  const act = async (action: "approve" | "skip" | "send" | "edit") => {
    setBusy(action);
    try {
      if (action === "edit") {
        const r = await post<{ warnings: string[] }>(`/api/drafts/${draft.id}/edit`, { body, subject });
        if (r.warnings.length) toast.warning(`Saved with ${r.warnings.length} warning${r.warnings.length === 1 ? "" : "s"}: check the numbers before sending`);
        else toast.success("Edit saved");
      } else {
        await post(`/api/drafts/${draft.id}/${action}`);
        toast.success(action === "approve" ? `Approved email to ${draft.issues.subName}` : action === "skip" ? `Skipped ${draft.issues.subName}` : `Sent email to ${draft.issues.subName}`);
      }
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy("");
  };

  return (
    <article className="rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{draft.issues.subName}</h3>
          <p className="mt-0.5 truncate text-xs text-muted">
            To {draft.issues.contactName}, {draft.toAddress}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {check.ok ? (
            <Pill tone="safe" icon={<ShieldCheck aria-hidden />}>
              All numbers verified
            </Pill>
          ) : (
            <Pill tone="warn" icon={<AlertTriangle aria-hidden />}>
              Check numbers
            </Pill>
          )}
          <Pill tone={pill.tone}>{pill.label}</Pill>
        </div>
      </header>

      <ul className="border-b border-line bg-subtle px-4 py-2.5">
        {draft.issues.issues.map((i, n) => (
          <li key={`${i.paymentId}-${i.ruleId}-${n}`} className="flex items-baseline gap-2 py-0.5 text-[13px]">
            <span className="num shrink-0 font-semibold text-hold">{i.ruleId}</span>
            <span className="text-ink">{ruleShort(i.ruleId)}</span>
            <span className="truncate text-muted">
              {i.projectName}, invoice {i.invoiceNo}, {formatMoney(i.amountCents)}
            </span>
          </li>
        ))}
      </ul>

      <div className="space-y-2 p-4">
        <input
          aria-label="Subject"
          disabled={locked}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-9 w-full rounded-[6px] border border-line-strong px-2.5 text-[13px] font-medium disabled:bg-subtle"
        />
        <textarea
          aria-label="Email body"
          disabled={locked}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="max-h-[480px] min-h-[160px] w-full resize-y rounded-[6px] [field-sizing:content] border border-line-strong px-2.5 py-2 text-[13px] leading-5 text-ink disabled:bg-subtle"
        />
        {!check.ok ? (
          <p className="rounded-[6px] border border-warn-line bg-warn-bg px-2.5 py-2 text-xs text-warn">{check.problems.join("; ")}</p>
        ) : null}
        {draft.error ? <p className="rounded-[6px] border border-hold-line bg-hold-bg px-2.5 py-2 text-xs text-hold">Last send failed: {draft.error}</p> : null}
        <p className="text-xs text-muted">
          {draft.source === "ai" ? "Wording by AI. Every amount and date was filled in by code." : "Code template: the AI draft didn't pass the number check."}
        </p>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        {locked ? (
          <p className="flex items-center gap-1.5 text-[13px] text-safe">
            <CheckCheck aria-hidden className="size-4" />
            <span>
              {`Sent ${when(draft.sentAt)}`}
              {draft.approvedBy ? <span className="text-muted">{`, approved by ${draft.approvedBy}`}</span> : null}
            </span>
          </p>
        ) : (
          <>
            {dirty ? (
              <Button size="sm" variant="primary" disabled={!!busy || !unlocked} onClick={() => act("edit")}>
                {busy === "edit" ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
                Save edit
              </Button>
            ) : null}
            {draft.status === "draft" && !dirty ? (
              <Button size="sm" variant="primary" disabled={!!busy} onClick={() => act("approve")}>
                <Check aria-hidden />
                Approve
              </Button>
            ) : null}
            {(draft.status === "approved" || (draft.status === "failed" && draft.approvedBy)) && !dirty ? (
              <Button size="sm" variant="primary" disabled={!!busy || !unlocked} onClick={() => act("send")}>
                {busy === "send" ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}
                {draft.status === "failed" ? "Retry send" : "Send"}
              </Button>
            ) : null}
            {draft.status !== "skipped" ? (
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act("skip")}>
                <SkipForward aria-hidden />
                Skip
              </Button>
            ) : null}
            {draft.status === "approved" && draft.approvedBy ? <span className="text-xs text-muted">Approved by {draft.approvedBy}</span> : null}
            {dirty || draft.status === "approved" ? <PasscodeNote className="ml-auto" /> : null}
          </>
        )}
      </footer>
    </article>
  );
}

/** Sticky bar: approve everything still in draft, then send what's approved. */
export function BulkBar({ drafts }: { drafts: EmailDraftRecord[] }) {
  const router = useRouter();
  const unlocked = useUnlocked();
  const [busy, setBusy] = useState("");
  const toApprove = drafts.filter((d) => d.status === "draft");
  const toSend = drafts.filter((d) => d.status === "approved" || (d.status === "failed" && d.approvedBy));
  const sent = drafts.filter((d) => d.status === "sent").length;

  const run = async (kind: "approve" | "send") => {
    setBusy(kind);
    const targets = kind === "approve" ? toApprove : toSend;
    let ok = 0;
    const failures: string[] = [];
    for (const d of targets) {
      try {
        await post(`/api/drafts/${d.id}/${kind}`);
        ok++;
      } catch (e) {
        failures.push(`${d.issues.subName}: ${(e as Error).message}`);
      }
    }
    if (ok) toast.success(kind === "approve" ? `Approved ${ok} email${ok === 1 ? "" : "s"}` : `Sent ${ok} email${ok === 1 ? "" : "s"}`);
    if (failures.length) toast.error(failures.join("\n"));
    setBusy("");
    router.refresh();
  };

  return (
    <div className="sticky bottom-0 z-20 -mx-8 mt-5 border-t border-line bg-surface/95 px-8 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <p className="num text-[13px] text-ink-2">
          {drafts.length} emails: {toApprove.length} to review, {toSend.length} approved, {sent} sent
        </p>
        <div className={cn("ml-auto flex items-center gap-2")}>
          <PasscodeNote />
          <Button disabled={!!busy || toApprove.length === 0} onClick={() => run("approve")}>
            {busy === "approve" ? <Loader2 aria-hidden className="animate-spin" /> : <CheckCheck aria-hidden />}
            Approve all ({toApprove.length})
          </Button>
          <Button variant="primary" disabled={!!busy || toSend.length === 0 || !unlocked} onClick={() => run("send")}>
            {busy === "send" ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}
            Send approved ({toSend.length})
          </Button>
        </div>
      </div>
    </div>
  );
}
