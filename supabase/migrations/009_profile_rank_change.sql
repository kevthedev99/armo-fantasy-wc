-- Spots moved on leaderboard after the last finished match batch (+ up, - down).
alter table public.profiles
  add column if not exists rank_change int not null default 0;
