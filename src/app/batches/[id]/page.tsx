import { AlertOctagon, AlertTriangle, ChevronLeft, FileClock, FileQuestion, Info } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatchView } from "@/server/batches";
import { listDrafts } from "@/server/drafts";
import { buildDashboard } from "@/view/models";
import { formatMoney } from "@/domain/money";
import { formatDate } from "@/domain/dates";
import { SAMPLE_NOTE } from "@/view/copy";
import { Processing } from "@/app/_components/processing";
import { PaymentsTable } from "@/app/_components/payments-table";
import { DraftEmailsButton } from "@/app/_components/drafts";
import { KpiStrip } from "@/components/app/kpis";
import { ExposureBars } from "@/components/app/exposure-bars";
import { HoldsByReasonChart, SafeVsHoldChart } from "@/components/app/batch-charts";
import { decisionSplit, holdsByReason } from "@/view/charts";
import { ButtonLink } from "@/components/app/button";
import { PageHeader, Panel, PanelHeader } from "@/components/app/layout";
import { BatchStatusBadge } from "@/components/app/status";

export const dynamic = "force-dynamic";

function Back() {
  return (
    <Link href="/" className="inline-flex items-center gap-0.5 text-[13px] text-muted-foreground hover:text-ink">
      <ChevronLeft aria-hidden className="size-4" />
      Batches
    </Link>
  );
}

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await getBatchView(id);
  if (!batch) notFound();
  const subtitle = `Rules applied as of ${formatDate(batch.today)} (demo date). ${batch.kind === "sample" ? "Sample data." : "Uploaded batch."}`;

  if (batch.status === "failed") {
    return (
      <div>
        <PageHeader back={<Back />} title={batch.name} description={subtitle} actions={<BatchStatusBadge status="failed" />} />
        <Panel className="flex gap-3 border-hold-line bg-hold-bg px-5 py-4">
          <AlertOctagon aria-hidden className="mt-0.5 size-5 shrink-0 text-hold" />
          <div>
            <p className="text-sm font-semibold text-hold">This batch could not be checked</p>
            <p className="mt-1 text-[13px] text-ink-2">{batch.error ?? "The rules could not be applied."}</p>
            <p className="mt-2 text-[13px] text-ink-2">Every payment in it should be treated as on hold. Upload the batch again, or start from the sample data.</p>
          </div>
        </Panel>
      </div>
    );
  }

  if (batch.status === "processing" || !batch.result) {
    return (
      <div>
        <PageHeader back={<Back />} title={batch.name} description={subtitle} actions={<BatchStatusBadge status="processing" />} />
        <Processing batchId={id} documents={batch.documents} />
      </div>
    );
  }

  const d = buildDashboard(batch.result);
  const drafts = await listDrafts(id);
  const subsWithHold = new Set(d.rows.filter((r) => r.decision === "HOLD").map((r) => r.subCode)).size;
  const projects = d.byProject.map((p) => ({ ...p, hold: d.rows.filter((r) => r.projectCode === p.code && r.decision === "HOLD").length }));

  return (
    <div className="space-y-4">
      <PageHeader
        back={<Back />}
        title={batch.name}
        description={subtitle}
        actions={
          <>
            <ButtonLink href={`/batches/${id}/audit`} variant="ghost">
              <FileClock aria-hidden />
              Audit log
            </ButtonLink>
            <DraftEmailsButton batchId={id} existing={drafts.length} toWrite={subsWithHold} />
          </>
        }
      />

      {batch.kind === "sample" ? (
        <p className="flex gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm text-ink-2">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {SAMPLE_NOTE}
        </p>
      ) : null}
      {batch.notice ? (
        <p role="status" className="flex gap-2 rounded-xl border border-warn-line bg-warn-bg px-4 py-2.5 text-sm font-medium text-warn">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {batch.notice}
        </p>
      ) : null}

      <KpiStrip
        exposed={d.exposed}
        exposedCents={d.exposedCents}
        hold={d.hold}
        safe={d.safe}
        readyToPay={d.readyToPay}
        needsReview={d.needsReview}
        total={d.rows.length}
      />

      <div className="grid grid-cols-3 items-stretch gap-4">
        <Panel>
          <PanelHeader title="Holds by reason" description="Payments on hold, per failed rule" />
          <div className="px-3 py-3">
            <HoldsByReasonChart data={holdsByReason(batch.result)} />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Safe vs Hold" description={`${d.rows.length} payments in this batch`} />
          <div className="px-5 py-5">
            <SafeVsHoldChart {...decisionSplit(batch.result)} />
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Exposed by project" description={`${formatMoney(d.exposedCents)} at risk across ${projects.length} projects`} />
          <div className="px-5 py-5">
            <ExposureBars projects={projects} totalCents={d.exposedCents} />
          </div>
        </Panel>
      </div>

      {d.unmatched.length ? (
        <Panel>
          <PanelHeader title="Documents not matched" description="These couldn't be tied to a payment, so they count as needing review." />
          <ul className="divide-y divide-line">
            {d.unmatched.map((u) => (
              <li key={u.documentId} className="flex gap-2 px-4 py-2.5 text-[13px]">
                <FileQuestion aria-hidden className="mt-0.5 size-4 shrink-0 text-review" />
                <span className="text-ink-2">
                  <span className="font-medium text-ink">{u.fileName}</span>: {u.reason}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title="Payments" description="Open a payment to see every rule check and the documents behind it." />
        <PaymentsTable batchId={id} rows={d.rows} />
      </Panel>
    </div>
  );
}
