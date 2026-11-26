import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Inter } from "next/font/google";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "LienGuard",
  description: "Know which subcontractor payments are safe before you pay.",
};

// App shell from shadcn/ui dashboard-01 (MIT): inset sidebar + sticky header.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <TooltipProvider>
          <SidebarProvider style={{ "--sidebar-width": "15rem", "--header-height": "3.5rem" } as CSSProperties}>
            <AppSidebar variant="inset" />
            <SidebarInset>
              <SiteHeader />
              <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 lg:px-6">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
        <Toaster position="top-center" offset={64} />
      </body>
    </html>
  );
}
