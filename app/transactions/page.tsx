import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

type Account = { id: string; name: string };
type Category = { id: string; name: string };
type Transaction = {
  id: string;
  type: string;
  signed_amount: string;
  description: string | null;
  occurred_at: string;
  account_name: string;
  category_name: string | null;
};

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
    [accountId, categoryId || null, type, amount, description || null, occurredAt]
  );
  revalidatePath("/transactions");
}

async function createTransfer(formData: FormData) {
  "use server";
  const fromAccountId = formData.get("from_account_id") as string;
  const toAccountId = formData.get("to_account_id") as string;
  const amount = formData.get("transfer_amount") as string;
  const description = formData.get("transfer_description") as string;
  const occurredAt = formData.get("transfer_occurred_at") as string;

  // 두 행이 서로를 transfer_pair_id로 가리켜야 하는데, UUID는 클라이언트(이 서버 코드)에서
  // 미리 만들 수 있으니 INSERT 두 번을 하면서 서로의 id를 처음부터 채워 넣을 수 있다.
  // (transfer_pair_id FK가 DEFERRABLE INITIALLY DEFERRED라 커밋 시점에만 검증되므로,
  //  아직 존재하지 않는 상대방 id를 먼저 참조해도 트랜잭션 안에서는 통과한다.)
  const outId = randomUUID();
  const inId = randomUUID();

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO transactions (id, account_id, type, amount, description, occurred_at, transfer_pair_id)
       VALUES ($1, $2, 'transfer', $3, $4, $5, $6)`,
      [outId, fromAccountId, `-${amount}`, description || null, occurredAt, inId]
    );
    await client.query(
      `INSERT INTO transactions (id, account_id, type, amount, description, occurred_at, transfer_pair_id)
       VALUES ($1, $2, 'transfer', $3, $4, $5, $6)`,
      [inId, toAccountId, amount, description || null, occurredAt, outId]
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
               a.name AS account_name, c.name AS category_name,
               -- expense만 부호를 뒤집으면 됨: income은 원래 양수, transfer는 저장할 때부터
               -- 이미 방향(부호)이 들어있음 (아래 createTransfer 참고)
               CASE WHEN t.type = 'expense' THEN -t.amount ELSE t.amount END AS signed_amount
        FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        LEFT JOIN categories c ON c.id = t.category_id
        ORDER BY t.occurred_at DESC, t.created_at DESC
      `),
    ]);

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-semibold mb-4">거래</h1>

      <ul className="mb-6 space-y-1">
        {transactions.map((t) => (
          <li key={t.id} className="border rounded px-3 py-2 flex justify-between">
            <span>
              {t.occurred_at} · {t.account_name}
              {t.type === "transfer" ? " · 이체" : ""}
              {t.category_name ? ` · ${t.category_name}` : ""}
              {t.description ? ` · ${t.description}` : ""}
            </span>
            <span className={Number(t.signed_amount) < 0 ? "text-red-600" : "text-green-600"}>
              {Number(t.signed_amount) >= 0 ? "+" : ""}
              {t.signed_amount}
            </span>
          </li>
        ))}
        {transactions.length === 0 && (
          <li className="text-gray-500">아직 거래가 없어요.</li>
        )}
      </ul>

      <form action={createTransaction} className="space-y-2">
        <div className="flex gap-2">
          <select name="account_id" required className="border rounded px-2 py-1 flex-1">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select name="type" className="border rounded px-2 py-1">
            <option value="expense">expense</option>
            <option value="income">income</option>
          </select>
        </div>

        <select name="category_id" className="border rounded px-2 py-1 w-full">
          <option value="">카테고리 없음</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="금액"
            required
            className="border rounded px-2 py-1 flex-1"
          />
          <input
            name="occurred_at"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="border rounded px-2 py-1"
          />
        </div>

        <input
          name="description"
          placeholder="메모 (선택)"
          className="border rounded px-2 py-1 w-full"
        />

        <button className="border rounded px-3 py-1 bg-black text-white">
          추가
        </button>
      </form>

      <h2 className="text-lg font-semibold mt-8 mb-2">계좌 이체</h2>
      <form action={createTransfer} className="space-y-2">
        <div className="flex gap-2">
          <select name="from_account_id" required className="border rounded px-2 py-1 flex-1">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <span className="self-center">→</span>
          <select name="to_account_id" required className="border rounded px-2 py-1 flex-1">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <input
            name="transfer_amount"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="이체 금액"
            required
            className="border rounded px-2 py-1 flex-1"
          />
          <input
            name="transfer_occurred_at"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="border rounded px-2 py-1"
          />
        </div>

        <input
          name="transfer_description"
          placeholder="메모 (선택)"
          className="border rounded px-2 py-1 w-full"
        />

        <button className="border rounded px-3 py-1 bg-black text-white">
          이체
        </button>
      </form>
    </main>
  );
}
