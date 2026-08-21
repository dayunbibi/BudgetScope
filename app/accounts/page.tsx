import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ui, Money } from "@/components/ui";

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
  await getPool().query(
    "INSERT INTO accounts (name, type) VALUES ($1, $2)",
    [name, type]
  );
  revalidatePath("/accounts");
}

async function deleteAccount(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  await getPool().query("DELETE FROM accounts WHERE id = $1", [id]);
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
    <main className={ui.page}>
      <h1 className={ui.pageTitle}>계좌</h1>

      <div className={`mt-4 ${ui.card}`}>
        <ul className={ui.list}>
          {rows.map((a) => (
            <li key={a.id} className={ui.row}>
              <span className={ui.rowMain}>
                {a.name}
                <span className={ui.rowSub}> · {a.type}</span>
              </span>
              <span className="flex items-center gap-3">
                <Money amount={a.balance} currency={a.currency} />
                <form action={deleteAccount}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className={ui.deleteButton} title="삭제">
                    ×
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
        {rows.length === 0 && (
          <p className={ui.emptyState}>계좌가 없습니다. 아래에서 추가해보세요.</p>
        )}
      </div>

      <form action={createAccount} className={ui.formCard}>
        <div className={ui.formRow}>
          <div>
            <label className={ui.label} htmlFor="acc-name">
              계좌 이름
            </label>
            <input
              id="acc-name"
              name="name"
              placeholder="예: 생활비 통장"
              required
              className={ui.input}
            />
          </div>
          <div>
            <label className={ui.label} htmlFor="acc-type">
              계좌 종류
            </label>
            <select id="acc-type" name="type" className={ui.select}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className={ui.buttonPrimary}>계좌 추가</button>
      </form>
    </main>
  );
}
