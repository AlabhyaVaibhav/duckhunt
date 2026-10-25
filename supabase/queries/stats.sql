-- Game stats. Paste a query into the Supabase dashboard's SQL Editor and run it
-- (save them there as snippets). Times are UTC.

-- 1. Daily overview: players, games, and how they played.
select date_trunc('day', created_at)::date                       as day,
       count(distinct player)                                    as players,
       count(*) filter (where kind = 'game_start')               as games,
       count(*) filter (where kind = 'game_start' and gun = 'finger') as finger_games,
       count(*) filter (where kind = 'game_start' and gun = 'mouse')  as mouse_games,
       count(*) filter (where kind = 'tutorial_done')            as tutorials_finished,
       count(*) filter (where kind = 'camera_fail')              as camera_failures,
       count(*) filter (where kind = 'share')                    as shares
from events
group by 1
order by 1 desc
limit 30;

-- 2. How far people get: games ending in each round, by gun.
select round,
       count(*) filter (where gun = 'finger') as finger,
       count(*) filter (where gun = 'mouse')  as mouse,
       count(*)                               as all_games
from events
where kind = 'game_over'
group by round
order by round;

-- 3. Survival: share of games that reached at least each round.
with ends as (select round from events where kind = 'game_over')
select r.round,
       round(100.0 * count(*) filter (where e.round >= r.round) / nullif(count(*), 0), 1) as pct_reached
from generate_series(1, 15) as r(round)
cross join ends e
group by r.round
order by r.round;

-- 4. Start screen funnel: of players who picked the finger gun, how many
--    got the camera working, finished practice, and played a game with it.
with p as (
  select player,
         bool_or(kind = 'visit' and gun = 'finger')       as chose_finger,
         bool_or(kind = 'camera_fail')                    as camera_failed,
         bool_or(kind = 'tutorial_start')                 as started_practice,
         bool_or(kind = 'tutorial_done')                  as finished_practice,
         bool_or(kind = 'game_start' and gun = 'finger')  as played_finger
  from events
  group by player
)
select count(*) filter (where chose_finger)                       as chose_finger,
       count(*) filter (where chose_finger and camera_failed)     as camera_failed,
       count(*) filter (where started_practice)                   as started_practice,
       count(*) filter (where finished_practice)                  as finished_practice,
       count(*) filter (where played_finger)                      as played_finger
from p;

-- 5. Scores: average and best per gun and game type.
select gun, mode, count(*) as games, round(avg(score)) as avg_score, max(score) as best, max(round) as best_round
from events
where kind = 'game_over'
group by gun, mode
order by gun, mode;

-- 6. Housekeeping: delete events older than a year.
-- delete from events where created_at < now() - interval '1 year';
