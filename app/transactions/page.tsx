import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { ui, Money } from "@/components/ui";

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

async function deleteTransaction(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  // 이체는 두 행이 한 쌍이라, 대상 행이나 그 짝(transfer_pair_id)이면 둘 다 지운다.
  // 한쪽만 지우면 나머지 한쪽이 실제로 일어나지 않은 입금/출금처럼 남아 잔액이 어긋난다.
  await getPool().query(
    "DELETE FROM transactions WHERE id = $1 OR transfer_pair_id = $1",
    [id]
  );
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
               a.name AS account_name, a.currency AS account_currency,
               c.name AS category_name,
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
    <main className={ui.page}>
      <h1 className={ui.pageTitle}>거래</h1>

      <div className={`mt-4 ${ui.card}`}>
        <ul className={ui.list}>
          {transactions.map((t) => (
            <li key={t.id} className={ui.row}>
              <span className={ui.rowMain}>
                {t.occurred_at} · {t.account_name}
                {t.type === "transfer" && (
                  <span className={ui.rowSub}> · 이체</span>
                )}
                {t.category_name && (
                  <span className={ui.rowSub}> · {t.category_name}</span>
                )}
                {t.description && (
                  <span className={ui.rowSub}> · {t.description}</span>
                )}
              </span>
              <span className="flex items-center gap-3">
                <Money amount={t.signed_amount} currency={t.account_currency} />
                <form action={deleteTransaction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className={ui.deleteButton} title="삭제">
                    ×
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
        {transactions.length === 0 && (
          <p className={ui.emptyState}>거래가 없습니다. 아래에서 추가해보세요.</p>
        )}
      </div>

      <h2 className={ui.sectionTitle}>거래 추가</h2>
      <form action={createTransaction} className={ui.formCard}>
        <div className={ui.formRow}>
          <div>
            <label className={ui.label} htmlFor="tx-account">
              계좌
            </label>
            <select id="tx-account" name="account_id" required className={ui.select}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={ui.label} htmlFor="tx-type">
              종류
            </label>
            <select id="tx-type" name="type" className={ui.select}>
              <option value="expense">expense</option>
              <option value="income">income</option>
            </select>
          </div>
        </div>

        <div>
          <label className={ui.label} htmlFor="tx-category">
            카테고리 (선택)
          </label>
          <select id="tx-category" name="category_id" className={ui.select}>
            <option value="">카테고리 없음</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className={ui.formRow}>
          <div>
            <label className={ui.label} htmlFor="tx-amount">
              금액
            </label>
            <input
              id="tx-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0"
              required
              className={ui.input}
            />
          </div>
          <div>
            <label className={ui.label} htmlFor="tx-date">
              날짜
            </label>
            <input
              id="tx-date"
              name="occurred_at"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={ui.input}
            />
          </div>
        </div>

        <div>
          <label className={ui.label} htmlFor="tx-desc">
            메모 (선택)
          </label>
          <input id="tx-desc" name="description" placeholder="메모" className={ui.input} />
        </div>

        <button className={ui.buttonPrimary}>거래 추가</button>
      </form>

      <h2 className={ui.sectionTitle}>계좌 이체</h2>
      <form action={createTransfer} className={ui.formCard}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem] flex-1">
            <label className={ui.label} htmlFor="transfer-from">
              보내는 계좌
            </label>
            <select id="transfer-from" name="from_account_id" required className={ui.select}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <span className="pb-2 text-slate-400">→</span>
          <div className="min-w-[10rem] flex-1">
            <label className={ui.label} htmlFor="transfer-to">
              받는 계좌
            </label>
            <select id="transfer-to" name="to_account_id" required className={ui.select}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={ui.formRow}>
          <div>
            <label className={ui.label} htmlFor="transfer-amount">
              이체 금액
            </label>
            <input
              id="transfer-amount"
              name="transfer_amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0"
              required
              className={ui.input}
            />
          </div>
          <div>
            <label className={ui.label} htmlFor="transfer-date">
              날짜
            </label>
            <input
              id="transfer-date"
              name="transfer_occurred_at"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={ui.input}
            />
          </div>
        </div>

        <div>
          <label className={ui.label} htmlFor="transfer-desc">
            메모 (선택)
          </label>
          <input
            id="transfer-desc"
            name="transfer_description"
            placeholder="메모"
            className={ui.input}
          />
        </div>

        <button className={ui.buttonPrimary}>이체</button>
      </form>
    </main>
  );
}
