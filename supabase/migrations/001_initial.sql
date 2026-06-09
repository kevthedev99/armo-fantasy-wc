-- Armo Fantasy World Cup — initial schema
-- Run in Supabase SQL Editor after creating your project.

-- Profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_color text not null default '#FF007A',
  total_points int not null default 0,
  total_wins int not null default 0,
  current_streak int not null default 0,
  created_at timestamptz not null default now()
);

-- Matches synced from API-Football
create table if not exists public.matches (
  id bigint primary key,
  round text not null,
  group_name text,
  stage text not null check (stage in ('group', 'knockout')),
  home_team_id int not null,
  home_team_name text not null,
  home_team_logo text,
  away_team_id int not null,
  away_team_name text not null,
  away_team_logo text,
  kickoff_at timestamptz not null,
  status text not null default 'NS',
  home_score int,
  away_score int,
  winning_goal_minute int,
  updated_at timestamptz not null default now()
);

create index if not exists matches_kickoff_idx on public.matches (kickoff_at);
create index if not exists matches_stage_idx on public.matches (stage);

-- User picks
create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id bigint not null references public.matches(id) on delete cascade,
  picked_winner text not null check (picked_winner in ('home', 'away', 'draw')),
  home_score_pred int,
  away_score_pred int,
  winning_goal_minute_pred int,
  points_earned int not null default 0,
  is_scored boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create index if not exists picks_user_idx on public.picks (user_id);
create index if not exists picks_match_idx on public.picks (match_id);

-- App settings (single row)
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  knockout_unlocked boolean not null default false,
  group_stage_complete boolean not null default false,
  last_sync_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (1) on conflict do nothing;

-- News ticker items
create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.picks enable row level security;
alter table public.app_settings enable row level security;
alter table public.news enable row level security;

-- Profiles: anyone authenticated can read; users update own row
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);

-- Matches: all authenticated users can read
create policy "matches_select" on public.matches for select to authenticated using (true);

-- Picks: users read all (for transparency), write own only
create policy "picks_select" on public.picks for select to authenticated using (true);
create policy "picks_insert_own" on public.picks for insert to authenticated with check (auth.uid() = user_id);
create policy "picks_update_own" on public.picks for update to authenticated using (auth.uid() = user_id);

-- App settings: read for all authenticated
create policy "settings_select" on public.app_settings for select to authenticated using (true);

-- News: read for all authenticated
create policy "news_select" on public.news for select to authenticated using (true);

-- Service role bypasses RLS for sync/scoring cron jobs
