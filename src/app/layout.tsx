import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { Sidebar } from "@/components/app/sidebar";
import { DemoAccess } from "@/components/app/demo-access";
import { TooltipProvider } from "@/components/ui/primitives";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "LienGuard",
  description: "Know which subcontractor payments are safe before you pay.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <TooltipProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-surface/90 px-8 backdrop-blur">
                <p className="text-[13px] text-muted">Subcontractor payments: lien waivers and insurance, checked before you pay.</p>
                <DemoAccess />
              </header>
              <main className="mx-auto w-full max-w-[1240px] flex-1 px-8 py-7">{children}</main>
            </div>
          </div>
        </TooltipProvider>
        <Toaster position="top-center" offset={64} toastOptions={{ className: "!rounded-[8px] !border-line !text-[13px]" }} />
      </body>
    </html>
  );
}
