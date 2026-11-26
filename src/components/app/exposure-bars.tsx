"use client";

import { Tooltip } from "@/components/ui/primitives";

type Project = { code: string; name: string; exposed: string; exposedCents: number; hold: number };

/** Single-series horizontal bars: exposed dollars per project. Values in text ink; bars carry magnitude. */
export function ExposureBars({ projects, totalCents }: { projects: Project[]; totalCents: number }) {
  const max = Math.max(1, ...projects.map((p) => p.exposedCents));
  return (
    <ul className="grid grid-cols-3 gap-x-8 gap-y-4">
      {projects.map((p) => {
        const share = totalCents ? Math.round((p.exposedCents / totalCents) * 100) : 0;
        return (
          <li key={p.code}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate font-medium text-ink">{p.name}</span>
              <span className="num shrink-0 font-semibold text-ink">{p.exposed}</span>
            </div>
            <Tooltip content={`${p.name}: ${p.exposed} exposed (${share}% of the batch), ${p.hold} payment${p.hold === 1 ? "" : "s"} on hold`}>
              <div className="mt-1.5 h-2 w-full cursor-default rounded-full bg-[#eef1f4]" tabIndex={0} aria-label={`${p.name} ${p.exposed} exposed`}>
                {p.exposedCents ? <div className="h-2 rounded-full bg-hold" style={{ width: `${Math.max(2, (p.exposedCents / max) * 100)}%` }} /> : null}
              </div>
            </Tooltip>
            <p className="num mt-1 text-xs text-muted">
              {share}% of exposure, {p.hold} on hold
            </p>
          </li>
        );
      })}
    </ul>
  );
}
