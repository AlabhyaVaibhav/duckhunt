// Score sharing: after a game over, a panel offers the system share sheet
// (with a score card image where supported), X, WhatsApp, copy link and
// saving the card. Shared links carry ?beat=<score> so friends get a target.
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
const challengeUrl = score => `${GAME_URL}?beat=${score}`;
const message = r => `I scored ${fmt(r.score)} in Duck Hunt: Finger Gun, shooting ducks with just my hand. `
  + `Round ${r.round}, ${r.ducks} ${r.ducks === 1 ? 'duck' : 'ducks'}. Can you beat me?`;

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
  line('SCORE', 230, 20, '#80d010');
  line(String(r.score).padStart(6, '0'), 268, 52, '#fcfcfc');
  line(`ROUND ${r.round}`, 368, 20, '#fcfcfc');
  line(`${r.ducks} ${r.ducks === 1 ? 'DUCK' : 'DUCKS'}`, 404, 20, '#fcfcfc');
  line(`GAME ${r.mode === 2 ? 'B' : 'A'}`, 440, 20, '#fcfcfc');
  line('CAN YOU BEAT IT?', 520, 18, '#fc7c3c');
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
  get url() { return challengeUrl(this.result.score); }

  // `shot` is a canvas of the game-over screen; `challenge` the friend's score, if any.
  show(result, shot, challenge) {
    this.result = result;
    this.card = drawCard(shot, result);
    $('#shareScore').textContent = fmt(result.score);
    $('#shareDetail').textContent = `Round ${result.round} · ${result.ducks} ${result.ducks === 1 ? 'duck' : 'ducks'} · Game ${result.mode === 2 ? 'B' : 'A'}`;
    $('#shareVs').textContent = !challenge ? ''
      : result.score > challenge ? `You beat your friend's ${fmt(challenge)}!`
      : `Your friend's ${fmt(challenge)} still stands. ${fmt(challenge - result.score + 1)} to go.`;
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
    a.download = `duck-hunt-${this.result.score}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}
