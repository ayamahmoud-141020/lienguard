"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "./client-api";

export function SampleButton() {
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
            const { id } = await post<{ id: string }>("/api/batches/sample");
            router.push(`/batches/${id}`);
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-60"
      >
        {busy ? "Creating…" : "Use sample data"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export function UploadForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
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
          router.push(`/batches/${id}`);
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm">
        <span className="font-medium">Batch name</span>
        <input name="name" placeholder="December payments" className="mt-1 block w-full rounded border border-slate-300 px-2 py-1.5" />
      </label>
      <label className="block text-sm">
        <span className="font-medium">payments.xlsx</span> <span className="text-slate-500">(sheets: Payments, Projects)</span>
        <input required name="payments" type="file" accept=".xlsx" className="mt-1 block text-sm" />
      </label>
      <label className="block text-sm">
        <span className="font-medium">subcontractors.xlsx</span>
        <input required name="subcontractors" type="file" accept=".xlsx" className="mt-1 block text-sm" />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Waivers and insurance certificates</span> <span className="text-slate-500">(PDF, max 4 MB each)</span>
        <input name="pdfs" type="file" accept="application/pdf" multiple className="mt-1 block text-sm" />
      </label>
      <button disabled={busy} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60">
        {busy ? "Uploading…" : "Upload and check"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
