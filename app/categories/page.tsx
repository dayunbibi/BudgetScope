export const dynamic = "force-dynamic";
import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/native-select";

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
    [name, kind, parentId || null],
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
  const { rows: categories } = await getPool().query<Category>(`
    SELECT c.id, c.name, c.kind, p.name AS parent_name
    FROM categories c
    LEFT JOIN categories p ON p.id = c.parent_id
    ORDER BY c.parent_id NULLS FIRST, c.name
  `);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Categories</h1>

      <Card>
        <CardContent className="px-0">
          {categories.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              No categories yet. Add one below.
            </p>
          ) : (
            <ul className="divide-y">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-sm">
                    {c.parent_name && (
                      <span className="text-muted-foreground">{c.parent_name} › </span>
                    )}
                    {c.name}
                  </span>
                  <span className="flex items-center gap-3">
                    <Badge variant={c.kind === "income" ? "secondary" : "outline"}>
                      {c.kind}
                    </Badge>
                    <form action={deleteCategory}>
                      <input type="hidden" name="id" value={c.id} />
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
          <CardTitle>New category</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createCategory} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">Name</Label>
                <Input id="cat-name" name="name" placeholder="e.g. Groceries" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-kind">Type</Label>
                <NativeSelect id="cat-kind" name="kind">
                  <option value="expense">expense</option>
                  <option value="income">income</option>
                </NativeSelect>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-parent">Parent category (optional)</Label>
              <NativeSelect id="cat-parent" name="parent_id">
                <option value="">None (top level)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit">Add category</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
