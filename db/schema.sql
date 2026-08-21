-- BudgetScope schema (PostgreSQL)

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

CREATE TYPE account_type AS ENUM ('checking', 'savings', 'credit_card', 'cash', 'investment');
CREATE TYPE category_kind AS ENUM ('income', 'expense');
CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE recurrence_frequency AS ENUM ('daily', 'weekly', 'monthly', 'yearly');

-- 계좌
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type account_type NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'KRW',
    initial_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 카테고리 (자기참조로 하위 카테고리 표현)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind category_kind NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (parent_id, name)
);

-- 거래 내역
-- amount 부호: income/expense는 항상 양수(방향은 type이 결정), transfer는 부호 자체가 방향
-- (출금 쪽 행은 음수, 입금 쪽 행은 양수) — 두 행이 대칭이라 type만으로는 방향을 못 정하기 때문
-- transfer는 계좌 간 이동: 두 행(출금 쪽 account, 입금 쪽 account)이 transfer_pair_id로 서로를 가리킴.
-- 두 행이 서로를 참조하는 chicken-and-egg 문제라 FK를 DEFERRABLE INITIALLY DEFERRED로 선언해서
-- 커밋 시점에만 검증하고, 트랜잭션 안에서 두 행을 순서 상관없이 넣을 수 있게 함
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    type transaction_type NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    description TEXT,
    occurred_at DATE NOT NULL,
    transfer_pair_id UUID REFERENCES transactions(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT transfer_has_no_category CHECK (
        (type = 'transfer' AND category_id IS NULL) OR (type <> 'transfer')
    ),
    CONSTRAINT amount_sign_by_type CHECK (
        (type = 'transfer' AND amount <> 0) OR (type <> 'transfer' AND amount > 0)
    )
);

-- 반복 거래 (매달 월세, 매주 용돈 등). 실제 transactions 행은 스케줄러/앱 로직이 next_run_date에 맞춰 생성
CREATE TABLE recurring_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    type transaction_type NOT NULL CHECK (type <> 'transfer'),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    frequency recurrence_frequency NOT NULL,
    interval INT NOT NULL DEFAULT 1 CHECK (interval > 0),
    start_date DATE NOT NULL,
    end_date DATE,
    next_run_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_date IS NULL OR end_date >= start_date)
);

-- 태그 (다대다 실습용: 거래 하나에 태그 여러 개, 태그 하나가 여러 거래에)
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE transaction_tags (
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, tag_id)
);

CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_occurred_at ON transactions(occurred_at);
CREATE INDEX idx_recurring_next_run ON recurring_transactions(next_run_date);
