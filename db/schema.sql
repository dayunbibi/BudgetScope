-- BudgetScope schema (PostgreSQL)

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

CREATE TYPE account_type AS ENUM ('checking', 'savings', 'credit_card', 'cash', 'investment');
CREATE TYPE category_kind AS ENUM ('income', 'expense');
CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE recurrence_frequency AS ENUM ('daily', 'weekly', 'monthly', 'yearly');

-- accounts
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type account_type NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'CAD', -- the app works in CAD
    initial_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- categories (self-reference for subcategories)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind category_kind NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (parent_id, name)
);

-- transactions
-- amount sign: income/expense are always positive (type decides the direction).
-- For transfers the sign IS the direction: the "from" row is negative, the "to" row is positive,
-- because both rows have type = 'transfer' and type alone can't tell them apart.
-- The two rows point at each other with transfer_pair_id. That's a chicken-and-egg problem,
-- so the FK is DEFERRABLE INITIALLY DEFERRED: it's only checked on COMMIT,
-- and both rows can be inserted in any order inside one transaction.
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

-- recurring transactions (monthly rent, weekly allowance...). Real rows get created from next_run_date
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

-- tags (many-to-many practice: one transaction can have many tags and vice versa)
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
