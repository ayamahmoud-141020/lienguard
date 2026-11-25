import Link from "next/link";
import { listBatches } from "@/server/batches";
import { formatMoney } from "@/domain/money";
import { SampleButton, UploadForm } from "./_components/new-batch";
import { Empty } from "./_components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const batches = await listBatches();
  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Is it safe to pay?</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          LienGuard reads the lien waivers and insurance certificates your subcontractors sent, checks them against this month&apos;s payments, and tells
          you which payments are <b className="text-emerald-700">SAFE</b> and which to <b className="text-red-700">HOLD</b>, with the reason and the dollars
          at risk. Then it drafts the follow-up emails for a person to approve.
        </p>
        <div className="mt-5 flex flex-wrap items-start gap-6">
          <div>
            <SampleButton />
            <p className="mt-2 max-w-xs text-xs text-slate-500">12 fictional payments, 17 PDFs: waivers in three styles, insurance certificates, a blurry scan and a prompt-injection test.</p>
          </div>
          <details className="min-w-80 flex-1 rounded-lg border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold">Or upload your own batch</summary>
            <div className="mt-3">
              <UploadForm />
            </div>
          </details>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Batches</h2>
        {batches.length === 0 ? (
          <Empty>No batches yet. Click “Use sample data” to try it.</Empty>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Created</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">On hold</th>
                  <th className="px-4 py-2 text-right">Exposed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium">
                      <Link className="hover:underline" href={`/batches/${b.id}`}>
                        {b.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{b.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</td>
                    <td className="px-4 py-2 text-slate-600">{b.status}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{b.hold ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-red-700">{b.exposedCents === null ? "—" : formatMoney(b.exposedCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
