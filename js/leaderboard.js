// World leaderboard: submit a game-over score under a name, and view the top 50.
// Talks to two Supabase database functions over REST; no client library needed.
import { SUPABASE } from './config.js';

const $ = s => document.querySelector(s);
export const LEADERBOARD_ON = Boolean(SUPABASE.url && SUPABASE.key);
const NAME_MAX = 10;
const fmt = n => n.toLocaleString('en-US');

function stored(key, make) {
  try {
    let v = localStorage.getItem(key);
    if (!v && make) { v = make(); localStorage.setItem(key, v); }
    return v;
  } catch {
    return make?.() ?? null;
  }
}

// A random id for this browser, so a player's runs count as one entry.
const playerId = () => stored('duckhunt.player', () => crypto.randomUUID());

// Upper case, the characters the database accepts, single spaces, 10 long.
export const cleanName = s => s.toUpperCase().replace(/[^A-Z0-9 .!?_-]/g, '').replace(/\s+/g, ' ').slice(0, NAME_MAX);

async function rpc(fn, body) {
  const res = await fetch(`${SUPABASE.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE.key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `Leaderboard error ${res.status}`);
  return data;
}

export class Leaderboard {
  constructor() {
    this.el = $('#board');
    this.form = $('#lbForm');
    this.input = $('#lbName');
    this.status = $('#lbStatus');
    this.result = null;
    this.onClose = null;
    for (const el of document.querySelectorAll('[data-leaderboard]')) el.hidden = !LEADERBOARD_ON;
    if (!LEADERBOARD_ON) return;

    this.input.maxLength = NAME_MAX;
    this.input.addEventListener('input', () => {
      const at = this.input.selectionStart;
      this.input.value = cleanName(this.input.value);
      this.input.setSelectionRange(at, at);
    });
    this.form.addEventListener('submit', e => { e.preventDefault(); this.submit(); });
    $('#boardClose').addEventListener('click', () => this.hide());
  }

  get visible() { return !this.el.hidden; }

  // Readies the name form in the share panel for a game-over result; null
  // (sharing a best score or an invite) leaves just the VIEW TOP 50 button.
  offer(result) {
    if (!LEADERBOARD_ON) return;
    this.result = result;
    this.status.textContent = result && !result.score ? 'Hit a duck to get on the world leaderboard.' : '';
    this.form.hidden = !result?.score;
    if (this.form.hidden) return;
    this.input.value = stored('duckhunt.name') ?? '';
    this.input.disabled = false;
    $('#lbSubmit').disabled = false;
  }

  async submit() {
    const name = cleanName(this.input.value).trim();
    if (!name) { this.status.textContent = 'Type a name first.'; this.input.focus(); return; }
    try { localStorage.setItem('duckhunt.name', name); } catch { /* storage unavailable */ }
    const r = this.result;
    $('#lbSubmit').disabled = this.input.disabled = true;
    this.status.textContent = 'Saving…';
    try {
      const [row] = await rpc('submit_score', {
        p_player: playerId(), p_name: name, p_score: r.score, p_round: r.round, p_mode: r.mode, p_ducks: r.ducks,
      });
      this.form.hidden = true;
      this.status.textContent = row.best > r.score
        ? `Saved! Your best, ${fmt(row.best)}, is #${fmt(row.rank)} in the world.`
        : `Saved! You're #${fmt(row.rank)} in the world.`;
    } catch (err) {
      $('#lbSubmit').disabled = this.input.disabled = false;
      this.status.textContent = `Couldn't save: ${err.message}`;
    }
  }

  async show() {
    this.el.hidden = false;
    $('#boardClose').focus();
    const body = $('#boardRows');
    const msg = $('#boardMsg');
    body.replaceChildren();
    msg.textContent = 'Loading…';
    try {
      const rows = await rpc('leaderboard', { p_player: stored('duckhunt.player'), p_limit: 50 });
      msg.textContent = rows.length ? '' : 'No scores yet. Be the first!';
      rows.forEach((row, i) => {
        // Past the top 50 there's only the player's own row: mark the gap.
        if (i === 50) body.append(Object.assign(document.createElement('tr'), { className: 'gap', innerHTML: '<td colspan="4">...</td>' }));
        const tr = document.createElement('tr');
        if (row.is_me) tr.className = 'me';
        for (const v of [row.rank, row.name, fmt(row.score), row.round]) {
          tr.append(Object.assign(document.createElement('td'), { textContent: String(v) }));
        }
        body.append(tr);
      });
    } catch (err) {
      msg.textContent = `Couldn't load the leaderboard: ${err.message}`;
    }
  }

  hide() {
    this.el.hidden = true;
    this.onClose?.();
  }
}
