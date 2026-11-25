"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DashboardRow } from "@/view/models";
import { Badge, RuleChip } from "./ui";

export function PaymentsTable({ batchId, rows }: { batchId: string; rows: DashboardRow[] }) {
  const [decision, setDecision] = useState("");
  const [project, setProject] = useState("");
  const [sub, setSub] = useState("");
  const [rule, setRule] = useState("");
  const options = useMemo(
    () => ({
      projects: [...new Set(rows.map((r) => r.project))].sort(),
      subs: [...new Set(rows.map((r) => r.sub))].sort(),
      rules: [...new Set(rows.flatMap((r) => r.rules))].sort(),
    }),
    [rows],
  );
  const shown = rows.filter((r) => (!decision || r.decision === decision) && (!project || r.project === project) && (!sub || r.sub === sub) && (!rule || r.rules.includes(rule)));
  const select = (value: string, set: (v: string) => void, all: string, items: string[]) => (
    <select value={value} onChange={(e) => set(e.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm">
      <option value="">{all}</option>
      {items.map((i) => (
        <option key={i} value={i}>
          {i}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {select(decision, setDecision, "All decisions", ["HOLD", "SAFE"])}
        {select(project, setProject, "All projects", options.projects)}
        {select(sub, setSub, "All subcontractors", options.subs)}
        {select(rule, setRule, "All rules", options.rules)}
        <span className="ml-auto text-xs text-slate-500">{shown.length} of {rows.length} payments</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Subcontractor</th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Invoice</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Paid</th>
              <th className="px-3 py-2">Decision</th>
              <th className="px-3 py-2">Reasons</th>
              <th className="px-3 py-2 text-right">Exposed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((r) => (
              <tr key={r.paymentId} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">
                  <Link className="hover:underline" href={`/batches/${batchId}/payments/${r.paymentId}`}>
                    {r.sub}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-600">{r.project}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.invoice}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.amount}</td>
                <td className="px-3 py-2 text-slate-600">{r.paidDate}</td>
                <td className="px-3 py-2">
                  <Badge decision={r.decision} />
                  {r.readyToPay ? <span className="ml-1 text-xs text-emerald-700">ready to pay</span> : null}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {r.rules.map((id, i) => (
                      <RuleChip key={id} id={id} title={r.reasons[i]} />
                    ))}
                  </div>
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${r.exposedCents ? "font-semibold text-red-700" : "text-slate-400"}`}>{r.exposed}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No payments match these filters.</p> : null}
      </div>
    </div>
  );
}
