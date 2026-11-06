-- Project Evermore – optional cloud sync.
-- Two tiny pieces: one save row per user, and a private photo bucket.
-- Apply in the Supabase SQL editor or with `supabase db push`. Nothing here is destructive.

-- ---------------------------------------------------------------- saves
create table if not exists public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  constraint saves_data_is_object check (jsonb_typeof(data) = 'object'),
  constraint saves_data_size check (pg_column_size(data) < 2000000)
);

alter table public.saves enable row level security;

-- The Data API may not expose new tables automatically; grant only what the client needs.
revoke all on public.saves from anon;
grant select, insert, update on public.saves to authenticated;

-- Each signed-in (non-anonymous) user can only see and write their own row.
create policy "saves: read own"
  on public.saves for select
  to authenticated
  using ( (select auth.uid()) = user_id and coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) = false );

create policy "saves: insert own"
  on public.saves for insert
  to authenticated
  with check ( (select auth.uid()) = user_id and coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) = false );

create policy "saves: update own"
  on public.saves for update
  to authenticated
  using ( (select auth.uid()) = user_id )
  with check ( (select auth.uid()) = user_id );

-- No delete policy: the client can never delete saves.

-- ---------------------------------------------------------------- private photos
-- Private bucket: files are only reachable through short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('memories', 'memories', false)
on conflict (id) do nothing;

-- Signed-in, non-anonymous users (only the two of you – sign-ups are disabled) may read photos.
-- Uploading is done by you in the Supabase dashboard, so no insert/update/delete policies exist.
create policy "memories: read for members"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'memories'
    and coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );
