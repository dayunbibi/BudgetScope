export const dynamic = "force-dynamic";

import { getPool } from "@/lib/db";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  const { rows: accounts } = await getPool().query<{ id: string; name: string }>(
    "SELECT id, name FROM accounts ORDER BY name",
  );

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">가져오기</h1>
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          먼저 계좌를 하나 만드세요.
        </p>
      ) : (
        <ImportForm accounts={accounts} />
      )}
    </div>
  );
}
