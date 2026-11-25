import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatchView } from "@/server/batches";
import { listAudit } from "@/server/drafts";
import { Empty } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  "batch.create_sample": "Created batch from sample data",
  "batch.create_upload": "Created batch from upload",
  "batch.evaluate": "Applied rules",
  "email.generate_drafts": "Generated email drafts",
  "email.approve": "Approved email",
  "email.edit": "Edited email",
  "email.skip": "Skipped email",
  "email.send": "Sent email",
  "email.send_failed": "Email send failed",
};

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await getBatchView(id);
  if (!batch) notFound();
  const rows = await listAudit(id);
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/batches/${id}`} className="text-xs text-slate-500 hover:underline">
          ← {batch.name}
        </Link>
        <h1 className="text-2xl font-semibold">Audit log</h1>
      </div>
      {rows.length === 0 ? (
        <Empty>No actions recorded yet.</Empty>
      ) : (
        <ol className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex gap-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
              <span className="w-40 shrink-0 font-mono text-xs text-slate-500">{r.at.toISOString().slice(0, 19).replace("T", " ")}</span>
              <span className="flex-1">
                <b>{labels[r.action] ?? r.action}</b>
                {r.subCode ? <span className="text-slate-600"> · {r.subCode}</span> : null}
                {r.detailsJson ? <span className="ml-2 font-mono text-xs text-slate-500">{JSON.stringify(r.detailsJson)}</span> : null}
              </span>
              <span className="text-slate-600">{r.actor}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
