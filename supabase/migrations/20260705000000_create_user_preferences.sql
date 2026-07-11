-- Create user_preferences table
create table if not exists public.user_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  key text not null,
  value jsonb not null default '{}',
  updated_at timestamptz default now() not null,
  
  unique(user_id, key)
);

-- Enable RLS
alter table public.user_preferences enable row level security;

-- Policies (user-owned only)
create policy "Users can view their preferences"
  on public.user_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert their preferences"
  on public.user_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their preferences"
  on public.user_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their preferences"
  on public.user_preferences
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Index for performance
create index if not exists idx_user_preferences_user_id on public.user_preferences(user_id);
create index if not exists idx_user_preferences_user_key on public.user_preferences(user_id, key);

-- Comment
comment on table public.user_preferences is 'User-specific preferences (department view, theme, etc.)';
