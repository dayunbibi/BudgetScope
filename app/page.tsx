export const dynamic = "force-dynamic";
import Link from "next/link";
import { getPool } from "@/lib/db";
import { Money } from "@/components/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Totals = { income: string; expense: string };
type CatRow = { name: string; total: string };
type Recent = {
  id: string;
  type: string;
  signed_amount: string;
  description: string | null;
  occurred_at: string;
  account_name: string;
  category_name: string | null;
};
type AccountRow = { id: string; name: string; type: string; balance: string };

export default async function DashboardPage() {
  const pool = getPool();
  const [{ rows: accounts }, { rows: totalsRows }, { rows: byCategory }, { rows: recent }] =
    await Promise.all([
      pool.query<AccountRow>(`
        SELECT a.id, a.name, a.type,
               a.initial_balance + COALESCE(SUM(
                 CASE WHEN t.type = 'expense' THEN -t.amount ELSE t.amount END
               ), 0) AS balance
        FROM accounts a
        LEFT JOIN transactions t ON t.account_id = a.id
        GROUP BY a.id
        ORDER BY a.created_at
      `),
      pool.query<Totals>(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)  AS income,
          COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expense
        FROM transactions
        WHERE occurred_at >= date_trunc('month', CURRENT_DATE)
      `),
      pool.query<CatRow>(`
        SELECT COALESCE(c.name, '미분류') AS name, SUM(t.amount) AS total
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.type = 'expense'
          AND t.occurred_at >= date_trunc('month', CURRENT_DATE)
        GROUP BY c.name
        ORDER BY total DESC
        LIMIT 6
      `),
      pool.query<Recent>(`
        SELECT t.id, t.type, t.description,
               to_char(t.occurred_at, 'MM-DD') AS occurred_at,
               a.name AS account_name, c.name AS category_name,
               CASE WHEN t.type = 'expense' THEN -t.amount ELSE t.amount END AS signed_amount
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        LEFT JOIN categories c ON c.id = t.category_id
        ORDER BY t.occurred_at DESC, t.created_at DESC
        LIMIT 8
      `),
    ]);

  const totals = totalsRows[0] ?? { income: "0", expense: "0" };
  const netWorth = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const net = Number(totals.income) - Number(totals.expense);
  const catMax = Math.max(1, ...byCategory.map((c) => Number(c.total)));
  const monthLabel = new Date().toLocaleDateString("ko-KR", { month: "long" });

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">대시보드</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardContent className="space-y-0.5">
            <p className="text-sm text-muted-foreground">순자산</p>
            <Money amount={netWorth} colored={false} className="text-xl sm:text-2xl" />
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="space-y-0.5">
            <p className="text-sm text-muted-foreground">{monthLabel} 지출</p>
            <span className="text-xl font-medium tabular-nums text-red-600 sm:text-2xl dark:text-red-400">
              <Money amount={-Number(totals.expense)} colored={false} />
            </span>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="space-y-0.5">
            <p className="text-sm text-muted-foreground">{monthLabel} 수지</p>
            <Money amount={net} className="text-xl sm:text-2xl" />
            <p className="text-xs text-muted-foreground">
              수입 <Money amount={Number(totals.income)} colored={false} />
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{monthLabel} 카테고리별 지출</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byCategory.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                이번 달 지출 내역이 없습니다.
              </p>
            )}
            {byCategory.map((c) => (
              <div key={c.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{c.name}</span>
                  <Money amount={-Number(c.total)} colored={false} className="text-muted-foreground" />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(Number(c.total) / catMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>계좌</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {accounts.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                <Link href="/accounts" className="underline">계좌를 추가</Link>해보세요.
              </p>
            )}
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span>
                  {a.name}
                  <span className="text-muted-foreground"> · {a.type}</span>
                </span>
                <Money amount={a.balance} colored={false} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>최근 거래</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              <Link href="/transactions" className="underline">거래를 추가</Link>해보세요.
            </p>
          ) : (
            <ul className="divide-y">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground">{t.occurred_at}</span>{" "}
                    {t.category_name ?? (t.type === "transfer" ? "이체" : "미분류")}
                    {t.description && (
                      <span className="text-muted-foreground"> · {t.description}</span>
                    )}
                    <span className="text-muted-foreground"> · {t.account_name}</span>
                  </span>
                  <Money amount={t.signed_amount} />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/transactions"
            className="mt-3 inline-block text-sm text-muted-foreground underline"
          >
            전체 거래 보기 →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
