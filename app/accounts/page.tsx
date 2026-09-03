import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";

type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  initial_balance: string;
  balance: string;
};

const ACCOUNT_TYPES = ["checking", "savings", "credit_card", "cash", "investment"];

async function createAccount(formData: FormData) {
  "use server";
  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  await getPool().query("INSERT INTO accounts (name, type) VALUES ($1, $2)", [name, type]);
  revalidatePath("/accounts");
  revalidatePath("/");
}

async function deleteAccount(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  await getPool().query("DELETE FROM accounts WHERE id = $1", [id]);
  revalidatePath("/accounts");
  revalidatePath("/");
}

export default async function AccountsPage() {
  const { rows } = await getPool().query<Account>(`
    SELECT
      a.id, a.name, a.type, a.currency, a.initial_balance,
      -- expense만 부호를 뒤집으면 됨: income은 항상 양수로 저장, transfer는 저장할 때부터
      -- 이미 방향(부호)이 들어있어서 그대로 더하면 됨 (app/transactions/page.tsx의 createTransfer 참고)
      a.initial_balance + COALESCE(SUM(
        CASE WHEN t.type = 'expense' THEN -t.amount ELSE t.amount END
      ), 0) AS balance
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id
    GROUP BY a.id
    ORDER BY a.created_at
  `);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">계좌</h1>

      <Card>
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              계좌가 없습니다. 아래에서 추가해보세요.
            </p>
          ) : (
            <ul className="divide-y">
              {rows.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3"
                >
                  <span className="text-sm">
                    {a.name}
                    <span className="text-muted-foreground"> · {a.type}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <Money amount={a.balance} currency={a.currency} colored={false} />
                    <form action={deleteAccount}>
                      <input type="hidden" name="id" value={a.id} />
                      <Button variant="ghost" size="icon-sm" title="삭제" aria-label="삭제">
                        ×
                      </Button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>새 계좌 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAccount} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="acc-name">계좌 이름</Label>
                <Input id="acc-name" name="name" placeholder="예: 생활비 통장" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-type">계좌 종류</Label>
                <NativeSelect id="acc-type" name="type">
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <Button type="submit">계좌 추가</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
