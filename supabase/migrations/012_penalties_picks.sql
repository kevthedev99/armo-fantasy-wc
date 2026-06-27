-- Knockout penalty shootout picks and match pen scores from API-Football
alter table public.matches
  add column if not exists pen_home_score int,
  add column if not exists pen_away_score int;

alter table public.picks
  add column if not exists predicts_penalties boolean not null default false;
