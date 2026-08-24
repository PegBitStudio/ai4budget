-- =============================================================================
-- AI Budgeting Assistant - Initial Database Schema
-- =============================================================================
-- Tables: transactions, budgets, savings_goals, commitments, spending_alerts,
--         classification_rules
-- All tables use UUID primary keys with user_id FK to auth.users (ON DELETE CASCADE)
-- Row Level Security (RLS) ensures each user only accesses their own data
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Transactions table
-- ---------------------------------------------------------------------------
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0.01 AND amount <= 999999999.99),
  date DATE NOT NULL,
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 255),
  category TEXT NOT NULL DEFAULT 'Other',
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  source TEXT CHECK (source IS NULL OR char_length(source) <= 255),
  is_manual_category BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_user_category ON transactions(user_id, category);
CREATE INDEX idx_transactions_user_date_range ON transactions(user_id, date) WHERE type = 'expense';

-- Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own transactions"
  ON transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Budgets table
-- ---------------------------------------------------------------------------
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_income NUMERIC(12, 2) NOT NULL,
  allocations JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_budgets_user_period ON budgets(user_id, period_start, period_end);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own budgets"
  ON budgets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Savings goals table
-- ---------------------------------------------------------------------------
CREATE TABLE savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount >= 0.01 AND target_amount <= 999999999.99),
  deadline DATE,
  current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  monthly_contribution NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own savings goals"
  ON savings_goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Financial commitments table
-- ---------------------------------------------------------------------------
CREATE TABLE commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 255),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0.01 AND amount <= 999999999.99),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'yearly')),
  category TEXT NOT NULL DEFAULT 'Other',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own commitments"
  ON commitments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Spending alerts table
-- ---------------------------------------------------------------------------
CREATE TABLE spending_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('warning', 'exceeded')),
  amount_spent NUMERIC(12, 2) NOT NULL,
  budgeted_amount NUMERIC(12, 2) NOT NULL,
  period_start DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_user_period ON spending_alerts(user_id, period_start);

ALTER TABLE spending_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own alerts"
  ON spending_alerts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Classification rules (user corrections) table
-- ---------------------------------------------------------------------------
CREATE TABLE classification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, description)
);

ALTER TABLE classification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own classification rules"
  ON classification_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
