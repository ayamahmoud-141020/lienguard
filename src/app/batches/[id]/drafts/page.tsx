import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatchView } from "@/server/batches";
import { listDrafts } from "@/server/drafts";
import { loadEnv } from "@/env";
import { BulkActions, DraftCard, GenerateDrafts } from "@/app/_components/drafts";
import { Empty } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

export default async function DraftsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await getBatchView(id);
  if (!batch?.result) notFound();
  const drafts = await listDrafts(id);
  const override = loadEnv().DEMO_EMAIL_OVERRIDE;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/batches/${id}`} className="text-xs text-slate-500 hover:underline">
            ← {batch.name}
          </Link>
          <h1 className="text-2xl font-semibold">Follow-up emails</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            One email per subcontractor with payments on hold. The AI writes the wording; every amount and date is filled in by code and checked against
            the data. Nothing is sent until a person approves it.
          </p>
          {override ? <p className="mt-1 text-xs font-medium text-amber-700">Demo mode: every email is redirected to the demo inbox.</p> : null}
        </div>
        {drafts.length ? <BulkActions drafts={drafts} /> : null}
      </div>
      {drafts.length === 0 ? (
        <Empty>
          <p className="mb-4">No drafts yet for this batch.</p>
          <div className="flex justify-center">
            <GenerateDrafts batchId={id} label="Generate drafts" />
          </div>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {drafts.map((d) => (
            <DraftCard key={`${d.id}-${d.status}-${d.body.length}`} draft={d} />
          ))}
        </div>
      )}
    </div>
  );
}
