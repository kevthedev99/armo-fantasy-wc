-- Live match events from API-Football (goals, red cards).
alter table public.matches
  add column if not exists match_events jsonb not null default '[]'::jsonb;
