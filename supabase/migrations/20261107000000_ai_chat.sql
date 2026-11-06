-- Project Evermore – AI chat replies in the in-game phone (optional).
-- A per-person daily counter so the Groq bill can never run away. Only the `ai-chat` Edge Function (server side,
-- with the secret key) touches it: the app's public roles get no access at all.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
-- No policies on purpose: anon / authenticated can never read or write it.
revoke all on public.ai_usage from anon, authenticated;
grant select, insert, update on public.ai_usage to service_role;

-- Take one reply from today's allowance. Returns today's count, or -1 when the cap is reached.
create or replace function public.ai_take_turn(p_user uuid, p_cap integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.ai_usage as u (user_id, day, count)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = u.count + 1
  returning u.count into n;
  if n > p_cap then
    return -1;
  end if;
  return n;
end;
$$;

-- Only the server may call it (Postgres grants EXECUTE to PUBLIC by default; take that away).
revoke execute on function public.ai_take_turn(uuid, integer) from public, anon, authenticated;
grant execute on function public.ai_take_turn(uuid, integer) to service_role;
