-- Active blackjack hand stored server-side between hit/stand actions.
alter table public.casino_balances
  add column if not exists blackjack_state jsonb;
