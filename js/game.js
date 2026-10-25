import { SPR } from './sprites.js';
import { W, OX, H, GRASS_TIPS, GRASS_TOP, DIRT_TOP, SKY, SKY_PINK, buildBackdrop, buildGround } from './scene.js';
import { GREEN, BLUE, WHITE, ORANGE, rand, text, box, centeredBox } from './draw.js';
import { Duck, pickKind } from './duck.js';
import { Tutorial } from './tutorial.js';

// Original rules: 10 ducks a round, 3 shots per appearance, rising quota.
const DUCKS_PER_ROUND = 10;
const quota = r => (r <= 10 ? 6 : r <= 12 ? 7 : r <= 14 ? 8 : r <= 19 ? 9 : 10);
const POINTS = { black: [500, 800, 1000], blue: [1000, 1600, 2000], red: [1500, 2400, 3000] };
const tier = r => (r <= 5 ? 0 : r <= 10 ? 1 : 2);
const perfectBonus = r => (r <= 10 ? 10000 : r <= 15 ? 15000 : r <= 20 ? 20000 : 30000);


// ------------------------------------------------------------------ Dog

// The dog is positioned by the bottom-centre of its sprite.
const DOG_FOOT = DIRT_TOP + 2;      // walking on the dirt line, above the HUD
const DOG_HIDDEN_TOP = GRASS_TOP + 8;
const DOG_SHOW = 0.85;              // share of a popup sprite that rises above the grass

class Dog {
  constructor() { this.mode = 'hidden'; }

  intro() {
    this.mode = 'intro';
    this.x = -40;
    this.foot = DOG_FOOT;
    this.behind = false;
    this.t = 0;
    this.script = [
      { a: 'walk', to: OX + 60 }, { a: 'sniff', d: 0.9 },
      { a: 'walk', to: OX + 112 }, { a: 'sniff', d: 0.7 },
      { a: 'alert', d: 0.5 }, { a: 'jump', d: 0.9 },
    ];
    this.step = 0;
    this.stepT = 0;
  }

  // kind: 'hold1' | 'hold2' | 'laugh'
  popup(kind, x, hold = 1.1) {
    this.mode = 'popup';
    this.kind = kind;
    this.x = Math.min(W - 40, Math.max(40, x));
    this.hold = hold;
    this.t = 0;
  }

  update(dt, sfx) {
    this.t += dt;
    if (this.mode === 'intro') {
      const s = this.script[this.step];
      this.stepT += dt;
      let next = false;
      if (s.a === 'walk') {
        this.x += 36 * dt;
        next = this.x >= s.to;
      } else if (s.a === 'jump') {
        const p = Math.min(1, this.stepT / s.d);
        this.x = this.x0 + 30 * p;
        this.foot = DOG_FOOT - 220 * p * (1 - p) + 50 * p;
        this.behind = p > 0.5;
        next = p >= 1;
      } else {
        next = this.stepT >= s.d;
      }
      if (next) {
        this.step++;
        this.stepT = 0;
        const n = this.script[this.step];
        if (!n) { this.mode = 'hidden'; return; }
        if (n.a === 'alert') sfx.click();
        if (n.a === 'jump') this.x0 = this.x;
      }
    } else if (this.mode === 'popup') {
      if (this.t >= 0.3 + this.hold + 0.3) this.mode = 'hidden';
    }
  }

  get done() { return this.mode === 'hidden'; }

  draw(ctx) {
    const d = SPR.dog;
    if (this.mode === 'intro') {
      const s = this.script[this.step];
      let img;
      if (s.a === 'walk') img = d.walk[Math.floor(this.t * 6) % 2];
      else if (s.a === 'sniff') img = d.sniff[Math.floor(this.stepT * 5) % 2];
      else if (s.a === 'alert') img = d.alert;
      else img = this.behind ? d.dive : d.jump;
      ctx.drawImage(img, Math.round(this.x - img.width / 2), Math.round(this.foot - img.height));
    } else if (this.mode === 'popup') {
      const img = this.kind === 'laugh' ? d.laugh[Math.floor(this.t / 0.15) % 2] : d[this.kind];
      const up = this.t < 0.3 ? this.t / 0.3 : this.t < 0.3 + this.hold ? 1 : 1 - (this.t - 0.3 - this.hold) / 0.3;
      const shownTop = GRASS_TIPS + 6 - Math.round(Math.min(img.height, 52) * DOG_SHOW);
      const top = DOG_HIDDEN_TOP + (shownTop - DOG_HIDDEN_TOP) * Math.max(0, up);
      const cx = d.cx[this.kind] ?? img.width / 2;
      ctx.drawImage(img, Math.round(this.x - cx), Math.round(top));
    }
  }
}

// ------------------------------------------------------------------ Game

function loadTop() {
  try { return Number(localStorage.getItem('duckhunt.top')) || 12000; } catch { return 12000; }
}
function saveTop(v) {
  try { localStorage.setItem('duckhunt.top', String(v)); } catch { /* storage unavailable */ }
}
// The player's own best (the TOP SCORE starts at the NES's 12000, which isn't theirs to share).
function loadBest() {
  try { return Number(localStorage.getItem('duckhunt.best')) || 0; } catch { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem('duckhunt.best', String(v)); } catch { /* storage unavailable */ }
}
export function tutorialDone() {
  try { return localStorage.getItem('duckhunt.tutorialDone') === '1'; } catch { return false; }
}
function saveTutorialDone() {
  try { localStorage.setItem('duckhunt.tutorialDone', '1'); } catch { /* storage unavailable */ }
}

const MENU = [
  { label: 'GAME A  1 DUCK', y: 124, mode: 1 },
  { label: 'GAME B  2 DUCKS', y: 140, mode: 2 },
  { label: 'PRACTICE', y: 156, tutorial: true },
];

export class Game {
  constructor(sfx) {
    this.sfx = sfx;
    this.backdrop = buildBackdrop(SPR.art);
    this.ground = buildGround(SPR.art);
    this.dog = new Dog();
    this.state = 'title';
    this.t = 0;
    this.mode = 1;
    this.round = 1;
    this.score = 0;
    this.top = loadTop();
    this.best = loadBest();
    this.hits = Array(DUCKS_PER_ROUND).fill(null);
    this.ducks = [];
    this.shots = 3;
    this.aim = null;
    // Live finger-gun state, set by main each frame; the tutorial reads it.
    this.input = { hand: false, visible: false, gunPose: false, cocked: false, thumb: 0, cockLevel: 0.65, fireLevel: 0.35 };
    this.tutorial = null;
    this.effects = [];
    this.popups = [];
    this.shake = 0;
    this.paused = false;
    this.ducksHit = 0;
    this.gun = null;        // 'finger' or 'mouse': what fired this game's shots
    this.challenge = null;  // score from a friend's share link, shown on the title
    this.onGameOver = null; // called with { score, round, mode, ducks, gun }
  }

  // ---- input

  setAim(aim) { this.aim = aim; }

  // `gun` is 'finger' (the thumb trigger) or 'mouse' (a click or the space bar).
  fire(x, y, gun = 'mouse') {
    if (this.paused) return;
    if (this.state === 'title') {
      const item = this.menuAt(x, y);
      if (item?.tutorial) this.startTutorial();
      else if (item) { this.sfx.shot(); this.newGame(item.mode); }
      return;
    }
    if (this.state === 'tutorial') {
      this.tutorial.fire(x, y);
      if (this.tutorial.done) { saveTutorialDone(); this.newGame(1); }
      return;
    }
    if (this.state !== 'flying' || this.shots <= 0) return;
    this.shots--;
    // A single click or space bar shot makes it a mouse run.
    if (gun === 'mouse' || !this.gun) this.gun = gun;
    this.lastShotT = this.t;
    this.sfx.shot();
    this.effects.push({ x, y, t: 0 });
    this.shake = 0.08;
    const duck = this.ducks.find(d => d.hit(x, y));
    if (duck) {
      duck.setState('shot');
      const pts = POINTS[duck.kind][tier(this.round)];
      this.addScore(pts);
      this.popups.push({ x: duck.x, y: duck.y - 16, text: pts, t: 0 });
      this.hits[duck.slot] = true;
      this.ducksHit++;
    }
  }

  menuAt(x, y) {
    return MENU.find(m => y >= m.y - 4 && y <= m.y + 12 && x >= OX + 40 && x <= OX + 216);
  }

  // Rebuilds the scenery after the view width changes.
  resize() {
    this.backdrop = buildBackdrop(SPR.art);
    this.ground = buildGround(SPR.art);
  }

  // ---- flow

  startTutorial() {
    this.tutorial = new Tutorial(this);
    this.ducks = [];
    this.go('tutorial');
  }

  quitTutorial() {
    saveTutorialDone();
    this.go('title');
  }

  newGame(mode) {
    this.mode = mode;
    this.round = 1;
    this.score = 0;
    this.ducksHit = 0;
    this.gun = null;
    this.startRound();
  }

  startRound() {
    this.hits = Array(DUCKS_PER_ROUND).fill(null);
    this.setIdx = 0;
    this.ducks = [];
    this.skyPink = false;
    this.go('roundIntro');
    this.dog.intro();
    this.sfx.intro();
  }

  get setsPerRound() { return DUCKS_PER_ROUND / this.mode; }
  get duckSpeed() { return Math.min(52 + (this.round - 1) * 6, 150); }
  get flyTime() { return Math.max(4.5, 7 - (this.round - 1) * 0.15); }

  startSet() {
    this.ducks = [];
    for (let i = 0; i < this.mode; i++) {
      this.ducks.push(new Duck(pickKind(), this.duckSpeed, this.setIdx * this.mode + i));
    }
    this.shots = 3;
    this.lastShotT = -1;
    this.skyPink = false;
    this.quackIn = 0.2;
    this.go('flying');
  }

  flyAway() {
    for (const d of this.ducks) {
      if (d.state === 'flying') { d.escape(); this.hits[d.slot] = false; }
    }
    this.skyPink = true;
    this.sfx.flyAway();
    this.go('flyaway');
  }

  go(state) { this.state = state; this.t = 0; }

  addScore(n) {
    this.score += n;
    if (this.score > this.top) this.top = this.score;
    if (this.score > this.best) this.best = this.score;
  }

  update(dt) {
    if (this.paused) return;
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt);
    this.dog.update(dt, this.sfx);
    for (const d of this.ducks) d.update(dt, this.sfx);
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter(e => e.t < 0.18);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter(p => p.t < 1.1);

    switch (this.state) {
      case 'tutorial':
        this.tutorial.update(dt);
        break;


      case 'roundIntro':
        if (this.dog.done && this.t > 2.4) this.startSet();
        break;

      case 'flying': {
        const flying = this.ducks.filter(d => d.state === 'flying');
        if (flying.length && (this.quackIn -= dt) <= 0) {
          this.sfx.quack();
          this.quackIn = rand(0.9, 1.6);
        }
        const outOfShots = this.shots === 0 && this.t - this.lastShotT > 0.3;
        if (flying.length && (outOfShots || this.t > this.flyTime)) this.flyAway();
        else if (this.ducks.every(d => d.done)) this.go('afterSet');
        break;
      }

      case 'flyaway':
        if (this.ducks.every(d => d.done)) this.go('afterSet');
        break;

      case 'afterSet':
        if (this.t > 0.5) {
          const dead = this.ducks.filter(d => d.state === 'dead');
          if (dead.length) {
            const x = dead.reduce((s, d) => s + d.x, 0) / dead.length;
            this.dog.popup(dead.length === 1 ? 'hold1' : 'hold2', x);
            this.sfx.gotDuck();
          } else {
            this.dog.popup('laugh', W / 2);
            this.sfx.laugh();
          }
          this.go('dogShow');
        }
        break;

      case 'dogShow':
        if (this.dog.done) {
          this.setIdx++;
          if (this.setIdx >= this.setsPerRound) this.go('roundEnd');
          else this.startSet();
        }
        break;

      case 'roundEnd':
        if (this.t > 0.8 && !this.sorted) {
          this.hits.sort((a, b) => (b === true) - (a === true));
          this.sorted = true;
          this.sfx.click();
        }
        if (this.t > 2.6) {
          this.sorted = false;
          const n = this.hits.filter(Boolean).length;
          if (n < quota(this.round)) {
            this.go('gameOver');
            this.dog.popup('laugh', W / 2, 3.2);
            this.sfx.gameOver();
            saveTop(this.top);
            saveBest(this.best);
            this.onGameOver?.({ score: this.score, round: this.round, mode: this.mode, ducks: this.ducksHit, gun: this.gun ?? 'mouse' });
          } else if (n === DUCKS_PER_ROUND) {
            this.addScore(perfectBonus(this.round));
            this.go('perfect');
            this.sfx.perfect();
          } else {
            this.go('roundClear');
            this.sfx.roundClear();
          }
        }
        break;

      case 'perfect':
      case 'roundClear':
        if (this.t > (this.state === 'perfect' ? 3 : 1.8)) {
          this.round++;
          this.startRound();
        }
        break;

      case 'gameOver':
        if (this.t > 4.2) {
          this.ducks = [];
          this.go('title');
        }
        break;
    }
  }

  // ---- drawing

  draw(ctx) {
    ctx.imageSmoothingEnabled = false;
    if (this.state === 'title') {
      this.drawTitle(ctx);
    } else if (this.state === 'tutorial') {
      this.tutorial.draw(ctx);
    } else {
      ctx.save();
      if (this.shake > 0) ctx.translate(Math.round(rand(-1, 1)), Math.round(rand(-1, 1)));
      this.drawWorld(ctx);
      this.drawHud(ctx);
      this.drawBanners(ctx);
      ctx.restore();
    }
    this.drawCrosshair(ctx);
    if (this.paused) centeredBox(ctx, ['PAUSE'], H / 2 - 30);
  }

  drawWorld(ctx) {
    ctx.fillStyle = this.skyPink ? SKY_PINK : SKY;
    ctx.fillRect(-2, -2, W + 4, H + 4);
    ctx.drawImage(this.backdrop, 0, 0);
    for (const d of this.ducks) d.draw(ctx);
    const dogBehind = this.dog.mode === 'popup' || this.dog.behind;
    if (dogBehind) this.dog.draw(ctx);
    ctx.drawImage(this.ground, 0, 0);
    if (!dogBehind) this.dog.draw(ctx);

    for (const p of this.popups) text(ctx, p.text, p.x, p.y, WHITE, { align: 'center' });
    for (const e of this.effects) {
      const r = 2 + e.t * 60;
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Laid out for the NES's 256 width, centred in the view.
  drawHud(ctx) {
    ctx.save();
    ctx.translate(OX, 0);
    this.drawHudBlock(ctx);
    ctx.restore();
  }

  drawHudBlock(ctx) {
    // Round.
    box(ctx, 16, 188, 42, 11, '#000');
    text(ctx, `R=${this.round}`, 19, 190, GREEN);

    // Shots.
    box(ctx, 16, 200, 40, 25, GREEN);
    for (let i = 0; i < this.shots; i++) ctx.drawImage(SPR.bullet, 23 + i * 9, 203);
    text(ctx, 'SHOT', 20, 213, BLUE);

    // Hits.
    box(ctx, 60, 200, 136, 25, GREEN);
    text(ctx, 'HIT', 64, 208, GREEN);
    const current = new Set(this.ducks.filter(() => ['flying', 'flyaway'].includes(this.state)).map(d => d.slot));
    const blink = Math.floor(this.t * 4) % 2 === 0;
    for (let i = 0; i < DUCKS_PER_ROUND; i++) {
      const hit = this.hits[i] === true;
      if (current.has(i) && this.hits[i] === null && !blink) continue;
      if (this.state === 'roundEnd' && this.sorted && hit && !blink) continue;
      ctx.drawImage(hit ? SPR.icon.red : SPR.icon.white, 90 + i * 10, 204);
    }
    ctx.fillStyle = BLUE;
    for (let i = 0; i < quota(this.round); i++) ctx.fillRect(91 + i * 10, 214, 7, 4);

    // Score.
    box(ctx, 200, 200, 52, 25, GREEN);
    text(ctx, String(this.score).padStart(6, '0'), 202, 204, WHITE);
    text(ctx, 'SCORE', 206, 214, WHITE);
  }

  drawBanners(ctx) {
    switch (this.state) {
      case 'roundIntro':
        centeredBox(ctx, ['ROUND', String(this.round)], 56);
        break;
      case 'flyaway':
      case 'afterSet':
        if (this.skyPink) centeredBox(ctx, ['FLY AWAY'], 56);
        break;
      case 'perfect':
        centeredBox(ctx, ['PERFECT!!', String(perfectBonus(this.round))], 56);
        break;
      case 'gameOver':
        centeredBox(ctx, ['GAME OVER'], 56);
        break;
    }
  }

  drawTitle(ctx) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    ctx.drawImage(SPR.art.logo, Math.round((W - SPR.art.logo.width) / 2), 4);

    const hover = this.aim && this.menuAt(this.aim.x, this.aim.y);
    for (const m of MENU) {
      const on = hover === m;
      if (on) text(ctx, '>', OX + 28, m.y, WHITE);
      text(ctx, m.label, OX + 42, m.y, on ? WHITE : ORANGE);
    }
    text(ctx, `TOP SCORE = ${this.top}`, W / 2, 176, GREEN, { align: 'center' });
    if (this.challenge) text(ctx, `BEAT ${this.challenge}!`, W / 2, 186, ORANGE, { align: 'center' });

    text(ctx, 'POINT A FINGER GUN', W / 2, 196, WHITE, { align: 'center' });
    text(ctx, 'DROP THUMB TO SHOOT', W / 2, 208, WHITE, { align: 'center' });
    text(ctx, 'SHOOT A GAME TO START', W / 2, 226, Math.floor(this.t * 2) % 2 ? GREEN : '#3c7c00', { align: 'center' });
  }

  drawCrosshair(ctx) {
    const a = this.aim;
    if (!a) return;
    const x = Math.round(a.x), y = Math.round(a.y);
    const color = a.armed ? WHITE : '#b0b0b0';
    const arm = (dx, dy) => {
      for (let d = 3; d <= 7; d++) {
        ctx.fillStyle = '#000';
        ctx.fillRect(x + dx * d - 1, y + dy * d - 1, 3, 3);
      }
      for (let d = 3; d <= 7; d++) {
        ctx.fillStyle = color;
        ctx.fillRect(x + dx * d, y + dy * d, 1, 1);
      }
    };
    arm(1, 0); arm(-1, 0); arm(0, 1); arm(0, -1);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }
}
