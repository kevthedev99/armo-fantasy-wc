-- Ephemeral beta chat (messages purged by API after 30 minutes).

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_created_idx
  on public.chat_messages (created_at desc);

alter table public.chat_messages enable row level security;

create policy "chat_select" on public.chat_messages
  for select to authenticated using (true);

create policy "chat_insert_own" on public.chat_messages
  for insert to authenticated with check (auth.uid() = user_id);
