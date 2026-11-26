import { ChevronLeft, MailX } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatchView } from "@/server/batches";
import { listDrafts } from "@/server/drafts";
import { loadEnv } from "@/env";
import { buildDashboard } from "@/view/models";
import { BulkBar, DraftCard, DraftEmailsButton } from "@/app/_components/drafts";
import { EmptyState, PageHeader, Panel } from "@/components/ui/layout";

export const dynamic = "force-dynamic";

export default async function DraftsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await getBatchView(id);
  if (!batch?.result) notFound();
  const drafts = await listDrafts(id);
  const override = loadEnv().DEMO_EMAIL_OVERRIDE;
  const toWrite = new Set(buildDashboard(batch.result).rows.filter((r) => r.decision === "HOLD").map((r) => r.subCode)).size;

  return (
    <div>
      <PageHeader
        back={
          <Link href={`/batches/${id}`} className="inline-flex items-center gap-0.5 text-[13px] text-muted hover:text-ink">
            <ChevronLeft aria-hidden className="size-4" />
            {batch.name}
          </Link>
        }
        title="Follow-up emails"
        description={`One email per subcontractor with payments on hold. The AI writes the wording; code fills in every amount and date and checks them against the data. Nothing is sent until a person approves it.${override ? " Demo: every email goes to one demo inbox." : ""}`}
      />
      {drafts.length === 0 ? (
        <Panel>
          <EmptyState icon={<MailX aria-hidden />} title="No emails drafted yet" action={<DraftEmailsButton batchId={id} existing={0} toWrite={toWrite} />}>
            Draft one email per subcontractor with a payment on hold. You review every one before anything is sent.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 items-start gap-4">
            {drafts.map((d) => (
              <DraftCard key={`${d.id}-${d.status}-${d.body.length}`} draft={d} />
            ))}
          </div>
          <BulkBar drafts={drafts} />
        </>
      )}
    </div>
  );
}
