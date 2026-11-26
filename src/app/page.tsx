import { Inbox } from "lucide-react";
import { listBatches } from "@/server/batches";
import { formatMoney } from "@/domain/money";
import { SampleButton, UploadPanel } from "./_components/new-batch";
import { HowItWorks } from "@/components/app/how-it-works";
import { BatchRows } from "@/components/app/batch-rows";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/layout";

export const dynamic = "force-dynamic";

export default async function Home() {
  const batches = await listBatches();
  return (
    <div className="space-y-5">
      <Panel className="px-6 py-5">
        <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.01em]">Know which subcontractor payments are safe to release.</h1>
        <p className="mt-1 max-w-[72ch] text-[13px] text-muted">
          Try it on a fictional November batch: 12 payments, 17 PDFs, including a blurry scan and a waiver that tries to trick the AI.
        </p>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <SampleButton />
          <UploadPanel />
        </div>
      </Panel>

      <HowItWorks />

      <Panel>
        <PanelHeader title="Batches" description="Each batch is one month's payments and the documents that came with them." />
        {batches.length === 0 ? (
          <EmptyState icon={<Inbox aria-hidden />} title="No batches yet">
            Click Use sample data to check a ready-made batch in a few seconds.
          </EmptyState>
        ) : (
          <BatchRows
            rows={batches.map((b) => ({
              id: b.id,
              name: b.name,
              kind: b.kind,
              created: b.createdAt.toISOString(),
              status: b.status,
              hold: b.hold,
              exposed: b.exposedCents === null ? null : formatMoney(b.exposedCents),
              exposedCents: b.exposedCents,
            }))}
          />
        )}
      </Panel>
    </div>
  );
}
