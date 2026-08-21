import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BudgetScope",
  description: "가계부",
};

const navLinkClass =
  "rounded-md px-2 py-1 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-50 font-sans text-slate-900">
        <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center gap-1 px-4 py-3 sm:px-6">
            <Link href="/accounts" className={navLinkClass}>
              계좌
            </Link>
            <Link href="/categories" className={navLinkClass}>
              카테고리
            </Link>
            <Link href="/transactions" className={navLinkClass}>
              거래
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
