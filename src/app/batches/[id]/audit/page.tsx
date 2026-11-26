import { ChevronLeft, FileClock } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatchView } from "@/server/batches";
import { listAudit } from "@/server/drafts";
import { EmptyState, PageHeader, Panel } from "@/components/app/layout";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  "batch.create_sample": "Created batch from sample data",
  "batch.create_upload": "Created batch from upload",
  "batch.evaluate": "Applied rules",
  "email.generate_drafts": "Drafted follow-up emails",
  "email.approve": "Approved email",
  "email.edit": "Edited email",
  "email.skip": "Skipped email",
  "email.send": "Sent email",
  "email.send_failed": "Email send failed",
};

function details(d: unknown): string {
  if (!d || typeof d !== "object") return "";
  return Object.entries(d as Record<string, unknown>)
    .map(([k, v]) => `${k === "exposedCents" ? "exposed" : k} ${k === "exposedCents" && typeof v === "number" ? `$${(v / 100).toLocaleString("en-US")}` : String(v)}`)
    .join(", ");
}

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await getBatchView(id);
  if (!batch) notFound();
  const rows = await listAudit(id);
  const th = "h-9 px-4 text-left text-xs font-medium text-muted-foreground";
  return (
    <div>
      <PageHeader
        back={
          <Link href={`/batches/${id}`} className="inline-flex items-center gap-0.5 text-[13px] text-muted-foreground hover:text-ink">
            <ChevronLeft aria-hidden className="size-4" />
            {batch.name}
          </Link>
        }
        title="Audit log"
        description="Every action on this batch and its emails, newest first. Times are UTC."
      />
      <Panel>
        {rows.length === 0 ? (
          <EmptyState icon={<FileClock aria-hidden />} title="No actions recorded yet">
            Approving, editing, skipping and sending emails will show up here.
          </EmptyState>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="border-b border-line bg-subtle">
              <tr>
                <th className={th}>Time</th>
                <th className={th}>Action</th>
                <th className={th}>Subcontractor</th>
                <th className={th}>Details</th>
                <th className={th}>By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="h-10 border-b border-line last:border-0">
                  <td className="num whitespace-nowrap px-4 text-ink-2">{r.at.toISOString().slice(0, 19).replace("T", " ")}</td>
                  <td className="px-4 font-medium text-ink">{labels[r.action] ?? r.action}</td>
                  <td className="px-4 text-ink-2">{r.subCode ?? "–"}</td>
                  <td className="num px-4 text-muted-foreground">{details(r.detailsJson) || "–"}</td>
                  <td className="px-4 text-ink-2">{r.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
