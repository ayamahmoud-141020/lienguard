import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatchView } from "@/server/batches";
import { buildPaymentDetail } from "@/view/models";
import { Badge } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await params;
  const batch = await getBatchView(id);
  if (!batch?.result) notFound();
  const detail = buildPaymentDetail(batch.result, paymentId);
  if (!detail) notFound();
  const { row } = detail;
  const firstPdf = detail.documents.find((d) => d.kind === "waiver") ?? detail.documents[0];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/batches/${id}`} className="text-xs text-slate-500 hover:underline">
          ← {batch.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {row.sub} · {row.invoice}
          </h1>
          <Badge decision={row.decision} />
        </div>
        <p className="text-sm text-slate-600">
          {row.project} · {row.amount} · paid {row.paidDate} · exposed{" "}
          <b className={row.exposedCents ? "text-red-700" : ""}>{row.exposed}</b>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-4 py-2 text-sm font-semibold">Rule checks</h2>
            <ul className="divide-y divide-slate-100">
              {detail.rules.map((r) => (
                <li key={r.ruleId} className="flex gap-3 px-4 py-2.5 text-sm">
                  <span className="w-10 shrink-0 font-mono text-xs text-slate-500">{r.ruleId}</span>
                  <div className="flex-1">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-slate-600">{r.message}</div>
                  </div>
                  <div className="shrink-0">
                    <Badge decision={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Matched documents</h2>
            {detail.documents.length === 0 ? <p className="mt-2 text-sm text-slate-500">No documents matched this payment.</p> : null}
            <ul className="mt-2 space-y-2 text-sm">
              {detail.documents.map((d) => (
                <li key={d.id}>
                  <a className="font-mono text-xs text-sky-700 underline" href={`/api/documents/${d.id}/pdf`} target="_blank" rel="noreferrer">
                    {d.fileName}
                  </a>{" "}
                  <span className="text-xs uppercase text-slate-500">{d.kind}</span>
                  {d.needsReview ? <div className="text-xs text-amber-800">Needs review: {d.reviewReasons.join("; ")}</div> : null}
                  {d.notes ? <div className="text-xs text-slate-500">AI note: {d.notes}</div> : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="min-h-[600px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {firstPdf ? (
            <iframe title={firstPdf.fileName} src={`/api/documents/${firstPdf.id}/pdf`} className="h-[720px] w-full" />
          ) : (
            <p className="p-6 text-sm text-slate-500">No document to preview.</p>
          )}
        </section>
      </div>
    </div>
  );
}
