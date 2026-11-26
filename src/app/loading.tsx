import { Panel, Skeleton } from "@/components/ui/layout";

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-[132px] w-full rounded-[8px]" />
      <Skeleton className="h-[86px] w-full rounded-[8px]" />
      <Panel className="space-y-3 p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </Panel>
    </div>
  );
}
