-- Record how each run was played: 'finger' (thumb trigger on the webcam) or
-- 'mouse' (any click or space bar shot). Runs saved before this are null.

alter table public.scores add column gun text check (gun in ('finger', 'mouse'));

create or replace view public.best_scores with (security_invoker = false) as
select distinct on (player) player, name, score, round, mode, ducks, created_at, gun
from public.scores
order by player, score desc, created_at;
revoke all on public.best_scores from anon, authenticated;

-- New signatures: drop the old ones so PostgREST has a single match.
drop function public.submit_score(uuid, text, integer, integer, integer, integer);
drop function public.leaderboard(uuid, integer);

create function public.submit_score(p_player uuid, p_name text, p_score integer,
                                    p_round integer, p_mode integer, p_ducks integer,
                                    p_gun text default null)
returns table (rank bigint, best integer)
language plpgsql security definer set search_path = public as $$
declare
  clean text := upper(btrim(regexp_replace(p_name, '\s+', ' ', 'g')));
begin
  if exists (select 1 from scores s where s.player = p_player and s.created_at > now() - interval '15 seconds') then
    raise exception 'Too many submissions, try again in a moment' using errcode = 'P0001';
  end if;
  begin
    insert into scores (player, name, score, round, mode, ducks, gun)
    values (p_player, clean, p_score, p_round, p_mode, p_ducks, p_gun);
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
returns table (rank bigint, name text, score integer, round smallint, mode smallint, gun text, is_me boolean)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select rank() over (order by score desc) as rank, player, name, score, round, mode, gun,
           row_number() over (order by score desc, created_at) as pos
    from best_scores
  )
  select rank, name, score, round, mode, gun, player = p_player
  from ranked
  where pos <= least(greatest(p_limit, 1), 100) or player = p_player
  order by pos;
$$;

revoke all on function public.submit_score, public.leaderboard from public;
grant execute on function public.submit_score, public.leaderboard to anon;

-- Ask PostgREST to pick up the new function signatures right away.
notify pgrst, 'reload schema';
