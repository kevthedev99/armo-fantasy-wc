-- NCAA-style picks on bracket slots before fixtures sync (same tree position).

create table if not exists public.bracket_slot_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  round_id text not null check (
    round_id in ('r16', 'qf', 'sf', 'final', 'third')
  ),
  slot_index int not null check (slot_index >= 0),
  home_team_id int not null,
  away_team_id int not null,
  picked_winner text not null check (picked_winner in ('home', 'away', 'draw')),
  home_score_pred int,
  away_score_pred int,
  predicts_penalties boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, round_id, slot_index)
);

create index if not exists bracket_slot_picks_user_idx
  on public.bracket_slot_picks (user_id);

alter table public.bracket_slot_picks enable row level security;

create policy "bracket_slot_picks_select"
  on public.bracket_slot_picks for select to authenticated using (true);

create policy "bracket_slot_picks_insert_own"
  on public.bracket_slot_picks for insert to authenticated
  with check (auth.uid() = user_id);

create policy "bracket_slot_picks_update_own"
  on public.bracket_slot_picks for update to authenticated
  using (auth.uid() = user_id);

create policy "bracket_slot_picks_delete_own"
  on public.bracket_slot_picks for delete to authenticated
  using (auth.uid() = user_id);
