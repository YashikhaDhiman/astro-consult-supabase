-- scripts/setup-queue-metrics.sql
-- Creates a lightweight metrics table and an incremental trigger to maintain
-- the 'active_chats' metric when chats are inserted/updated/deleted.

-- 1) Create metrics table
create table if not exists public.queue_metrics (
  metric_key text primary key,
  count integer not null default 0,
  updated_at timestamp with time zone default now()
);

-- 2) Initialize the active_chats metric from existing data
insert into public.queue_metrics (metric_key, count)
select 'active_chats', coalesce(cnt, 0)
from (
  select count(*) as cnt from public.chats where status = 'active'
) t
on conflict (metric_key) do update set count = excluded.count, updated_at = now();

-- 3) Create an incremental trigger function that updates the metric
create or replace function public.refresh_active_chats_metric_incremental()
returns trigger as $$
declare
  delta int := 0;
begin
  if (TG_OP = 'INSERT') then
    if (new.status = 'active') then
      delta := 1;
    end if;
  elsif (TG_OP = 'DELETE') then
    if (old.status = 'active') then
      delta := -1;
    end if;
  elsif (TG_OP = 'UPDATE') then
    if (old.status <> 'active' and new.status = 'active') then
      delta := 1;
    elsif (old.status = 'active' and new.status <> 'active') then
      delta := -1;
    else
      delta := 0;
    end if;
  end if;

  if (delta != 0) then
    -- Try to update the metric row; if it doesn't exist, insert it with a safe value.
    update public.queue_metrics
    set count = greatest(coalesce(count,0) + delta, 0), updated_at = now()
    where metric_key = 'active_chats';

    if not found then
      -- Fallback: compute current count and insert (safe for cold starts)
      insert into public.queue_metrics(metric_key, count, updated_at)
      select 'active_chats', (select count(*) from public.chats where status = 'active'), now();
    end if;
  end if;

  return null; -- statement trigger
end;
$$ language plpgsql security definer;

-- 4) Attach the trigger to chats as a statement-level trigger (one update per statement)
drop trigger if exists trg_refresh_active_chats_inc on public.chats;
create trigger trg_refresh_active_chats_inc
after insert or update or delete on public.chats
for each statement
execute function public.refresh_active_chats_metric_incremental();

-- 5) Enable RLS on metrics and add a minimal SELECT policy for public (optional)
alter table public.queue_metrics enable row level security;

-- Allow public role to select metrics (you can scope this to metric_key='active_chats')
create policy public_select_metrics on public.queue_metrics
  for select
  using (true);

-- Optional: to restrict to only the active_chats metric, use:
-- create policy public_select_active_only on public.queue_metrics
--   for select
--   using (metric_key = 'active_chats');
