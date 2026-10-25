-- Anonymous gameplay events: how many games start, which gun, how far people
-- get. The browser can only call log_event(); reading is for the dashboard
-- (see supabase/queries/stats.sql). No names, no IP addresses: just the random
-- player id the leaderboard already uses.

create table public.events (
  id bigint generated always as identity primary key,
  player uuid not null,
  kind text not null check (kind in (
    'visit',          -- picked a gun on the start screen
    'camera_fail',    -- the finger gun couldn't start
    'tutorial_start', 'tutorial_done', 'tutorial_quit',
    'game_start', 'round', 'game_over',
    'share'
  )),
  gun text check (gun in ('finger', 'mouse')),
  mode smallint check (mode in (1, 2)),
  round smallint check (round between 1 and 999),
  score integer check (score between 0 and 99999900),
  created_at timestamptz not null default now()
);

create index events_kind_idx on public.events (kind, created_at);
create index events_player_idx on public.events (player, created_at desc);

alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;

-- Fire and forget: bad or excessive input is dropped quietly, never an error.
create function public.log_event(p_player uuid, p_kind text, p_gun text default null,
                                 p_mode integer default null, p_round integer default null,
                                 p_score integer default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  -- A real game sends a handful of events a minute; cap each player at 60.
  if (select count(*) from events e where e.player = p_player and e.created_at > now() - interval '1 minute') >= 60 then
    return;
  end if;
  insert into events (player, kind, gun, mode, round, score)
  values (p_player, p_kind, p_gun, p_mode, p_round, p_score);
exception when check_violation or not_null_violation then
  return;
end $$;

revoke all on function public.log_event from public;
grant execute on function public.log_event to anon;

notify pgrst, 'reload schema';
