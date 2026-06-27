-- Auto-set completed_at on tasks when status changes to 'completed'.
-- This ensures completed_at is always populated even if application code
-- forgets to set it manually.

create or replace function public.set_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    new.completed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists set_tasks_completed_at on public.tasks;
create trigger set_tasks_completed_at
before update of status on public.tasks
for each row
when (new.status = 'completed' and old.status is distinct from 'completed')
execute function public.set_completed_at();

comment on function public.set_completed_at() is
  'Trigger function that auto-populates completed_at when task status becomes completed.';

-- Add index on tasks(user_id) for delete policy filter performance
create index if not exists tasks_user_id_idx on public.tasks(user_id);

notify pgrst, 'reload schema';
