import { Panel, Skeleton } from "@/components/ui/layout";

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading batch">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-80" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-[122px] w-full rounded-[8px]" />
      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5">
        <Panel className="space-y-3 p-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </Panel>
        <Panel className="space-y-4 p-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </Panel>
      </div>
    </div>
  );
}
