export const dynamic = "force-dynamic";
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
      -- only expense needs its sign flipped: income is always stored positive, and transfers
      -- already carry the direction in their sign (see createTransfer in app/transactions/page.tsx)
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
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Accounts</h1>

      <Card>
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              No accounts yet. Add one below.
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
                      <Button type="submit" variant="ghost" size="icon" title="Delete" aria-label="Delete">
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
          <CardTitle>New account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAccount} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="acc-name">Name</Label>
                <Input id="acc-name" name="name" placeholder="e.g. TD Chequing" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-type">Type</Label>
                <NativeSelect id="acc-type" name="type">
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <Button type="submit">Add account</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
