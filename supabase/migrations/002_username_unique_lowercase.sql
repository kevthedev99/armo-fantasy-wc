-- Enforce lowercase usernames at the database level.
alter table public.profiles
  drop constraint if exists profiles_username_lowercase;

alter table public.profiles
  add constraint profiles_username_lowercase check (username = lower(username));
