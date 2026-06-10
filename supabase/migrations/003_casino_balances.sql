-- Side casino: daily $500 free-play chips (not real money).
create table if not exists public.casino_balances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance int not null default 500 check (balance >= 0),
  last_reset_date date not null default current_date,
  updated_at timestamptz not null default now()
);

alter table public.casino_balances enable row level security;

create policy "casino_balances_select_own"
  on public.casino_balances for select to authenticated
  using (auth.uid() = user_id);
