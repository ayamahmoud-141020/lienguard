"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { DashboardRow } from "@/view/models";
import { ruleShort } from "@/view/rule-labels";
import { DecisionBadge } from "@/components/ui/status";
import { Tooltip } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";

/** "2026-11-14" → "Nov 14, 2026" (display only). */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const control = "h-8 rounded-[6px] border border-line-strong bg-surface px-2.5 text-[13px] text-ink";
const th = "sticky top-14 z-10 h-9 border-b border-line bg-subtle px-3 text-left text-xs font-medium text-muted";

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div role="radiogroup" aria-label="Decision" className="inline-flex h-8 rounded-[6px] border border-line-strong bg-subtle p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("rounded-[4px] px-2.5 text-[13px] font-medium", value === o.value ? "bg-surface text-ink shadow-[var(--shadow-card)]" : "text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PaymentsTable({ batchId, rows }: { batchId: string; rows: DashboardRow[] }) {
  const router = useRouter();
  const [decision, setDecision] = useState("");
  const [project, setProject] = useState("");
  const [rule, setRule] = useState("");
  const [q, setQ] = useState("");
  const options = useMemo(
    () => ({ projects: [...new Set(rows.map((r) => r.project))].sort(), rules: [...new Set(rows.flatMap((r) => r.rules))].sort() }),
    [rows],
  );
  const needle = q.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (!decision || r.decision === decision) &&
      (!project || r.project === project) &&
      (!rule || r.rules.includes(rule)) &&
      (!needle || `${r.sub} ${r.invoice} ${r.project}`.toLowerCase().includes(needle)),
  );
  const holdCount = rows.filter((r) => r.decision === "HOLD").length;
  const open = (id: string) => router.push(`/batches/${batchId}/payments/${id}`);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Segmented
          value={decision}
          onChange={setDecision}
          options={[
            { value: "", label: `All ${rows.length}` },
            { value: "HOLD", label: `Hold ${holdCount}` },
            { value: "SAFE", label: `Safe ${rows.length - holdCount}` },
          ]}
        />
        <select aria-label="Project" value={project} onChange={(e) => setProject(e.target.value)} className={control}>
          <option value="">All projects</option>
          {options.projects.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select aria-label="Rule" value={rule} onChange={(e) => setRule(e.target.value)} className={control}>
          <option value="">All reasons</option>
          {options.rules.map((r) => (
            <option key={r} value={r}>
              {r} {ruleShort(r)}
            </option>
          ))}
        </select>
        <label className="relative ml-auto">
          <span className="sr-only">Search</span>
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-2 size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subcontractor or invoice" className={cn(control, "w-64 pl-8")} />
        </label>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr>
            <th className={th}>Subcontractor</th>
            <th className={th}>Project</th>
            <th className={th}>Invoice</th>
            <th className={cn(th, "text-right")}>Amount</th>
            <th className={th}>Paid</th>
            <th className={th}>Decision</th>
            <th className={th}>Reasons</th>
            <th className={cn(th, "text-right")}>Exposed</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr
              key={r.paymentId}
              tabIndex={0}
              onClick={() => open(r.paymentId)}
              onKeyDown={(e) => e.key === "Enter" && open(r.paymentId)}
              className="h-11 cursor-pointer border-b border-line last:border-0 hover:bg-subtle focus-visible:bg-subtle"
            >
              <td className="px-3 py-2 font-medium text-ink">{r.sub}</td>
              <td className="px-3 py-2 text-ink-2">{r.project}</td>
              <td className="num whitespace-nowrap px-3 text-ink-2">{r.invoice}</td>
              <td className="num whitespace-nowrap px-3 text-right text-ink">{r.amount}</td>
              <td className="num whitespace-nowrap px-3 text-ink-2">{r.paidDate === "not paid" ? <span className="text-muted">Not paid</span> : shortDate(r.paidDate)}</td>
              <td className="px-3">
                <DecisionBadge decision={r.decision} />
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {r.rules.map((id, i) => (
                    <Tooltip key={id} content={r.reasons[i]}>
                      <span tabIndex={0} className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-[6px] border border-hold-line bg-hold-bg px-1.5 text-xs text-hold" onClick={(e) => e.stopPropagation()}>
                        <span className="num font-semibold">{id}</span>
                        <span>{ruleShort(id)}</span>
                      </span>
                    </Tooltip>
                  ))}
                  {r.rules.length === 0 ? (
                    <span className="text-xs text-muted">{r.readyToPay ? <span className="font-medium text-safe">Ready to pay. </span> : null}All checks passed</span>
                  ) : null}
                </div>
              </td>
              <td className={cn("num whitespace-nowrap px-3 text-right font-semibold", r.exposedCents ? "text-hold" : "text-muted")}>{r.exposed}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length === 0 ? <p className="px-4 py-10 text-center text-[13px] text-muted">No payments match these filters. Clear the search or pick All.</p> : null}
    </div>
  );
}
