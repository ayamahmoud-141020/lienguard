"use client";

import { AlertTriangle, Check, CheckCheck, Loader2, Mail, Pencil, Send, ShieldCheck, SkipForward, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { post } from "./client-api";
import type { EmailDraftRecord } from "@/email/workflow";
import { postcheck } from "@/email/postcheck";
import { formatMoney } from "@/domain/money";
import { ruleShort } from "@/view/rule-labels";
import { highlightFilled } from "@/view/highlight";
import { Button, ButtonLink } from "@/components/app/button";
import { Pill } from "@/components/app/status";
import { PasscodeNote, useUnlocked } from "@/components/app/demo-access";
import { cn } from "@/lib/utils";

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

function Preview({ draft, subject, body }: { draft: EmailDraftRecord; subject: string; body: string }) {
  const parts = useMemo(() => highlightFilled(body, draft.issues), [body, draft.issues]);
  return (
    <div className="rounded-lg border bg-subtle">
      <div className="border-b px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">Subject: </span>
        <span className="font-medium text-foreground">{subject}</span>
      </div>
      <div className="whitespace-pre-wrap px-4 py-3 text-[15px] leading-6 text-foreground">
        {parts.map((p, i) =>
          p.filled ? (
            <mark key={i} title="Filled in by code from the payment data" className="num rounded-sm bg-brand-soft px-0.5 font-medium text-brand">
              {p.text}
            </mark>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </div>
    </div>
  );
}

/** Right side of the email review: the selected subcontractor's email, rendered, with an Edit toggle. */
export function DraftDetail({ draft }: { draft: EmailDraftRecord }) {
  const router = useRouter();
  const unlocked = useUnlocked();
  const [editing, setEditing] = useState(false);
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
        setEditing(false);
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
    <article data-slot="card" className="rounded-xl border bg-card shadow-xs">
      <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">
            {draft.issues.subName}
            {draft.kind === "reminder" ? <span className="ml-2 text-sm font-normal text-muted-foreground">Reminder, drafted by the daily check</span> : null}
          </h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">
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

      <ul className="border-b bg-subtle px-5 py-3">
        {draft.issues.issues.map((i, n) => (
          <li key={`${i.paymentId}-${i.ruleId}-${n}`} className="flex items-baseline gap-2 py-0.5 text-sm">
            <span className="num shrink-0 font-semibold text-hold">{i.ruleId}</span>
            <span className="text-foreground">{ruleShort(i.ruleId)}</span>
            <span className="truncate text-muted-foreground">
              {i.projectName}, invoice {i.invoiceNo}, {formatMoney(i.amountCents)}
            </span>
          </li>
        ))}
      </ul>

      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {editing ? "Editing. Amounts and dates are checked again when you save." : <>Highlighted amounts and dates were filled in by code from the payment data.</>}
          </p>
          {!locked ? (
            <Button size="sm" variant={editing ? "ghost" : "secondary"} onClick={() => (editing ? (setBody(draft.body), setSubject(draft.subject), setEditing(false)) : setEditing(true))}>
              {editing ? <X aria-hidden /> : <Pencil aria-hidden />}
              {editing ? "Cancel" : "Edit"}
            </Button>
          ) : null}
        </div>
        {editing ? (
          <>
            <input aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9 w-full rounded-md border border-input px-3 text-sm font-medium" />
            <textarea
              aria-label="Email body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="max-h-[520px] min-h-[220px] w-full resize-y rounded-md border border-input px-3 py-2 text-[15px] leading-6 [field-sizing:content]"
            />
          </>
        ) : (
          <Preview draft={draft} subject={subject} body={body} />
        )}
        {!check.ok ? <p className="rounded-md border border-warn-line bg-warn-bg px-3 py-2 text-sm text-warn">{check.problems.join("; ")}</p> : null}
        {draft.error ? <p className="rounded-md border border-hold-line bg-hold-bg px-3 py-2 text-sm text-hold">Last send failed: {draft.error}</p> : null}
        <p className="text-xs text-muted-foreground">
          {draft.kind === "reminder"
            ? "Reminder written by code from the issues still open. Nothing is sent until a person approves it."
            : draft.source === "ai"
              ? "Wording by AI. Every amount and date was filled in by code."
              : "Code template: the AI draft didn't pass the number check."}
        </p>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
        {locked ? (
          <p className="flex items-center gap-1.5 text-sm text-safe">
            <CheckCheck aria-hidden className="size-4" />
            <span>
              {`Sent ${when(draft.sentAt)}`}
              {draft.approvedBy ? <span className="text-muted-foreground">{`, approved by ${draft.approvedBy}`}</span> : null}
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
            {draft.status === "approved" && draft.approvedBy ? <span className="text-xs text-muted-foreground">Approved by {draft.approvedBy}</span> : null}
            {dirty || draft.status === "approved" || editing ? <PasscodeNote className="ml-auto" /> : null}
          </>
        )}
      </footer>
    </article>
  );
}

/** Master–detail email review: subcontractor list on the left, the selected email on the right. */
export function EmailsWorkspace({ drafts }: { drafts: EmailDraftRecord[] }) {
  const [selected, setSelected] = useState(drafts[0]?.id ?? "");
  const current = drafts.find((d) => d.id === selected) ?? drafts[0];
  return (
    <div className="grid grid-cols-[320px_minmax(0,1fr)] items-start gap-4">
      <nav aria-label="Subcontractors" className="sticky top-[calc(var(--header-height)+1rem)] rounded-xl border bg-card shadow-xs">
        <p className="border-b px-4 py-3 text-sm font-semibold">Subcontractors</p>
        <ul className="p-1.5">
          {drafts.map((d) => {
            const pill = statusPill[d.status] ?? statusPill.draft!;
            const active = d.id === current?.id;
            return (
              <li key={d.id}>
                <button
                  onClick={() => setSelected(d.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn("flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2.5 text-left", active ? "bg-accent" : "hover:bg-muted")}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {d.issues.subName}
                      {d.kind === "reminder" ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">Reminder</span> : null}
                    </span>
                    <span className="num block text-xs text-muted-foreground">
                      {d.issues.issues.length} issue{d.issues.issues.length === 1 ? "" : "s"}, {d.issues.contactName}
                    </span>
                  </span>
                  <Pill tone={pill.tone} className="shrink-0">
                    {pill.label}
                  </Pill>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      {current ? <DraftDetail key={`${current.id}-${current.status}-${current.body.length}`} draft={current} /> : null}
    </div>
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
    <div className="sticky bottom-0 z-20 -mx-4 mt-5 border-t bg-card/95 px-4 py-3 backdrop-blur lg:-mx-6 lg:px-6">
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
