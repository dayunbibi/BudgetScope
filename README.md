# BudgetScope

계좌 · 카테고리 · 거래 · 이체가 서로 연결된 가계부 앱. 관계형 DB 설계와 SQL을 제대로 연습하려고 만들었습니다.

**Live**: https://budget-scope.vercel.app

## 왜 만들었는지

프론트엔드 위주 프로젝트만 하다 보니 DB를 제대로 설계해볼 기회가 없었습니다. URL 단축기 같은 단순한 스키마 말고, 계좌 간 이체처럼 실제로 여러 행이 서로 얽히는 구조를 직접 설계하고 SQL을 손으로 짜보는 게 목표였습니다.

## 기능

- 계좌 관리 (은행/현금/카드/투자 등 타입별)
- 카테고리 (하위 카테고리 지원 — 자기참조 구조)
- 거래 기록 (수입/지출, 카테고리·계좌 연결)
- 계좌 간 이체 (한 번의 트랜잭션으로 양쪽 계좌에 반영)
- 계좌별 실시간 잔액 계산 (초기 잔액 + 거래 내역 집계)

## 기술적으로 신경 쓴 부분

- **잔액 계산**: `LEFT JOIN` + `CASE WHEN`(조건부 집계) + `COALESCE` + `GROUP BY`로 거래 0건인 계좌도 안전하게 처리
- **이체 트랜잭션**: 계좌 A→B 이체 시 거래 2행이 원자적으로(BEGIN/COMMIT) 생성되고, `transfer_pair_id`로 서로 연결. 두 행이 서로를 참조해야 하는 문제는 UUID를 서버에서 미리 생성해서 해결, FK는 `DEFERRABLE INITIALLY DEFERRED`로 커밋 시점에만 검증
- **ORM 없이 직접 SQL** — 스키마를 손으로 설계했으니 쿼리도 직접 짜는 게 관계 이해에 도움된다고 판단

## 스택

- Next.js (App Router) + TypeScript + Tailwind
- PostgreSQL (Neon) + `pg` (ORM 미사용)
- Server Actions (별도 API 레이어 없이 서버 로직 처리)
- Vercel 배포

## 로컬 실행

```bash
npm install
npm run db:migrate   # db/schema.sql 적용
npm run dev
```

`.env.local`에 `DATABASE_URL` 필요.
