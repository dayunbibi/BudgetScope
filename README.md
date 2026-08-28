# BudgetScope

A budgeting app where accounts, categories, transactions, and transfers are all properly connected. Built to practice real relational database design and raw SQL.

**Live**: https://budget-scope.vercel.app

## Why I built this

Most of my earlier projects were frontend-heavy, so I never got real practice designing a database. Instead of something with a trivial schema (like a URL shortener), I wanted to design something where multiple rows actually depend on each other — like an account-to-account transfer — and write the SQL by hand.

## Features

- Account management (checking / savings / credit card / cash / investment)
- Categories with subcategories (self-referencing structure)
- Transactions (income/expense, linked to an account and category)
- Account-to-account transfers (both sides updated in a single transaction)
- Real-time account balances (initial balance + aggregated transaction history)

## Technical highlights

- **Balance calculation**: `LEFT JOIN` + `CASE WHEN` (conditional aggregation) + `COALESCE` + `GROUP BY`, so accounts with zero transactions are still handled correctly
- **Transfer transactions**: A transfer creates two linked rows atomically (`BEGIN`/`COMMIT`), connected by `transfer_pair_id`. Since each row needs to reference the other, the UUIDs are generated on the server ahead of time, and the foreign key is `DEFERRABLE INITIALLY DEFERRED` so it's only validated at commit time
- **No ORM** — the schema was designed by hand, so the queries are written by hand too, on purpose, to actually understand the relationships

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- PostgreSQL (Neon) + `pg` (no ORM)
- Server Actions (no separate API layer)
- Deployed on Vercel

## Running locally

```bash
npm install
npm run db:migrate   # applies db/schema.sql
npm run dev
```

Requires `DATABASE_URL` in `.env.local`.
