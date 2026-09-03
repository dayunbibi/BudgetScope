"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

// 아이콘 표시는 <html>.dark 클래스에 따라 CSS로 스왑 (next-themes가 paint 전에 클래스를 붙여서
// hydration mismatch 없음). 클릭 시점의 resolvedTheme만 읽으면 되므로 mounted 가드가 필요 없다.
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label="테마 전환"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <span className="inline dark:hidden">☾</span>
      <span className="hidden dark:inline">☀</span>
    </Button>
  );
}
