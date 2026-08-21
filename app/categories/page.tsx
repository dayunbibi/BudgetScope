import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";

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

export default async function CategoriesPage() {
  const pool = getPool();
  const { rows: categories } = await pool.query<Category>(`
    SELECT c.id, c.name, c.kind, p.name AS parent_name
    FROM categories c
    LEFT JOIN categories p ON p.id = c.parent_id
    ORDER BY c.parent_id NULLS FIRST, c.name
  `);

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-semibold mb-4">카테고리</h1>

      <ul className="mb-6 space-y-1">
        {categories.map((c) => (
          <li key={c.id} className="border rounded px-3 py-2">
            {c.parent_name ? `${c.parent_name} > ` : ""}
            {c.name} · {c.kind}
          </li>
        ))}
        {categories.length === 0 && (
          <li className="text-gray-500">아직 카테고리가 없어요.</li>
        )}
      </ul>

      <form action={createCategory} className="flex gap-2">
        <input
          name="name"
          placeholder="카테고리 이름"
          required
          className="border rounded px-2 py-1 flex-1"
        />
        <select name="kind" className="border rounded px-2 py-1">
          <option value="expense">expense</option>
          <option value="income">income</option>
        </select>
        <select name="parent_id" className="border rounded px-2 py-1">
          <option value="">최상위</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="border rounded px-3 py-1 bg-black text-white">
          추가
        </button>
      </form>
    </main>
  );
}
