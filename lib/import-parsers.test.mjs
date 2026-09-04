// 파서 자체 검증. 실행: node lib/import-parsers.test.mjs
import assert from "node:assert";
import * as XLSX from "xlsx";
import { parseImport, KRW_TO_CAD } from "./import-parsers.ts";

// --- TD: 헤더 없는 CSV ---
const tdCsv = [
  "09/01/2026,TIM HORTONS #4021,4.85,,1250.00",
  "09/02/2026,PAYROLL DEPOSIT,,2100.00,3350.00",
  "09/03/2026,LOBLAWS,87.42,,3262.58",
].join("\n");
const tdRows = parseImport(new TextEncoder().encode(tdCsv).buffer, "td");
assert.equal(tdRows.length, 3);
assert.deepEqual(tdRows[0], {
  occurredAt: "2026-09-01",
  description: "TIM HORTONS #4021",
  amount: 4.85,
  type: "expense",
});
assert.equal(tdRows[1].type, "income");
assert.equal(tdRows[1].amount, 2100);
assert.equal(tdRows[1].occurredAt, "2026-09-02");

// --- 토스: 상단 메타 + 헤더 + 데이터를 시트로 구성 ---
const tossAoa = [
  ["토스뱅크 거래내역"],
  ["계좌번호", "1000-0000-0000"],
  [],
  ["거래일시", "적요", "출금", "입금", "거래후잔액"],
  ["2026-09-01 12:30:00", "스타벅스", "5900", "", "994100"],
  ["2026-09-02 09:00:00", "급여", "", "3000000", "3994100"],
];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tossAoa), "s");
const tossBuf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
const tossRows = parseImport(tossBuf, "toss");
assert.equal(tossRows.length, 2, "토스 2건");
assert.equal(tossRows[0].occurredAt, "2026-09-01");
assert.equal(tossRows[0].type, "expense");
assert.equal(tossRows[0].description, "스타벅스");
assert.equal(tossRows[0].amount, Math.round(5900 * KRW_TO_CAD * 100) / 100);
assert.equal(tossRows[1].type, "income");

console.log("ok — TD", tdRows.length, "건, 토스", tossRows.length, "건");
console.log("토스 5900원 =>", tossRows[0].amount, "CAD");
