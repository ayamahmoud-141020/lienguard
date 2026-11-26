"use client";

// Data-table pattern from shadcn/ui dashboard-01 (TanStack Table, MIT): filters, search, sortable columns,
// sticky header and row hover. Same content and wording as before.
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDownUp, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { DashboardRow } from "@/view/models";
import { ruleShort } from "@/view/rule-labels";
import { DecisionBadge } from "@/components/app/status";
import { Tooltip } from "@/components/app/primitives";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** "2026-11-14" → "Nov 14, 2026" (display only). */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const ALL = "__all";

function SortHeader({ label, right, onClick }: { label: string; right?: boolean; onClick: () => void }) {
  return (
    <button className={cn("inline-flex items-center gap-1 hover:text-foreground", right && "ml-auto")} onClick={onClick}>
      {label}
      <ArrowDownUp aria-hidden className="size-3.5 opacity-60" />
    </button>
  );
}

const cents = (money: string) => Number(money.replace(/[$,]/g, ""));

export function PaymentsTable({ batchId, rows }: { batchId: string; rows: DashboardRow[] }) {
  const router = useRouter();
  const [decision, setDecision] = useState("");
  const [project, setProject] = useState(ALL);
  const [rule, setRule] = useState(ALL);
  const [q, setQ] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const options = useMemo(() => ({ projects: [...new Set(rows.map((r) => r.project))].sort(), rules: [...new Set(rows.flatMap((r) => r.rules))].sort() }), [rows]);
  const holdCount = rows.filter((r) => r.decision === "HOLD").length;

  const data = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!decision || r.decision === decision) &&
        (project === ALL || r.project === project) &&
        (rule === ALL || r.rules.includes(rule)) &&
        (!needle || `${r.sub} ${r.invoice} ${r.project}`.toLowerCase().includes(needle)),
    );
  }, [rows, decision, project, rule, q]);

  const columns = useMemo<ColumnDef<DashboardRow>[]>(
    () => [
      {
        accessorKey: "sub",
        header: ({ column }) => <SortHeader label="Subcontractor" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => <span className="font-medium text-foreground">{row.original.sub}</span>,
      },
      { accessorKey: "project", header: "Project", cell: ({ row }) => <span className="text-ink-2">{row.original.project}</span> },
      { accessorKey: "invoice", header: "Invoice", cell: ({ row }) => <span className="num whitespace-nowrap text-ink-2">{row.original.invoice}</span> },
      {
        id: "amount",
        accessorFn: (r) => cents(r.amount),
        header: ({ column }) => <SortHeader label="Amount" right onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => <span className="num block whitespace-nowrap text-right">{row.original.amount}</span>,
      },
      {
        accessorKey: "paidDate",
        header: "Paid",
        cell: ({ row }) =>
          row.original.paidDate === "not paid" ? (
            <span className="text-muted-foreground">Not paid</span>
          ) : (
            <span className="num whitespace-nowrap text-ink-2">{shortDate(row.original.paidDate)}</span>
          ),
      },
      { accessorKey: "decision", header: "Decision", cell: ({ row }) => <DecisionBadge decision={row.original.decision} /> },
      {
        id: "reasons",
        header: "Reasons",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.rules.map((id, i) => (
              <Tooltip key={id} content={row.original.reasons[i]}>
                <span
                  tabIndex={0}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md border border-hold-line bg-hold-bg px-1.5 text-xs text-hold"
                >
                  <span className="num font-semibold">{id}</span>
                  <span>{ruleShort(id)}</span>
                </span>
              </Tooltip>
            ))}
            {row.original.rules.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                {row.original.readyToPay ? <span className="font-medium text-safe">Ready to pay. </span> : null}All checks passed
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "exposed",
        accessorFn: (r) => r.exposedCents,
        header: ({ column }) => <SortHeader label="Exposed" right onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
        cell: ({ row }) => (
          <span className={cn("num block whitespace-nowrap text-right font-semibold", row.original.exposedCents ? "text-hold" : "text-muted-foreground")}>{row.original.exposed}</span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({ data, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  const open = (id: string) => router.push(`/batches/${batchId}/payments/${id}`);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <ToggleGroup type="single" variant="outline" size="sm" value={decision || "all"} onValueChange={(v) => setDecision(v === "all" || !v ? "" : v)} aria-label="Decision">
          <ToggleGroupItem value="all" className="px-3">
            All {rows.length}
          </ToggleGroupItem>
          <ToggleGroupItem value="HOLD" className="px-3">
            Hold {holdCount}
          </ToggleGroupItem>
          <ToggleGroupItem value="SAFE" className="px-3">
            Safe {rows.length - holdCount}
          </ToggleGroupItem>
        </ToggleGroup>
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger size="sm" className="w-52" aria-label="Project">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All projects</SelectItem>
            {options.projects.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={rule} onValueChange={setRule}>
          <SelectTrigger size="sm" className="w-52" aria-label="Rule">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All reasons</SelectItem>
            {options.rules.map((r) => (
              <SelectItem key={r} value={r}>
                {r} {ruleShort(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="relative ml-auto">
          <span className="sr-only">Search</span>
          <Search aria-hidden className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search subcontractor or invoice" className="h-8 w-64 pl-8" />
        </label>
      </div>
      <table className="w-full text-sm">
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((h) => (
                <TableHead
                  key={h.id}
                  className={cn("sticky top-(--header-height) z-10 bg-muted px-3 text-xs font-medium text-muted-foreground", (h.id === "amount" || h.id === "exposed") && "text-right")}
                >
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              tabIndex={0}
              onClick={() => open(row.original.paymentId)}
              onKeyDown={(e) => e.key === "Enter" && open(row.original.paymentId)}
              className="cursor-pointer focus-visible:bg-muted/60"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="px-3 py-2.5">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </table>
      {data.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">No payments match these filters. Clear the search or pick All.</p> : null}
    </div>
  );
}
