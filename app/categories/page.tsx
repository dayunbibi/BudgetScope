import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ui } from "@/components/ui";

type Category = {
  id: string;
  name: string;
  kind: string;
  parent_name: string | null;
};

async function createCategory(formData: FormData) {
  "use server";
  const name = formData.get("name") as string;
  const kind = formData.get("kind") as string;
  const parentId = formData.get("parent_id") as string;

  await getPool().query(
    "INSERT INTO categories (name, kind, parent_id) VALUES ($1, $2, $3)",
    [name, kind, parentId || null]
  );
  revalidatePath("/categories");
}

async function deleteCategory(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  await getPool().query("DELETE FROM categories WHERE id = $1", [id]);
  revalidatePath("/categories");
}

export default async function CategoriesPage() {
  const pool = getPool();
  const { rows: categories } = await pool.query<Category>(`
    SELECT c.id, c.name, c.kind, p.name AS parent_name
    FROM categories c
    LEFT JOIN categories p ON p.id = c.parent_id
    ORDER BY c.parent_id NULLS FIRST, c.name
  `);

  return (
    <main className={ui.page}>
      <h1 className={ui.pageTitle}>카테고리</h1>

      <div className={`mt-4 ${ui.card}`}>
        <ul className={ui.list}>
          {categories.map((c) => (
            <li key={c.id} className={ui.row}>
              <span className={ui.rowMain}>
                {c.parent_name && (
                  <span className={ui.rowSub}>{c.parent_name} › </span>
                )}
                {c.name}
                <span className={ui.rowSub}> · {c.kind}</span>
              </span>
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={c.id} />
                <button className={ui.deleteButton} title="삭제">
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
        {categories.length === 0 && (
          <p className={ui.emptyState}>카테고리가 없습니다. 아래에서 추가해보세요.</p>
        )}
      </div>

      <form action={createCategory} className={ui.formCard}>
        <div className={ui.formRow}>
          <div>
            <label className={ui.label} htmlFor="cat-name">
              카테고리 이름
            </label>
            <input
              id="cat-name"
              name="name"
              placeholder="예: 식비"
              required
              className={ui.input}
            />
          </div>
          <div>
            <label className={ui.label} htmlFor="cat-kind">
              종류
            </label>
            <select id="cat-kind" name="kind" className={ui.select}>
              <option value="expense">expense</option>
              <option value="income">income</option>
            </select>
          </div>
        </div>
        <div>
          <label className={ui.label} htmlFor="cat-parent">
            상위 카테고리 (선택)
          </label>
          <select id="cat-parent" name="parent_id" className={ui.select}>
            <option value="">최상위</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button className={ui.buttonPrimary}>카테고리 추가</button>
      </form>
    </main>
  );
}
