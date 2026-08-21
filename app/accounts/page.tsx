import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";

type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  initial_balance: string;
  balance: string;
};

async function createAccount(formData: FormData) {
  "use server";
  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  await getPool().query(
    "INSERT INTO accounts (name, type) VALUES ($1, $2)",
    [name, type]
  );
  revalidatePath("/accounts");
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
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-semibold mb-4">계좌</h1>

      <ul className="mb-6 space-y-1">
        {rows.map((a) => (
          <li key={a.id} className="border rounded px-3 py-2 flex justify-between">
            <span>{a.name} · {a.type}</span>
            <span>{a.currency} {a.balance}</span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="text-gray-500">아직 계좌가 없어요.</li>
        )}
      </ul>

      <form action={createAccount} className="flex gap-2">
        <input
          name="name"
          placeholder="계좌 이름"
          required
          className="border rounded px-2 py-1 flex-1"
        />
        <select name="type" className="border rounded px-2 py-1">
          <option value="checking">checking</option>
          <option value="savings">savings</option>
          <option value="credit_card">credit_card</option>
          <option value="cash">cash</option>
          <option value="investment">investment</option>
        </select>
        <button className="border rounded px-3 py-1 bg-black text-white">
          추가
        </button>
      </form>
    </main>
  );
}
