import type { Metadata } from "next";
import Link from "next/link";
import { IdentityBar } from "./_components/identity";
import "./globals.css";

export const metadata: Metadata = {
  title: "LienGuard",
  description: "Know which subcontractor payments are safe before you pay.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
            <div className="flex items-baseline gap-3">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Lien<span className="text-emerald-700">Guard</span>
              </Link>
              <span className="hidden text-xs text-slate-500 md:inline">Demo · fictional data · not legal advice</span>
            </div>
            <IdentityBar />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
