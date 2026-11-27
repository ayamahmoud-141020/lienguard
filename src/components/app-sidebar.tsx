"use client";

// Adapted from shadcn/ui dashboard-01 (MIT): same Sidebar structure, LienGuard navigation.
import { BookOpen, FileClock, LayoutGrid, Mail, ShieldCheck, Workflow } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const path = usePathname() ?? "/";
  const batchId = /^\/batches\/([^/]+)/.exec(path)?.[1];
  const items = [
    { title: "Batches", href: "/", icon: LayoutGrid, active: path === "/" || (Boolean(batchId) && !/\/(drafts|audit)$/.test(path)) },
    { title: "Emails", href: batchId ? `/batches/${batchId}/drafts` : null, icon: Mail, active: /\/drafts$/.test(path) },
    { title: "Audit log", href: batchId ? `/batches/${batchId}/audit` : null, icon: FileClock, active: /\/audit$/.test(path) },
  ];

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link href="/">
                <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <ShieldCheck aria-hidden className="!size-4" />
                </span>
                <span className="text-base font-semibold text-foreground">LienGuard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.href ? (
                    <SidebarMenuButton asChild isActive={item.active} tooltip={item.title}>
                      <Link href={item.href}>
                        <item.icon aria-hidden />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton disabled tooltip="Open a batch first" className="opacity-60">
                      <item.icon aria-hidden />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Learn</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/about"}>
                  <Link href="/about">
                    <BookOpen aria-hidden />
                    <span>How it works</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/flows"}>
                  <Link href="/flows">
                    <Workflow aria-hidden />
                    <span>System flows</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <p className="px-2 pb-2 text-xs leading-4 text-muted-foreground">Demo with fictional data. Flags issues for a person to review; not legal advice.</p>
      </SidebarFooter>
    </Sidebar>
  );
}
