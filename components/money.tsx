import { cn } from "@/lib/utils";

// 앱 전체를 CAD 기준으로 표시. 계좌가 다른 통화를 쓰면 currency prop으로 넘김.
// 원화 거래는 입력/가져오기 시점에 CAD로 환산해서 저장한다 (CSV import 단계에서 처리).
export function Money({
  amount,
  currency = "CAD",
  className,
  colored = true,
}: {
  amount: string | number;
  currency?: string;
  className?: string;
  colored?: boolean;
}) {
  const value = Number(amount);
  const formatted = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(value);
  return (
    <span
      className={cn(
        "tabular-nums font-medium",
        colored && value < 0 && "text-red-600 dark:text-red-400",
        colored && value > 0 && "text-emerald-600 dark:text-emerald-400",
        className,
      )}
    >
      {formatted}
    </span>
  );
}
