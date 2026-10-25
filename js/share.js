// Score sharing: after a game over (or any time from the SHARE button), a
// panel offers the system share sheet (with a card image where supported), X,
// WhatsApp, copy link and saving the card. Shared links carry ?beat=<score>
// so friends get a target.
//
// What's shared: a game-over result { score, round, mode, ducks, gun }, the
// player's best { score, best: true }, or null (no score yet: an invite).
import { NES_W, H, OX } from './scene.js';

const $ = s => document.querySelector(s);
const GAME_URL = new URL('./', location.href).href;
const MAX_SCORE = 9999999;

// Score a friend challenged us with, from ?beat=, or null.
export function challengeFromUrl() {
  const n = Number(new URLSearchParams(location.search).get('beat'));
  return Number.isInteger(n) && n > 0 && n <= MAX_SCORE ? n : null;
}

const fmt = n => n.toLocaleString('en-US');
const ducks = n => `${n} ${n === 1 ? 'duck' : 'ducks'}`;
const gameName = mode => `Game ${mode === 2 ? 'B' : 'A'}`;
const gunName = gun => (gun === 'finger' ? 'Finger gun' : 'Mouse');
const shareUrl = r => (r ? `${GAME_URL}?beat=${r.score}` : GAME_URL);
const message = r => (!r
  ? 'Duck Hunt in the browser, played with a finger gun: point at your webcam and drop your thumb to shoot. Give it a go!'
  : r.best
    ? `My best in Duck Hunt: Finger Gun is ${fmt(r.score)}, shooting ducks with just my hand. Can you beat me?`
    : `I scored ${fmt(r.score)} in Duck Hunt: Finger Gun, ${r.gun === 'finger' ? 'shooting ducks with just my hand' : 'playing with the mouse'}. `
      + `Round ${r.round}, ${ducks(r.ducks)}. Can you beat me?`);

// 1200x630 card: the game-over screen on the left, the score on the right.
function drawCard(shot, r) {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 630;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  // The NES-width block in the middle of the (possibly wider) view, at 2.5x.
  ctx.drawImage(shot, OX, 0, NES_W, H, 15, 15, NES_W * 2.5, H * 2.5);

  const x = 690;
  const line = (s, y, size, color) => {
    ctx.font = `${size}px "Press Start 2P"`;
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  };
  ctx.textBaseline = 'top';
  line('DUCK HUNT', 70, 40, '#3cbcfc');
  line('FINGER GUN', 128, 22, '#fc7c3c');
  if (r) {
    line(r.best ? 'MY BEST' : 'SCORE', 230, 20, '#80d010');
    line(String(r.score).padStart(6, '0'), 268, 52, '#fcfcfc');
    if (!r.best) {
      line(`ROUND ${r.round}`, 368, 20, '#fcfcfc');
      line(ducks(r.ducks).toUpperCase(), 404, 20, '#fcfcfc');
      line(`${gameName(r.mode)} / ${gunName(r.gun)}`.toUpperCase(), 440, 20, '#fcfcfc');
    }
    line('CAN YOU BEAT IT?', 520, 18, '#fc7c3c');
  } else {
    line('POINT A', 250, 22, '#fcfcfc');
    line('FINGER GUN.', 290, 22, '#fcfcfc');
    line('DROP YOUR', 350, 22, '#fcfcfc');
    line('THUMB TO SHOOT.', 390, 22, '#fcfcfc');
    line('PLAY FREE', 520, 18, '#fc7c3c');
  }
  line(new URL(GAME_URL).host, 566, 12, '#9c9c9c');
  return c;
}

const toBlob = c => new Promise(res => c.toBlob(res, 'image/png'));

export class SharePanel {
  constructor() {
    this.el = $('#share');
    this.status = $('#shareStatus');
    this.result = null;
    this.card = null;
    this.onClose = null;
    $('#shareNative').hidden = !navigator.share;
    $('#shareNative').addEventListener('click', () => this.native());
    $('#shareX').addEventListener('click', () => this.open('https://twitter.com/intent/tweet', { text: message(this.result), url: this.url }));
    $('#shareWa').addEventListener('click', () => this.open('https://wa.me/', { text: `${message(this.result)} ${this.url}` }));
    $('#shareCopy').addEventListener('click', () => this.copy());
    $('#shareSave').addEventListener('click', () => this.save());
    $('#shareClose').addEventListener('click', () => this.hide());
  }

  get visible() { return !this.el.hidden; }
  get url() { return shareUrl(this.result); }

  // `shot` is a canvas of the game screen; `challenge` the friend's score, if any.
  show(result, shot, challenge) {
    const over = result && !result.best;
    this.result = result;
    this.card = drawCard(shot, result);
    $('#shareTitle').textContent = over ? 'GAME OVER' : 'SHARE';
    $('#shareScore').textContent = result ? fmt(result.score) : '';
    $('#shareDetail').textContent = over ? `Round ${result.round} · ${ducks(result.ducks)} · ${gameName(result.mode)} · ${gunName(result.gun)}`
      : result ? 'Your best score' : '';
    $('#shareVs').textContent = !challenge || !result ? ''
      : result.score > challenge ? `You beat your friend's ${fmt(challenge)}!`
      : `Your friend's ${fmt(challenge)} still stands. ${fmt(challenge - result.score + 1)} to go.`;
    $('#shareCta').textContent = result ? 'Challenge your friends to beat it' : 'Invite your friends to play';
    $('#shareClose').textContent = over ? 'PLAY AGAIN' : 'BACK TO GAME';
    $('#shareImg').src = this.card.toDataURL('image/png');
    this.status.textContent = '';
    this.el.hidden = false;
    $('#shareClose').focus();
  }

  hide() {
    this.el.hidden = true;
    this.onClose?.();
  }

  open(base, params) {
    window.open(`${base}?${new URLSearchParams(params)}`, '_blank', 'noopener');
  }

  async native() {
    const data = { title: 'Duck Hunt: Finger Gun', text: message(this.result), url: this.url };
    try {
      const file = new File([await toBlob(this.card)], 'duck-hunt-score.png', { type: 'image/png' });
      // With an image, put the link in the text: some targets drop `url` when files are attached.
      const withFile = { files: [file], title: data.title, text: `${data.text} ${data.url}` };
      await navigator.share(navigator.canShare?.(withFile) ? withFile : data);
    } catch (err) {
      if (err?.name !== 'AbortError') this.status.textContent = 'Sharing failed. Try copying the link.';
    }
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(`${message(this.result)} ${this.url}`);
      this.status.textContent = 'Copied! Paste it to a friend.';
    } catch {
      this.status.textContent = this.url;
    }
  }

  async save() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await toBlob(this.card));
    a.download = `duck-hunt-${this.result?.score ?? 'invite'}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
