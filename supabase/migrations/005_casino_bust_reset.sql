-- Bust reset: when balance hits 0, chips return after 12 hours (not daily midnight).
alter table public.casino_balances
  add column if not exists busted_at timestamptz;
