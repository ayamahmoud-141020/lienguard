"use client";

import { useRouter } from "next/navigation";
import { BatchStatusBadge } from "@/components/ui/status";

type Row = { id: string; name: string; kind: string; created: string; status: string; hold: number | null; exposed: string | null; exposedCents: number | null };

const th = "h-9 px-4 text-left text-xs font-medium text-muted";

/** Batches table: the whole row opens the batch (Enter works too). */
export function BatchRows({ rows }: { rows: Row[] }) {
  const router = useRouter();
  return (
    <table className="w-full text-[13px]">
      <thead className="border-b border-line bg-subtle">
        <tr>
          <th className={th}>Batch</th>
          <th className={th}>Created</th>
          <th className={th}>Status</th>
          <th className={`${th} text-right`}>On hold</th>
          <th className={`${th} text-right`}>Exposed</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((b) => (
          <tr
            key={b.id}
            tabIndex={0}
            onClick={() => router.push(`/batches/${b.id}`)}
            onKeyDown={(e) => e.key === "Enter" && router.push(`/batches/${b.id}`)}
            className="h-11 cursor-pointer border-b border-line last:border-0 hover:bg-subtle focus-visible:bg-subtle"
          >
            <td className="px-4">
              <span className="font-medium text-ink">{b.name}</span>
              <span className="ml-2 text-xs text-muted">{b.kind === "sample" ? "Sample data" : "Uploaded"}</span>
            </td>
            <td className="num px-4 text-ink-2">
              {new Date(b.created).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC
            </td>
            <td className="px-4">
              <BatchStatusBadge status={b.status} />
            </td>
            <td className="num px-4 text-right text-ink-2">{b.hold ?? "–"}</td>
            <td className={`num px-4 text-right font-semibold ${b.exposedCents ? "text-hold" : "text-muted"}`}>{b.exposed ?? "–"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
