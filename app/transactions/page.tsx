export const dynamic = "force-dynamic";
import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";

type Account = { id: string; name: string };
type Category = { id: string; name: string };
type Transaction = {
  id: string;
  type: string;
  signed_amount: string;
  description: string | null;
  occurred_at: string;
  account_name: string;
  account_currency: string;
  category_name: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

async function createTransaction(formData: FormData) {
  "use server";
  const accountId = formData.get("account_id") as string;
  const categoryId = formData.get("category_id") as string;
  const type = formData.get("type") as string;
  const amount = formData.get("amount") as string;
  const description = formData.get("description") as string;
  const occurredAt = formData.get("occurred_at") as string;

  await getPool().query(
    `INSERT INTO transactions (account_id, category_id, type, amount, description, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [accountId, categoryId || null, type, amount, description || null, occurredAt],
  );
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/");
}

async function createTransfer(formData: FormData) {
  "use server";
  const fromAccountId = formData.get("from_account_id") as string;
  const toAccountId = formData.get("to_account_id") as string;
  const amount = formData.get("transfer_amount") as string;
  const description = formData.get("transfer_description") as string;
  const occurredAt = formData.get("transfer_occurred_at") as string;

  // Both rows need to point at each other through transfer_pair_id.
  // I generate the UUIDs here first so each INSERT can already use the other row's id.
  // The FK is DEFERRABLE INITIALLY DEFERRED, so it's only checked on COMMIT
  // and referencing a row that doesn't exist yet is fine inside the transaction.
  const outId = randomUUID();
  const inId = randomUUID();

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO transactions (id, account_id, type, amount, description, occurred_at, transfer_pair_id)
       VALUES ($1, $2, 'transfer', $3, $4, $5, $6)`,
      [outId, fromAccountId, `-${amount}`, description || null, occurredAt, inId],
    );
    await client.query(
      `INSERT INTO transactions (id, account_id, type, amount, description, occurred_at, transfer_pair_id)
       VALUES ($1, $2, 'transfer', $3, $4, $5, $6)`,
      [inId, toAccountId, amount, description || null, occurredAt, outId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/");
}

async function deleteTransaction(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  // A transfer is a pair of rows, so delete the row and its pair together.
  // If only one side got deleted, the other would look like a real deposit/withdrawal and break the balance.
  await getPool().query(
    "DELETE FROM transactions WHERE id = $1 OR transfer_pair_id = $1",
    [id],
  );
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/");
}

export default async function TransactionsPage() {
  const pool = getPool();
  const [{ rows: accounts }, { rows: categories }, { rows: transactions }] =
    await Promise.all([
      pool.query<Account>("SELECT id, name FROM accounts ORDER BY name"),
      pool.query<Category>("SELECT id, name FROM categories ORDER BY name"),
      pool.query<Transaction>(`
        SELECT t.id, t.type, t.description,
               to_char(t.occurred_at, 'YYYY-MM-DD') AS occurred_at,
               a.name AS account_name, a.currency AS account_currency,
               c.name AS category_name,
               CASE WHEN t.type = 'expense' THEN -t.amount ELSE t.amount END AS signed_amount
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        LEFT JOIN categories c ON c.id = t.category_id
        ORDER BY t.occurred_at DESC, t.created_at DESC
      `),
    ]);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Transactions</h1>

      <Card>
        <CardContent className="px-0">
          {transactions.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              No transactions yet. Add one below.
            </p>
          ) : (
            <ul className="divide-y">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {t.type === "transfer" ? "Transfer" : (t.category_name ?? "Uncategorized")}
                      {t.description && (
                        <span className="text-muted-foreground"> · {t.description}</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.occurred_at} · {t.account_name}
                    </p>
                  </div>
                  <Money
                    amount={t.signed_amount}
                    currency={t.account_currency}
                    className="shrink-0"
                  />
                  <form action={deleteTransaction} className="shrink-0">
                    <input type="hidden" name="id" value={t.id} />
                    <Button type="submit" variant="ghost" size="icon" title="Delete" aria-label="Delete">
                      ×
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createTransaction} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tx-account">Account</Label>
                  <NativeSelect id="tx-account" name="account_id" required>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tx-type">Type</Label>
                  <NativeSelect id="tx-type" name="type">
                    <option value="expense">expense</option>
                    <option value="income">income</option>
                  </NativeSelect>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tx-category">Category (optional)</Label>
                <NativeSelect id="tx-category" name="category_id">
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="tx-amount">Amount (CAD)</Label>
                  <Input
                    id="tx-amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tx-date">Date</Label>
                  <Input id="tx-date" name="occurred_at" type="date" required defaultValue={today()} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tx-desc">Note (optional)</Label>
                <Input id="tx-desc" name="description" placeholder="e.g. Groceries at No Frills" />
              </div>

              <Button type="submit">Add transaction</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transfer between accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createTransfer} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="transfer-from">From</Label>
                  <NativeSelect id="transfer-from" name="from_account_id" required>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="transfer-to">To</Label>
                  <NativeSelect id="transfer-to" name="to_account_id" required>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="transfer-amount">Amount (CAD)</Label>
                  <Input
                    id="transfer-amount"
                    name="transfer_amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="transfer-date">Date</Label>
                  <Input
                    id="transfer-date"
                    name="transfer_occurred_at"
                    type="date"
                    required
                    defaultValue={today()}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="transfer-desc">Note (optional)</Label>
                <Input id="transfer-desc" name="transfer_description" placeholder="e.g. Move to savings" />
              </div>

              <Button type="submit">Transfer</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
