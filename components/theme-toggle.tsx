"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

// The icon swaps with CSS based on <html class="dark">, so there's no hydration mismatch
// and no need for a mounted check. We only read resolvedTheme when the button is clicked.
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <span className="inline dark:hidden">☾</span>
      <span className="hidden dark:inline">☀</span>
    </Button>
  );
}
