import { AlertTriangle, CheckCircle2, ChevronLeft, CircleHelp, ExternalLink, FileText, OctagonX, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBatchView, getDocumentReadings } from "@/server/batches";
import { buildPaymentDetail } from "@/view/models";
import { formatMoney } from "@/domain/money";
import { formatDate } from "@/domain/dates";
import { PageHeader, Panel, PanelHeader } from "@/components/app/layout";
import { DecisionBadge, NeedsReviewBadge, Pill } from "@/components/app/status";
import { cn } from "@/components/app/cn";
import type { ExtractOutcome } from "@/ai/extractor";

export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<string, string> = {
  claimantName: "Claimant",
  customerName: "Customer",
  projectName: "Project",
  type: "Conditional or unconditional",
  scope: "Progress or final",
  amount: "Amount",
  throughDate: "Through date",
  signed: "Signed",
  notarized: "Notarized",
  exceptions: "Exceptions",
  insuredName: "Insured",
  certificateHolder: "Certificate holder",
  glExpiry: "General liability expires",
};

type Field = { key: string; label: string; value: string; confidence: number; sourceText: string };

function fieldsOf(outcome: ExtractOutcome | undefined): Field[] {
  if (!outcome?.ok) return [];
  type Raw = { value: unknown; confidence: number; sourceText: string };
  const block = (outcome.extraction.waiver ?? outcome.extraction.coi ?? {}) as Record<string, Raw | undefined>;
  const present = (e: [string, Raw | undefined]): e is [string, Raw] => e[1] !== undefined;
  return Object.entries(block)
    .filter(present)
    .map(([key, f]) => ({
      key,
      label: FIELD_LABELS[key] ?? key,
      value: f.value === null ? "Not found" : typeof f.value === "boolean" ? (f.value ? "Yes" : "No") : String(f.value),
      confidence: f.confidence,
      sourceText: f.sourceText,
    }));
}

function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const low = value < 0.7;
  return (
    <span className="flex items-center gap-1.5" title={`Confidence ${pct}%${low ? " (below 70%, needs review)" : ""}`}>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[#eef1f4]">
        <span className={cn("block h-full rounded-full", low ? "bg-review" : "bg-ink-2")} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn("num w-8 text-right text-xs", low ? "font-semibold text-review" : "text-muted-foreground")}>{pct}%</span>
    </span>
  );
}

const ruleIcon = {
  PASS: <CheckCircle2 aria-hidden className="size-4 text-safe" />,
  HOLD: <OctagonX aria-hidden className="size-4 text-hold" />,
  WARN: <AlertTriangle aria-hidden className="size-4 text-warn" />,
} as const;

export default async function PaymentPage({ params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const { id, paymentId } = await params;
  const batch = await getBatchView(id);
  if (!batch?.result) notFound();
  const detail = buildPaymentDetail(batch.result, paymentId);
  if (!detail) notFound();
  const { row } = detail;
  const readings = await getDocumentReadings(id, detail.documents.map((d) => d.id));
  const holds = detail.rules.filter((r) => r.status === "HOLD").length;

  return (
    <div>
      <PageHeader
        back={
          <Link href={`/batches/${id}`} className="inline-flex items-center gap-0.5 text-[13px] text-muted-foreground hover:text-ink">
            <ChevronLeft aria-hidden className="size-4" />
            {batch.name}
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {row.sub}, invoice {row.invoice}
            <DecisionBadge decision={row.decision} />
          </span>
        }
        description={`${row.project}. ${row.paidDate === "not paid" ? "Not paid yet." : `Paid ${formatDate(row.paidDate)}.`}`}
      />

      <dl className="mb-5 grid grid-cols-4 divide-x divide-line rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
        {[
          ["Amount", row.amount, "text-ink"],
          ["Exposed", row.exposed, row.exposedCents ? "text-hold" : "text-ink"],
          ["Rule checks", `${detail.rules.length - holds} of ${detail.rules.length} pass`, "text-ink"],
          ["Documents matched", String(detail.documents.length), "text-ink"],
        ].map(([k, v, cls]) => (
          <div key={k} className="px-5 py-3">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className={cn("num mt-0.5 text-lg font-semibold", cls)}>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start gap-5">
        <Panel>
          <PanelHeader title="Rule checks" description="Every rule is plain, tested code. The AI only supplied the values." />
          <ol>
            {detail.rules.map((r) => (
              <li key={r.ruleId} className={cn("flex gap-3 border-b border-line px-4 py-3 last:border-0", r.status === "HOLD" && "bg-hold-bg/40")}>
                <span className="mt-0.5">{ruleIcon[r.status as keyof typeof ruleIcon] ?? ruleIcon.PASS}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-ink">
                    <span className="num mr-1.5 text-muted-foreground">{r.ruleId}</span>
                    {r.name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-2">{r.message}</p>
                </div>
                {r.exposedCents ? <span className="num shrink-0 text-[13px] font-semibold text-hold">{formatMoney(r.exposedCents)}</span> : null}
              </li>
            ))}
          </ol>
        </Panel>

        <div className="space-y-5">
          {detail.documents.length === 0 ? (
            <Panel className="px-5 py-8 text-center text-[13px] text-muted-foreground">No waiver or insurance certificate matched this payment, which is why it is on hold.</Panel>
          ) : null}
          {detail.documents.map((doc) => {
            const fields = fieldsOf(readings.get(doc.id));
            return (
              <Panel key={doc.id}>
                <PanelHeader
                  title={
                    <span className="flex items-center gap-2">
                      <FileText aria-hidden className="size-4 text-muted-foreground" />
                      {doc.fileName}
                    </span>
                  }
                  description={doc.kind === "waiver" ? "Lien waiver" : doc.kind === "coi" ? "Certificate of insurance" : "Unrecognized document"}
                  actions={
                    <>
                      {doc.needsReview ? <NeedsReviewBadge /> : <Pill tone="neutral">Read</Pill>}
                      <a
                        href={`/api/documents/${doc.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-[6px] px-2 text-[13px] font-medium text-brand hover:bg-brand-soft"
                      >
                        Open PDF
                        <ExternalLink aria-hidden className="size-3.5" />
                      </a>
                    </>
                  }
                />
                {doc.needsReview && doc.reviewReasons.length ? (
                  <p className="flex gap-2 border-b border-line bg-review-bg px-4 py-2 text-[13px] text-review">
                    <CircleHelp aria-hidden className="mt-0.5 size-4 shrink-0" />
                    {doc.reviewReasons.join("; ")}
                  </p>
                ) : null}
                {doc.notes ? (
                  <p className="flex gap-2 border-b border-line px-4 py-2 text-[13px] text-ink-2">
                    <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="font-medium text-ink">AI note: </span>
                      {doc.notes}
                    </span>
                  </p>
                ) : null}
                {fields.length ? (
                  <table className="w-full text-[13px]">
                    <thead className="border-b border-line bg-subtle">
                      <tr>
                        <th className="h-8 px-4 text-left text-xs font-medium text-muted-foreground">Field</th>
                        <th className="h-8 px-2 text-left text-xs font-medium text-muted-foreground">Read as</th>
                        <th className="h-8 px-2 text-left text-xs font-medium text-muted-foreground">Confidence</th>
                        <th className="h-8 px-4 text-left text-xs font-medium text-muted-foreground">Source text in the PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f) => (
                        <tr key={f.key} className="border-b border-line align-top last:border-0">
                          <td className="px-4 py-2 text-muted-foreground">{f.label}</td>
                          <td className="num px-2 py-2 font-medium text-ink">{f.value}</td>
                          <td className="px-2 py-2.5">
                            <Confidence value={f.confidence} />
                          </td>
                          <td className="px-4 py-2 text-ink-2">
                            {f.sourceText ? <q className="text-ink-2 [quotes:'“'_'”']">{f.sourceText}</q> : <span className="text-muted-foreground">None</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="px-4 py-4 text-[13px] text-muted-foreground">No fields could be read from this document.</p>
                )}
              </Panel>
            );
          })}
        </div>
      </div>
    </div>
  );
}
