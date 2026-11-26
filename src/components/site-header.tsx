// Adapted from shadcn/ui dashboard-01 (MIT).
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DemoAccess } from "@/components/app/demo-access";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <p className="text-sm text-muted-foreground">Subcontractor payments: lien waivers and insurance, checked before you pay.</p>
        <div className="ml-auto flex items-center gap-2">
          <DemoAccess />
        </div>
      </div>
    </header>
  );
}
