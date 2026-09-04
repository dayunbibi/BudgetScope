import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BudgetScope",
  description: "가계부",
};

const navLinks = [
  { href: "/", label: "대시보드" },
  { href: "/transactions", label: "거래" },
  { href: "/accounts", label: "계좌" },
  { href: "/categories", label: "카테고리" },
  { href: "/import", label: "가져오기" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-6">
              <Link
                href="/"
                className="font-heading text-sm font-semibold tracking-tight shrink-0"
              >
                Budget<span className="text-muted-foreground">Scope</span>
              </Link>
              <ThemeToggle className="order-2 ml-auto shrink-0 sm:order-3 sm:ml-0" />
              <nav className="order-3 -mx-4 w-full overflow-x-auto px-4 sm:order-2 sm:mx-0 sm:w-auto sm:flex-1 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
                <div className="flex items-center gap-1 text-sm">
                  {navLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="shrink-0 rounded-md px-2.5 py-1.5 font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
