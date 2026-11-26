"use client";

// The two buttons that let reviewers see the automated loop without curl (AC-18.4, AC-19.1).
import { CalendarClock, Inbox, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { post } from "./client-api";
import { Button } from "@/components/app/button";
import { PasscodeNote, useUnlocked } from "@/components/app/demo-access";

export function AutomationActions({ batchId, isSample, batchDate }: { batchId: string; isSample: boolean; batchDate: string }) {
  const router = useRouter();
  const unlocked = useUnlocked();
  const [busy, setBusy] = useState("");

  const simulate = async () => {
    setBusy("reply");
    try {
      const r = await post<{ changes: { subName: string; invoice: string; to: string }[]; duplicate: boolean; notified: boolean }>(`/api/batches/${batchId}/simulate-reply`);
      if (r.duplicate) toast("That reply was already received. Nothing changed.");
      else if (r.changes.length) {
        const c = r.changes[0]!;
        toast.success(`${c.subName} ${c.invoice} is now ${c.to === "SAFE" ? "safe to pay" : "on hold"}`, {
          description: r.notified ? "The AP inbox was notified." : "AP email not sent: unlock demo access to send it.",
        });
      } else toast("Document received. No payment changed.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy("");
  };

  const daily = async () => {
    setBusy("daily");
    try {
      const r = await post<{ today: string; changes: number; reminders: number; digestSent: boolean }>(`/api/batches/${batchId}/daily-check`);
      toast.success(`Daily check for ${r.today}: ${r.changes} status change${r.changes === 1 ? "" : "s"}, ${r.reminders} reminder${r.reminders === 1 ? "" : "s"} drafted`, {
        description: r.digestSent ? "Digest sent to the AP inbox." : undefined,
      });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy("");
  };

  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
      {isSample ? (
        <div>
          <Button onClick={simulate} disabled={!!busy}>
            {busy === "reply" ? <Loader2 aria-hidden className="animate-spin" /> : <Inbox aria-hidden />}
            Simulate a subcontractor reply
          </Button>
          <p className="mt-1.5 max-w-72 text-xs text-muted-foreground">BlueLine sends a corrected waiver for invoice BLP-2201, as if forwarded from the AP inbox.</p>
        </div>
      ) : null}
      <div>
        <Button onClick={daily} disabled={!!busy || !unlocked}>
          {busy === "daily" ? <Loader2 aria-hidden className="animate-spin" /> : <CalendarClock aria-hidden />}
          Run daily check now
        </Button>
        <p className="mt-1.5 max-w-80 text-xs text-muted-foreground">
          Demo clock: moves this batch from {batchDate} to the next day, re-checks every payment, drafts reminders and sends the digest.
        </p>
        <PasscodeNote className="mt-1" />
      </div>
    </div>
  );
}
