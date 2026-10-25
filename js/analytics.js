// Anonymous gameplay events (games started, rounds reached, gun used) for the
// stats in supabase/queries/stats.sql. Fire and forget: failures are ignored
// and never affect the game. Local development only logs to the console.
import { SUPABASE } from './config.js';
import { LEADERBOARD_ON, playerId } from './leaderboard.js';

const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

// `kind` is one the database accepts (see the events migration); `data` may
// carry gun, mode, round and score.
export function track(kind, { gun = null, mode = null, round = null, score = null } = {}) {
  const body = { p_player: playerId(), p_kind: kind, p_gun: gun, p_mode: mode, p_round: round, p_score: score };
  if (LOCAL) { console.debug('[track]', kind, { gun, mode, round, score }); return; }
  if (!LEADERBOARD_ON) return;
  fetch(`${SUPABASE.url}/rest/v1/rpc/log_event`, {
    method: 'POST',
    headers: { apikey: SUPABASE.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}
