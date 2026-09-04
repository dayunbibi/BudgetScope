import * as XLSX from "xlsx";

export type Source = "td" | "toss";

export type ParsedRow = {
  occurredAt: string; // YYYY-MM-DD
  description: string;
  amount: number; // 양수, CAD 기준 (방향은 type이 결정)
  type: "income" | "expense";
};

// ponytail: 고정 환율. 실제로는 거래일마다 환율이 다르지만 개인 가계부엔 충분.
// 값 갱신은 이 한 줄만 고치면 됨. (2026년 초 대략 1 CAD ≈ 985 KRW)
export const KRW_TO_CAD = 1 / 985;

function toISODate(raw: unknown): string {
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  const s = String(raw ?? "").trim();
  let m: RegExpMatchArray | null;
  // 2026-01-05 / 2026.01.05 / 2026. 1. 5. / 2026/1/5
  if ((m = s.match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/))) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  // MM/DD/YYYY (TD)
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) {
    return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  throw new Error(`날짜를 못 읽음: "${s}"`);
}

function num(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  const n = Number(String(raw).replace(/[,\s₩$]/g, ""));
  return isNaN(n) ? 0 : Math.abs(n);
}

export function parseImport(buf: ArrayBuffer, source: Source): ParsedRow[] {
  const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });
  const parsed = source === "td" ? parseTD(rows) : parseToss(rows);
  return parsed.filter((r) => r.amount > 0);
}

// TD Canada EasyWeb CSV: 헤더 행 없음. 컬럼 순서:
// [거래일 MM/DD/YYYY, 내용, 출금(debit), 입금(credit), 잔액]
function parseTD(rows: unknown[][]): ParsedRow[] {
  const out: ParsedRow[] = [];
  for (const r of rows) {
    if (!r || r.length < 4) continue;
    const [date, desc, debit, credit] = r;
    if (!date || !/\d/.test(String(date))) continue; // 혹시 섞인 헤더/빈 줄 skip
    const outAmt = num(debit);
    const inAmt = num(credit);
    if (outAmt === 0 && inAmt === 0) continue;
    out.push({
      occurredAt: toISODate(date),
      description: String(desc ?? "").trim(),
      amount: outAmt > 0 ? outAmt : inAmt,
      type: outAmt > 0 ? "expense" : "income",
    });
  }
  return out;
}

// 토스뱅크 거래내역 엑셀: 상단에 계좌 정보 몇 줄 + 헤더 행 + 데이터.
// 컬럼명이 버전마다 조금씩 달라서 헤더를 fuzzy 매칭한다.
// 실제 토스뱅크 거래내역 엑셀 확인한 포맷 (2026-09):
// 거래 일시 | 적요 | 거래 유형 | 거래 기관 | 계좌번호 | 거래 금액(부호 있음, 출금 음수) | 거래 후 잔액 | 메모
// 출금/입금 컬럼이 따로 있는 옛 포맷도 혹시 몰라 fallback으로 남겨둠.
function parseToss(rows: unknown[][]): ParsedRow[] {
  const headerIdx = rows.findIndex((r) =>
    r?.some((c) => /일시|날짜|거래일/.test(String(c ?? ""))),
  );
  if (headerIdx === -1) {
    throw new Error("토스 엑셀에서 헤더 행(거래일시 등)을 못 찾음");
  }
  const header = rows[headerIdx].map((c) => String(c ?? "").trim());
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const iDate = col(/일시|날짜|거래일/);
  const iAmt = col(/거래\s*금액|^금액$/);
  const iOut = col(/출금/);
  const iIn = col(/입금/);
  const iDesc = col(/적요|내용|보내|받는|가맹|메모|구분|거래처/);
  if (iDate === -1 || (iAmt === -1 && iOut === -1 && iIn === -1)) {
    throw new Error("토스 엑셀 컬럼(거래 금액 등)을 못 찾음");
  }
  const out: ParsedRow[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    if (!r || !r[iDate]) continue;

    let krw: number;
    let isExpense: boolean;
    if (iAmt !== -1) {
      const s = String(r[iAmt] ?? "").trim();
      if (!s) continue;
      krw = num(s);
      if (krw === 0) continue;
      isExpense = /^-/.test(s.replace(/[,\s₩]/g, ""));
    } else {
      const outKrw = iOut === -1 ? 0 : num(r[iOut]);
      const inKrw = iIn === -1 ? 0 : num(r[iIn]);
      if (outKrw === 0 && inKrw === 0) continue;
      krw = outKrw > 0 ? outKrw : inKrw;
      isExpense = outKrw > 0;
    }

    out.push({
      occurredAt: toISODate(r[iDate]),
      description: iDesc === -1 ? "" : String(r[iDesc] ?? "").trim(),
      amount: Math.round(krw * KRW_TO_CAD * 100) / 100,
      type: isExpense ? "expense" : "income",
    });
  }
  return out;
}
