// A flying duck: flies and bounces around the sky, then gets shot (shot -> falling -> dead)
// or escapes straight up (escaping -> gone).
import { SPR } from './sprites.js';
import { W, GRASS_TIPS, GRASS_TOP } from './scene.js';
import { blit, rand, pick } from './draw.js';

const SPEED_MULT = { black: 1, blue: 1.25, red: 1.5 };
const FLY_MIN_Y = 14;
const FLY_MAX_Y = GRASS_TIPS - 14;
const HIT_PAD = 5; // extra forgiveness: hand aim is less precise than a Zapper

export const pickKind = () => { const r = Math.random(); return r < 0.5 ? 'black' : r < 0.82 ? 'blue' : 'red'; };

export class Duck {
  constructor(kind, speed, slot) {
    this.kind = kind;
    this.slot = slot;
    this.speed = speed * SPEED_MULT[kind];
    this.x = rand(48, W - 48);
    this.y = GRASS_TOP + 4;
    this.state = 'flying';
    this.emerging = true;
    this.t = Math.random();
    this.stateT = 0;
    this.setDir(true);
    this.turnIn = rand(0.8, 2);
  }

  setDir(up) {
    const a = (up ? pick([50, 60, 70]) : pick([25, 35, 45, 55, 65])) * Math.PI / 180;
    const sx = Math.random() < 0.5 ? -1 : 1;
    const sy = up || Math.random() < 0.5 ? -1 : 1;
    this.vx = Math.cos(a) * this.speed * sx;
    this.vy = Math.sin(a) * this.speed * sy;
  }

  setState(s) { this.state = s; this.stateT = 0; }

  hit(x, y) {
    return this.state === 'flying'
      && Math.abs(x - this.x) <= 15 + HIT_PAD
      && Math.abs(y - this.y) <= 11 + HIT_PAD;
  }

  escape() {
    this.setState('escaping');
    this.vx = 0;
    this.vy = -this.speed * 1.4;
  }

  update(dt, sfx) {
    this.t += dt;
    this.stateT += dt;
    switch (this.state) {
      case 'flying':
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.emerging && this.y < FLY_MAX_Y - 10) this.emerging = false;
        if (this.x < 16) { this.x = 16; this.vx = Math.abs(this.vx); }
        if (this.x > W - 16) { this.x = W - 16; this.vx = -Math.abs(this.vx); }
        if (this.y < FLY_MIN_Y) { this.y = FLY_MIN_Y; this.vy = Math.abs(this.vy); }
        if (!this.emerging && this.y > FLY_MAX_Y) { this.y = FLY_MAX_Y; this.vy = -Math.abs(this.vy); }
        if (!this.emerging && (this.turnIn -= dt) <= 0) {
          this.setDir(false);
          this.turnIn = rand(0.6, 1.8);
        }
        break;
      case 'escaping':
        this.y += this.vy * dt;
        if (this.y < -30) this.setState('gone');
        break;
      case 'shot':
        if (this.stateT > 0.45) { this.setState('falling'); sfx.fall(); }
        break;
      case 'falling':
        this.y += 120 * dt;
        if (this.y > GRASS_TOP + 6) { this.setState('dead'); sfx.thud(); }
        break;
    }
  }

  get done() { return this.state === 'dead' || this.state === 'gone'; }

  draw(ctx) {
    const s = SPR.ducks[this.kind];
    let img;
    const frame = Math.floor(this.t * (7 + this.speed / 18)) % 4;
    if (this.state === 'escaping') {
      img = s.away[frame];
    } else if (this.state === 'flying') {
      // Climbing steeply uses the NES's diagonal frames; otherwise side-on.
      const climbing = this.vy < -Math.abs(this.vx) * 0.75;
      const right = this.vx >= 0;
      img = (climbing ? (right ? s.diagRight : s.diagLeft) : (right ? s.right : s.left))[frame];
    } else if (this.state === 'shot') {
      img = s.shot;
    } else if (this.state === 'falling') {
      img = s.fall[Math.floor(this.stateT * 8) % 2];
    } else {
      return;
    }
    blit(ctx, img, this.x, this.y);
  }
}
