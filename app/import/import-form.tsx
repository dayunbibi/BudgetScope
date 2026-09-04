"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { Money } from "@/components/money";
import {
  previewImport,
  commitImport,
  type PreviewState,
  type CommitState,
} from "./actions";

type Account = { id: string; name: string; currency: string };

export function ImportForm({ accounts }: { accounts: Account[] }) {
  const [preview, previewAction, previewing] = useActionState<PreviewState, FormData>(
    previewImport,
    { ok: false },
  );
  const [commit, commitAction, committing] = useActionState<CommitState, FormData>(
    commitImport,
    { ok: false },
  );

  if (commit.ok) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <p className="text-lg font-medium">{commit.count}건 가져왔습니다.</p>
          <div className="flex justify-center gap-2">
            <Button render={<Link href="/transactions" />}>거래 보기</Button>
            <Button variant="outline" render={<Link href="/import" />}>
              계속 가져오기
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const rows = preview.rows ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>파일 선택</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={previewAction} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="imp-account">가져올 계좌</Label>
                <NativeSelect id="imp-account" name="account_id" required>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  가져온 금액은 CAD 기준이라, CAD 계좌를 고르는 걸 추천해요.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="imp-source">파일 형식</Label>
                <NativeSelect id="imp-source" name="source" required defaultValue="td">
                  <option value="td">TD (EasyWeb CSV)</option>
                  <option value="toss">토스뱅크 (엑셀)</option>
                </NativeSelect>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-file">파일 (.csv / .xlsx)</Label>
              <input
                id="imp-file"
                name="file"
                type="file"
                accept=".csv,.xlsx,.xls"
                required
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
              />
            </div>
            <Button type="submit" disabled={previewing}>
              {previewing ? "읽는 중…" : "미리보기"}
            </Button>
            {preview.error && (
              <p className="text-sm text-red-600 dark:text-red-400">{preview.error}</p>
            )}
          </form>
        </CardContent>
      </Card>

      {preview.ok && (
        <Card>
          <CardHeader>
            <CardTitle>미리보기 · {rows.length}건</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {rows.length}건 가져옵니다.
              {preview.dupes ? ` 이미 있는 ${preview.dupes}건은 제외했습니다.` : ""} 금액은
              CAD 기준이며, 토스(원화)는 자동 환산됩니다. 카테고리는 비워두니 나중에 지정하세요.
            </p>
            <div className="max-h-96 overflow-y-auto rounded-md border">
              <ul className="divide-y text-sm">
                {rows.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="text-muted-foreground">{r.occurredAt}</span>{" "}
                      <span className="truncate">{r.description || "(내용 없음)"}</span>
                    </span>
                    <Money
                      amount={r.type === "expense" ? -r.amount : r.amount}
                      className="shrink-0"
                    />
                  </li>
                ))}
              </ul>
            </div>
            {commit.error && (
              <p className="text-sm text-red-600 dark:text-red-400">{commit.error}</p>
            )}
            <form action={commitAction} className="flex gap-2">
              <input type="hidden" name="account_id" value={preview.accountId} />
              <input type="hidden" name="payload" value={JSON.stringify(rows)} />
              <Button type="submit" disabled={committing || rows.length === 0}>
                {committing ? "가져오는 중…" : `${rows.length}건 가져오기`}
              </Button>
              <Button type="button" variant="outline" render={<Link href="/import" />}>
                취소
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
