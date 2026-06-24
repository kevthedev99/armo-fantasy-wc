-- Track when we last pulled the full fixture list from API-Football.
alter table public.app_settings
  add column if not exists last_full_sync_at timestamptz;
