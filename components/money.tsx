import { cn } from "@/lib/utils";

// Everything is shown in CAD by default. Pass currency if an account uses something else.
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
