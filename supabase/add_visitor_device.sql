-- Store the best device name exposed by the visitor's browser.
-- Existing rows remain "Unknown" because their device was not recorded.
alter table public.visitors
  add column if not exists device_type text not null default 'Unknown';
alter table public.visitors
  add column if not exists device_name text not null default 'Unknown';

drop policy if exists "visitors_insert_public" on public.visitors;
create policy "visitors_insert_public" on public.visitors
for insert to anon
with check (
  char_length(session_id) between 1 and 128
  and device_type in ('Mobile', 'Tablet', 'Desktop', 'Unknown')
  and char_length(device_name) between 1 and 100
);
