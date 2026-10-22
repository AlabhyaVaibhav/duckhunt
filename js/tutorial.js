// Practice mode that teaches the finger gun one skill at a time:
// pose -> aim -> cock & fire -> still targets -> slow ducks -> ready.
// Each step waits until the player has actually done it a few times.
import { W, OX, H, SKY, DIRT_TOP } from './scene.js';
import { GREEN, WHITE, ORANGE, RED, rand, text, box, centeredBox, disc } from './draw.js';
import { Duck } from './duck.js';

const STEPS = ['pose', 'aim', 'trigger', 'targets', 'ducks', 'ready'];
const AIM_SPOTS = [[56, 76], [200, 76], [128, 118]]; // within the centred 256 block
const AIM_RADIUS = 14;
const AIM_HOLD = 0.6;      // seconds on target to count
const POSE_HOLD = 1.2;     // seconds holding the finger gun
const TARGET_RADIUS = 10;
const DUCK_SPEED = 32;     // well below round 1
const TUTORIAL_TOP = 64;   // keep practice ducks below the instruction panel
const CLEAR_PAUSE = 0.9;

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export class Tutorial {
  constructor(game) {
    this.game = game;
    this.sfx = game.sfx;
    this.shots = 0;
    this.hits = 0;
    this.done = false;
    this.effects = [];
    this.enter(0);
  }

  get input() { return this.game.input; }
  get step() { return STEPS[this.i]; }
  get stepNumber() { return Math.min(this.i + 1, STEPS.length - 1); }

  enter(i) {
    this.i = i;
    this.stepT = 0;
    this.count = 0;
    this.progress = 0;
    this.misses = 0;
    this.cleared = 0;
    this.target = null;
    this.ducks = [];
    if (this.step === 'targets') this.spawnTarget();
    if (this.step === 'ducks') this.spawnDuck();
  }

  aimSpot() {
    const [x, y] = AIM_SPOTS[this.count];
    return [OX + x, y];
  }

  skip() {
    if (this.i < STEPS.length - 1) this.enter(this.i + 1);
  }

  succeed() {
    this.cleared = 1e-6;
    this.sfx.gotDuck();
  }

  spawnTarget() {
    this.target = { x: Math.round(rand(36, W - 36)), y: Math.round(rand(TUTORIAL_TOP + 12, 128)) };
  }

  spawnDuck() {
    const d = new Duck('black', DUCK_SPEED, -1);
    d.x = rand(70, W - 70);
    this.ducks.push(d);
  }

  update(dt) {
    this.stepT += dt;
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter(e => e.t < 0.4);
    for (const d of this.ducks) {
      d.update(dt, this.sfx);
      if (d.state === 'flying' && !d.emerging && d.y < TUTORIAL_TOP) {
        d.y = TUTORIAL_TOP;
        d.vy = Math.abs(d.vy);
      }
    }

    if (this.cleared) {
      this.cleared += dt;
      if (this.cleared > CLEAR_PAUSE) this.enter(this.i + 1);
      return;
    }

    const inp = this.input;
    const aim = this.game.aim;
    switch (this.step) {
      case 'pose':
        // The pose step is about the camera; mouse players skip straight to aiming.
        if (!inp.hand) { this.enter(1); break; }
        if (inp.visible && inp.gunPose) this.progress += dt;
        else this.progress = Math.max(0, this.progress - dt * 2);
        if (this.progress >= POSE_HOLD) this.succeed();
        break;

      case 'aim': {
        const [tx, ty] = this.aimSpot();
        if (aim && dist(aim.x, aim.y, tx, ty) <= AIM_RADIUS) this.progress += dt;
        else this.progress = Math.max(0, this.progress - dt);
        if (this.progress >= AIM_HOLD) {
          this.count++;
          this.progress = 0;
          this.sfx.click();
          if (this.count === AIM_SPOTS.length) this.succeed();
        }
        break;
      }

      case 'ducks':
        if (this.ducks.every(d => d.done)) {
          if (this.count >= 2) this.succeed();
          else { this.ducks = []; this.spawnDuck(); }
        }
        break;
    }
  }

  fire(x, y) {
    if (this.cleared) return;
    this.sfx.shot();
    this.effects.push({ x, y, t: 0 });

    switch (this.step) {
      case 'trigger':
        if (++this.count >= 3) this.succeed();
        break;

      case 'targets': {
        this.shots++;
        const t = this.target;
        if (t && dist(x, y, t.x, t.y) <= TARGET_RADIUS + 3) {
          this.hits++;
          this.effects.push({ x: t.x, y: t.y, t: 0, pop: true });
          if (++this.count >= 3) { this.target = null; this.succeed(); } else this.spawnTarget();
        } else {
          this.misses++;
        }
        break;
      }

      case 'ducks': {
        this.shots++;
        const d = this.ducks.find(dk => dk.hit(x, y));
        if (d) { d.setState('shot'); this.hits++; this.count++; } else this.misses++;
        break;
      }

      case 'ready':
        this.done = true;
        break;
    }
  }

  // ---- drawing

  instructions() {
    const inp = this.input;
    const hand = inp.hand;
    const slow = this.stepT > 7;
    switch (this.step) {
      case 'pose':
        return {
          lines: ['MAKE A FINGER GUN', 'INDEX FINGER OUT', 'THUMB UP, FIST CLOSED'],
          tip: !inp.visible ? 'SHOW YOUR HAND TO THE CAMERA' : !inp.gunPose ? 'CURL YOUR OTHER FINGERS' : 'HOLD IT...',
        };
      case 'aim':
        return {
          lines: ['AIM AT THE TARGET', 'AND HOLD IT THERE', `${this.count + 1}/${AIM_SPOTS.length}`],
          tip: slow && hand ? 'MOVE YOUR WHOLE HAND' : null,
        };
      case 'trigger':
        return hand
          ? {
            lines: ['RAISE THUMB TO COCK', 'SNAP IT DOWN TO FIRE', `${this.count}/3`],
            tip: inp.cocked ? 'COCKED! NOW SNAP IT DOWN' : 'LIFT THUMB PAST GREEN LINE',
          }
          : { lines: ['CLICK TO FIRE', `${this.count}/3`], tip: null };
      case 'targets':
        return {
          lines: ['SHOOT THE TARGET', `${this.count}/3`],
          tip: this.misses >= 2 && hand ? 'FREEZE HAND, MOVE ONLY THUMB' : null,
        };
      case 'ducks':
        return {
          lines: ['NOW A REAL DUCK!', `${this.count}/2`],
          tip: this.misses >= 3 && hand ? 'AIM, PAUSE, THEN SNAP' : null,
        };
      default: {
        const pct = this.shots ? Math.round(100 * this.hits / this.shots) : 100;
        return { lines: ['NICE SHOOTING!', `ACCURACY ${pct}%`, 'SHOOT TO PLAY GAME A'], tip: null };
      }
    }
  }

  draw(ctx) {
    const g = this.game;
    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(g.backdrop, 0, 0);
    for (const d of this.ducks) d.draw(ctx);
    ctx.drawImage(g.ground, 0, 0);

    if (this.step === 'aim' && !this.cleared) {
      const [tx, ty] = this.aimSpot();
      this.drawTarget(ctx, tx, ty);
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tx, ty, AIM_RADIUS, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.progress / AIM_HOLD));
      ctx.stroke();
    }
    if (this.target) this.drawTarget(ctx, this.target.x, this.target.y);

    for (const e of this.effects) {
      ctx.strokeStyle = e.pop ? ORANGE : WHITE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(e.x, e.y, (e.pop ? 6 : 2) + e.t * (e.pop ? 60 : 40), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Instruction panel.
    const { lines, tip } = this.instructions();
    const all = tip ? [...lines, tip] : lines;
    const panel = centeredBox(ctx, all, 4, WHITE, { top: true, border: GREEN });
    if (tip) {
      // Redraw the tip line in orange so it stands out.
      ctx.fillStyle = '#000';
      ctx.fillRect(panel.x + 3, panel.y + 6 + lines.length * 12 - 1, panel.w - 6, 10);
      text(ctx, tip, W / 2, panel.y + 6 + lines.length * 12, ORANGE, { align: 'center' });
    }
    if (this.step === 'pose') {
      ctx.fillStyle = '#333';
      ctx.fillRect(W / 2 - 40, panel.y + panel.h + 3, 80, 4);
      ctx.fillStyle = GREEN;
      ctx.fillRect(W / 2 - 40, panel.y + panel.h + 3, Math.round(80 * Math.min(1, this.progress / POSE_HOLD)), 4);
    }

    this.drawFooter(ctx);
    if (this.cleared) centeredBox(ctx, ['GOOD!'], 120, GREEN);
  }

  drawTarget(ctx, x, y) {
    disc(ctx, x, y, TARGET_RADIUS + 1, '#000');
    disc(ctx, x, y, TARGET_RADIUS, RED);
    disc(ctx, x, y, 7, WHITE);
    disc(ctx, x, y, 4, RED);
    disc(ctx, x, y, 1, WHITE);
  }

  // Step dots plus, for hand players, a live thumb meter in the dirt area.
  drawFooter(ctx) {
    const y = DIRT_TOP + 4;
    box(ctx, 8, y, W - 16, H - y - 6, GREEN);
    text(ctx, 'PRACTICE', 16, y + 6, GREEN);
    for (let i = 0; i < STEPS.length - 1; i++) {
      ctx.fillStyle = i < this.i ? GREEN : i === this.i ? WHITE : '#444';
      ctx.fillRect(92 + i * 10, y + 7, 6, 6);
    }
    text(ctx, 'S=SKIP', W - 16, y + 6, '#9c9c9c', { align: 'right' });

    const inp = this.input;
    if (!inp.hand) {
      text(ctx, 'ESC=QUIT', 16, y + 24, '#9c9c9c');
      return;
    }
    const mx = 70, mw = W - 16 - mx - 8, my = y + 22;
    text(ctx, 'THUMB', 16, y + 20, inp.cocked ? GREEN : WHITE);
    ctx.fillStyle = '#222';
    ctx.fillRect(mx, my, mw, 6);
    ctx.fillStyle = inp.cocked ? GREEN : ORANGE;
    ctx.fillRect(mx, my, Math.round(mw * Math.min(1, inp.visible ? inp.thumb : 0)), 6);
    ctx.fillStyle = ORANGE;
    ctx.fillRect(mx + Math.round(mw * Math.min(1, inp.fireLevel)), my - 2, 1, 10);
    ctx.fillStyle = GREEN;
    ctx.fillRect(mx + Math.round(mw * Math.min(1, inp.cockLevel)), my - 2, 1, 10);
    text(ctx, 'FIRE', mx + Math.round(mw * inp.fireLevel) - 16, my + 9, ORANGE);
    text(ctx, 'COCK', mx + Math.round(mw * inp.cockLevel), my + 9, GREEN);
  }
}
