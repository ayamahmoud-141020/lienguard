"use client";

import { BookOpen, FileClock, LayoutGrid, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { Tooltip } from "@/components/ui/primitives";

function NavItem({ href, icon, label, active, disabledHint }: { href?: string; icon: ReactNode; label: string; active?: boolean; disabledHint?: string }) {
  const cls = cn(
    "flex h-8 items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] font-medium [&_svg]:size-4",
    active ? "bg-surface text-ink shadow-[var(--shadow-card)] ring-1 ring-line" : "text-ink-2 hover:bg-[#e9edf1] hover:text-ink",
    !href && "cursor-default text-muted hover:bg-transparent hover:text-muted",
  );
  if (!href) {
    return (
      <Tooltip content={disabledHint} side="right">
        <span className={cls} aria-disabled="true" tabIndex={0}>
          {icon}
          {label}
        </span>
      </Tooltip>
    );
  }
  return (
    <Link href={href} className={cls} aria-current={active ? "page" : undefined}>
      {icon}
      {label}
    </Link>
  );
}

export function Sidebar() {
  const path = usePathname() ?? "/";
  const batchId = /^\/batches\/([^/]+)/.exec(path)?.[1];
  const hint = "Open a batch first";
  return (
    <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-line bg-canvas px-3 py-4">
      <Link href="/" className="mb-6 flex items-center gap-2 px-2.5">
        <span className="flex size-7 items-center justify-center rounded-[6px] bg-brand text-white">
          <ShieldCheck aria-hidden className="size-4" />
        </span>
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">LienGuard</span>
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        <NavItem href="/" icon={<LayoutGrid aria-hidden />} label="Batches" active={path === "/" || (Boolean(batchId) && !/\/(drafts|audit)$/.test(path))} />
        <NavItem
          href={batchId ? `/batches/${batchId}/drafts` : undefined}
          icon={<Mail aria-hidden />}
          label="Emails"
          active={/\/drafts$/.test(path)}
          disabledHint={hint}
        />
        <NavItem
          href={batchId ? `/batches/${batchId}/audit` : undefined}
          icon={<FileClock aria-hidden />}
          label="Audit log"
          active={/\/audit$/.test(path)}
          disabledHint={hint}
        />
      </nav>
      <div className="mt-6 border-t border-line pt-4">
        <NavItem href="/about" icon={<BookOpen aria-hidden />} label="How it works" active={path === "/about"} />
      </div>
      <p className="mt-auto px-2.5 text-xs leading-4 text-muted">Demo with fictional data. Flags issues for a person to review; not legal advice.</p>
    </aside>
  );
}
