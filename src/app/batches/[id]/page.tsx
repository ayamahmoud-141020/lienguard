import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatchView } from "@/server/batches";
import { buildDashboard } from "@/view/models";
import { formatDate } from "@/domain/dates";
import { Processing } from "@/app/_components/processing";
import { PaymentsTable } from "@/app/_components/payments-table";
import { Card } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await getBatchView(id);
  if (!batch) notFound();

  const header = (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <Link href="/" className="text-xs text-slate-500 hover:underline">
          ← All batches
        </Link>
        <h1 className="text-2xl font-semibold">{batch.name}</h1>
        <p className="text-sm text-slate-500">Rules applied as of {formatDate(batch.today)} (demo date)</p>
      </div>
      {batch.result ? (
        <div className="flex gap-2">
          <Link href={`/batches/${id}/drafts`} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Email drafts →
          </Link>
          <Link href={`/batches/${id}/audit`} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50">
            Audit log
          </Link>
        </div>
      ) : null}
    </div>
  );

  if (batch.status === "processing" || !batch.result) {
    return (
      <div>
        {header}
        <Processing batchId={id} documents={batch.documents} />
      </div>
    );
  }

  const d = buildDashboard(batch.result);
  const maxProject = Math.max(1, ...d.byProject.map((p) => p.exposedCents));
  return (
    <div className="space-y-6">
      {header}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label="Exposed" value={d.exposed} hint="Paid but not protected by a valid waiver" tone={d.exposedCents ? "danger" : "ok"} />
        <Card label="On hold" value={d.hold} hint="Payments with at least one HOLD reason" tone={d.hold ? "danger" : "ok"} />
        <Card label="Safe" value={d.safe} hint={`${d.readyToPay} ready to pay (not paid yet)`} tone="ok" />
        <Card label="Docs needing review" value={d.needsReview} hint="Couldn't be read with confidence" tone={d.needsReview ? "warn" : "neutral"} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Exposure by project</h2>
        <div className="space-y-2">
          {d.byProject.map((p) => (
            <div key={p.code} className="grid grid-cols-[180px_1fr_110px] items-center gap-3 text-sm">
              <span className="truncate">{p.name}</span>
              <div className="h-3 rounded bg-slate-100">
                <div className="h-3 rounded bg-red-600" style={{ width: `${(p.exposedCents / maxProject) * 100}%` }} />
              </div>
              <span className="text-right tabular-nums">{p.exposed}</span>
            </div>
          ))}
        </div>
      </section>

      {d.unmatched.length ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <h2 className="font-semibold text-amber-900">Documents that couldn&apos;t be matched ({d.unmatched.length})</h2>
          <ul className="mt-2 list-disc pl-5 text-amber-900">
            {d.unmatched.map((u) => (
              <li key={u.documentId}>
                <a className="underline" href={`/api/documents/${u.documentId}/pdf`} target="_blank" rel="noreferrer">
                  {u.fileName}
                </a>
                : {u.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PaymentsTable batchId={id} rows={d.rows} />
    </div>
  );
}
