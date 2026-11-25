import type { ReactNode } from "react";

export function Badge({ decision }: { decision: "SAFE" | "HOLD" | "PASS" | "N/A" | "WARN" }) {
  const cls =
    decision === "HOLD"
      ? "bg-red-50 text-red-700 ring-red-600/20"
      : decision === "WARN"
        ? "bg-amber-50 text-amber-800 ring-amber-600/20"
        : decision === "N/A"
          ? "bg-slate-50 text-slate-500 ring-slate-400/20"
          : "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>{decision}</span>;
}

export function RuleChip({ id, title }: { id: string; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-red-800">
      {id}
    </span>
  );
}

export function Card({ label, value, hint, tone = "neutral" }: { label: string; value: ReactNode; hint?: string; tone?: "neutral" | "danger" | "ok" | "warn" }) {
  const color = tone === "danger" ? "text-red-700" : tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{children}</div>;
}
