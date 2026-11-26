"use client";

import { Loader2, Play, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { post } from "./client-api";
import { Button } from "@/components/ui/button";
import { PasscodeNote, useUnlocked } from "@/components/app/demo-access";

export function SampleButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { id } = await post<{ id: string }>("/api/batches/sample");
          toast.success("Sample batch checked");
          router.push(`/batches/${id}`);
        } catch (e) {
          toast.error((e as Error).message);
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Play aria-hidden />}
      {busy ? "Checking sample batch…" : "Use sample data"}
    </Button>
  );
}

const fileInput =
  "mt-1 block w-full text-[13px] text-ink-2 file:mr-3 file:h-8 file:rounded-[6px] file:border file:border-line-strong file:bg-surface file:px-2.5 file:text-[13px] file:font-medium file:text-ink hover:file:bg-subtle";

export function UploadPanel() {
  const router = useRouter();
  const unlocked = useUnlocked();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>
          <Upload aria-hidden />
          Upload your own batch
        </Button>
        <PasscodeNote className="mt-1.5" />
      </div>
    );
  }
  return (
    <form
      className="w-full rounded-[var(--radius-card)] border border-line bg-subtle p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(e.currentTarget);
        const pdfs = form.getAll("pdfs").filter((f): f is File => f instanceof File && f.size > 0);
        form.delete("pdfs");
        try {
          const { id } = await post<{ id: string }>("/api/batches", form);
          for (const pdf of pdfs) {
            const one = new FormData();
            one.set("file", pdf);
            await post(`/api/batches/${id}/documents`, one);
          }
          toast.success(`Uploaded ${pdfs.length} document${pdfs.length === 1 ? "" : "s"}`);
          router.push(`/batches/${id}`);
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-semibold">Upload your own batch</h3>
        <Button type="button" variant="ghost" size="sm" aria-label="Close upload" onClick={() => setOpen(false)}>
          <X aria-hidden />
        </Button>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <label className="block text-[13px] font-medium text-ink-2">
          Batch name
          <input name="name" placeholder="December payments" className="mt-1 block h-9 w-full rounded-[6px] border border-line-strong bg-surface px-2.5 text-sm" />
        </label>
        <label className="block text-[13px] font-medium text-ink-2">
          Payments spreadsheet <span className="font-normal text-muted">(sheets Payments and Projects)</span>
          <input required name="payments" type="file" accept=".xlsx" className={fileInput} />
        </label>
        <label className="block text-[13px] font-medium text-ink-2">
          Subcontractors spreadsheet
          <input required name="subcontractors" type="file" accept=".xlsx" className={fileInput} />
        </label>
        <label className="block text-[13px] font-medium text-ink-2">
          Waivers and insurance certificates <span className="font-normal text-muted">(PDF, up to 4 MB each)</span>
          <input name="pdfs" type="file" accept="application/pdf" multiple className={fileInput} />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy || !unlocked}>
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Upload aria-hidden />}
          {busy ? "Uploading…" : "Upload and check"}
        </Button>
        <PasscodeNote />
      </div>
      {error ? <p className="mt-3 text-[13px] text-hold">{error}</p> : null}
    </form>
  );
}
