-- World leaderboard. The browser never touches the table: it calls
-- submit_score() and leaderboard(), which validate and rank.

create table public.scores (
  id bigint generated always as identity primary key,
  player uuid not null,                 -- random id kept in the player's browser
  name text not null check (name ~ '^[A-Z0-9 .!?_-]{1,10}$'),
  score integer not null check (score >= 100 and score % 100 = 0),
  round smallint not null check (round between 1 and 99),
  mode smallint not null check (mode in (1, 2)),
  ducks smallint not null check (ducks >= 0),
  created_at timestamptz not null default now(),
  -- Possible in the real game: at most 10 ducks a round at up to 3000 each plus
  -- a perfect bonus of up to 30000, and every cleared round needs 6+ ducks.
  check (ducks <= round * 10),
  check (ducks >= 6 * (round - 1)),
  check (score <= round * 60000),
  check (score >= ducks * 500)
);

create index scores_player_idx on public.scores (player, created_at desc);
create index scores_score_idx on public.scores (score desc, created_at);

-- No direct access for site visitors.
alter table public.scores enable row level security;
revoke all on public.scores from anon, authenticated;

-- Each player's best run.
create view public.best_scores with (security_invoker = false) as
select distinct on (player) player, name, score, round, mode, ducks, created_at
from public.scores
order by player, score desc, created_at;
revoke all on public.best_scores from anon, authenticated;

create function public.submit_score(p_player uuid, p_name text, p_score integer,
                                    p_round integer, p_mode integer, p_ducks integer)
returns table (rank bigint, best integer)
language plpgsql security definer set search_path = public as $$
declare
  clean text := upper(btrim(regexp_replace(p_name, '\s+', ' ', 'g')));
begin
  if exists (select 1 from scores s where s.player = p_player and s.created_at > now() - interval '15 seconds') then
    raise exception 'Too many submissions, try again in a moment' using errcode = 'P0001';
  end if;
  begin
    insert into scores (player, name, score, round, mode, ducks)
    values (p_player, clean, p_score, p_round, p_mode, p_ducks);
  exception when check_violation then
    raise exception '%', case when clean !~ '^[A-Z0-9 .!?_-]{1,10}$'
      then 'Names can use up to 10 letters, numbers, spaces and . ! ? _ -'
      else 'That run doesn''t add up, so it wasn''t saved' end using errcode = 'P0001';
  end;
  -- Later runs rename the player everywhere on the board.
  update scores set name = clean where player = p_player and name <> clean;
  return query
    select (select count(*) + 1 from best_scores b where b.score > me.score), me.score
    from best_scores me where me.player = p_player;
end $$;

create function public.leaderboard(p_player uuid default null, p_limit integer default 50)
returns table (rank bigint, name text, score integer, round smallint, mode smallint, is_me boolean)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select rank() over (order by score desc) as rank, player, name, score, round, mode,
           row_number() over (order by score desc, created_at) as pos
    from best_scores
  )
  select rank, name, score, round, mode, player = p_player
  from ranked
  where pos <= least(greatest(p_limit, 1), 100) or player = p_player
  order by pos;
$$;

revoke all on function public.submit_score, public.leaderboard from public;
grant execute on function public.submit_score, public.leaderboard to anon;
