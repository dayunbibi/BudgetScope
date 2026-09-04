"use server";

import { getPool } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { parseImport, type ParsedRow, type Source } from "@/lib/import-parsers";

export type PreviewState = {
  ok: boolean;
  error?: string;
  rows?: ParsedRow[];
  accountId?: string;
  dupes?: number;
};

export type CommitState = { ok: boolean; error?: string; count?: number };

export async function previewImport(
  _prev: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  try {
    const accountId = String(formData.get("account_id") ?? "");
    const source = String(formData.get("source") ?? "") as Source;
    const file = formData.get("file") as File | null;
    if (!accountId) return { ok: false, error: "계좌를 선택하세요." };
    if (source !== "td" && source !== "toss")
      return { ok: false, error: "파일 형식을 선택하세요." };
    if (!file || file.size === 0)
      return { ok: false, error: "파일을 선택하세요." };

    const buf = await file.arrayBuffer();
    let rows = parseImport(buf, source);
    if (rows.length === 0)
      return { ok: false, error: "가져올 거래가 없습니다. 파일/형식을 확인하세요." };

    // 중복 제거: 같은 계좌에 (날짜|금액|설명) 동일 거래가 이미 있으면 뺀다.
    // ponytail: (날짜,금액,설명) 조합 매칭. 오탐/누락 생기면 import_fingerprint 컬럼 + unique index로.
    const { rows: existing } = await getPool().query<{ key: string }>(
      `SELECT to_char(occurred_at,'YYYY-MM-DD') || '|' || amount::text || '|' || COALESCE(description,'') AS key
       FROM transactions WHERE account_id = $1`,
      [accountId],
    );
    const seen = new Set(existing.map((e) => e.key));
    const before = rows.length;
    rows = rows.filter(
      (r) => !seen.has(`${r.occurredAt}|${r.amount.toFixed(2)}|${r.description}`),
    );
    return { ok: true, rows, accountId, dupes: before - rows.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "파싱 실패" };
  }
}

export async function commitImport(
  _prev: CommitState,
  formData: FormData,
): Promise<CommitState> {
  try {
    const accountId = String(formData.get("account_id") ?? "");
    const rows: ParsedRow[] = JSON.parse(String(formData.get("payload") ?? "[]"));
    if (!accountId || rows.length === 0)
      return { ok: false, error: "가져올 내역이 없습니다." };

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      for (const r of rows) {
        await client.query(
          `INSERT INTO transactions (account_id, type, amount, description, occurred_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [accountId, r.type, r.amount, r.description || null, r.occurredAt],
        );
      }
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
    return { ok: true, count: rows.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "가져오기 실패" };
  }
}
