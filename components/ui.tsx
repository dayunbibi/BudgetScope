export const ui = {
  page: "mx-auto max-w-2xl px-4 py-8 sm:px-6",
  pageTitle: "text-2xl font-semibold tracking-tight text-slate-900",
  sectionTitle: "mt-10 mb-3 text-base font-semibold text-slate-900",

  card: "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
  list: "divide-y divide-slate-100",
  row: "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-slate-50",
  rowMain: "min-w-0 text-sm text-slate-900",
  rowSub: "text-slate-500",
  emptyState: "px-4 py-12 text-center text-sm text-slate-500",

  formCard: "mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4",
  formRow: "grid grid-cols-1 gap-3 sm:grid-cols-2",
  label: "mb-1 block text-xs font-medium text-slate-600",
  input:
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500",
  select:
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500",

  buttonPrimary:
    "inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
  deleteButton:
    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500",
};

export function Money({
  amount,
  currency = "KRW",
}: {
  amount: string | number;
  currency?: string;
}) {
  const value = Number(amount);
  const formatted = new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
  }).format(value);
  return (
    <span
      className={
        value < 0 ? "font-medium text-red-600" : "font-medium text-slate-900"
      }
    >
      {formatted}
    </span>
  );
}
