// Finger-gun tracking with MediaPipe Hand Landmarker.
//
// Aim:  index fingertip position in the (mirrored) camera image, mapped from a
//       central "active box" to the whole screen and smoothed with a 1€ filter.
// Fire: the thumb "hammer" drops onto the side of the index finger. Measured in
//       3D world landmarks, so it works with the finger pointed at the camera.

const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Thumb distance / palm size. The thumb's "up" and "down" levels are learned
// per player while playing; these are only the starting guesses.
const OPEN_PRIOR = 0.7;
const CLOSED_PRIOR = 0.3;
const MIN_RANGE = 0.18;
const COCK_AT = 0.65; // fraction of the learned range
const FIRE_AT = 0.35;
const SHOT_COOLDOWN_MS = 220;
const HISTORY_MS = 600;
// A hand sliding into view gives rough landmarks for a few frames: wait before
// showing it, and longer before letting it fire.
const SHOW_AFTER_FRAMES = 3;
const ARM_AFTER_MS = 300;
// A gap this long between tracked frames (tracking stalled) counts as a lost hand.
const STALL_MS = 250;

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
const clamp01 = v => Math.min(1, Math.max(0, v));

class OneEuro {
  constructor(minCutoff = 1.0, beta = 0.02, dCutoff = 1.0) {
    Object.assign(this, { minCutoff, beta, dCutoff });
    this.reset();
  }
  reset() { this.x = null; this.dx = 0; this.t = null; }
  static alpha(cutoff, dt) { return 1 / (1 + 1 / (2 * Math.PI * cutoff * dt)); }
  filter(x, tMs) {
    if (this.x === null) { this.x = x; this.t = tMs; return x; }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const dx = (x - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (dx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (x - this.x);
    return this.x;
  }
}

export class HandGun {
  // width/height: game resolution the aim is reported in.
  constructor({ width, height, onFire }) {
    this.width = width;
    this.height = height;
    this.onFire = onFire;
    this.ready = false;
    this.visible = false;
    this.cocked = false;
    this.gunPose = false;
    this.thumb = 0;
    this.x = width / 2;
    this.y = height / 2;
    this.fx = new OneEuro(1.2, 0.03);
    this.fy = new OneEuro(1.2, 0.03);
    this.open = OPEN_PRIOR;
    this.closed = CLOSED_PRIOR;
    this.history = []; // { t, x, y, thumb } as shown on screen
    this.lastShot = 0;
    this.lastVideoTime = -1;
    this.seen = 0;          // consecutive frames with a hand
    this.trackedSince = 0;  // when the current run of frames began
    this.lastSeenAt = 0;
    this.lastError = 0;
    // Portion of the camera frame that maps to the full screen; smaller = less arm travel.
    this.box = { x0: 0.18, x1: 0.82, y0: 0.12, y1: 0.72 };
  }

  async start(video, overlay, onStatus = () => {}) {
    onStatus('Requesting camera…');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    this.video = video;
    this.overlay = overlay;
    this.octx = overlay.getContext('2d');

    onStatus('Loading hand model…');
    const { FilesetResolver, HandLandmarker } = await import(`${VISION}/vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${VISION}/wasm`);
    const opts = delegate => ({
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, opts('GPU'));
    } catch {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, opts('CPU'));
    }
    this.ready = true;
    onStatus('Show a finger gun');
  }

  update(now) {
    if (!this.ready || this.video.readyState < 2) return;
    if (this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;

    let res;
    try {
      res = this.landmarker.detectForVideo(this.video, now);
    } catch (err) {
      // Never let a tracking error stop the game; report it now and then.
      if (now - this.lastError > 5000) { this.lastError = now; console.error('Hand tracking error', err); }
      res = null;
    }
    const lm = res?.landmarks?.[0];
    const wl = res?.worldLandmarks?.[0];
    if (!lm || !wl) {
      this.lose();
      this.drawOverlay(null);
      return;
    }
    // After a stall the old aim and thumb history are stale: start afresh.
    if (this.seen && now - this.lastSeenAt > STALL_MS) this.lose();
    if (this.seen++ === 0) this.trackedSince = now;
    this.lastSeenAt = now;
    if (this.seen < SHOW_AFTER_FRAMES) { this.drawOverlay(lm); return; }
    this.visible = true;

    // Aim.
    const { x0, x1, y0, y1 } = this.box;
    const rx = clamp01(((1 - lm[8].x) - x0) / (x1 - x0));
    const ry = clamp01((lm[8].y - y0) / (y1 - y0));
    this.x = this.fx.filter(rx * this.width, now);
    this.y = this.fy.filter(ry * this.height, now);

    // Gesture.
    const palm = dist(wl[0], wl[9]);
    const raw = Math.min(dist(wl[4], wl[5]), dist(wl[4], wl[6]), dist(wl[4], wl[10])) / palm;
    // Light smoothing only: a thumb snap lasts just a few frames.
    this.thumb = this.history.length ? this.thumb * 0.35 + raw * 0.65 : raw;
    this.learnRange(this.thumb);
    // Only an obviously open hand (2+ of middle/ring/pinky extended) blocks firing.
    const curled = [[12, 9], [16, 13], [20, 17]]
      .filter(([tip, mcp]) => dist(wl[tip], wl[0]) < dist(wl[mcp], wl[0]) * 1.5).length;
    this.gunPose = curled >= 2;

    this.history.push({ t: now, x: this.x, y: this.y, thumb: this.thumb });
    while (this.history.length && now - this.history[0].t > HISTORY_MS) this.history.shift();

    if (this.thumb > this.cockLevel) {
      this.cocked = true;
    } else if (this.cocked && this.thumb < this.fireLevel) {
      this.cocked = false;
      const settled = now - this.trackedSince > ARM_AFTER_MS;
      if (this.gunPose && settled && now - this.lastShot > SHOT_COOLDOWN_MS) {
        this.lastShot = now;
        const aim = this.aimAtDropStart();
        this.onFire(aim.x, aim.y);
      }
    }
    this.drawOverlay(lm);
  }

  lose() {
    this.visible = false;
    this.cocked = false;
    this.seen = 0;
    this.fx.reset(); this.fy.reset();
    this.history = [];
  }

  // Tracks this player's thumb-up and thumb-down levels: snaps quickly to new
  // extremes, relaxes very slowly so holding still doesn't erase the range.
  learnRange(v) {
    this.open += (v - this.open) * (v > this.open ? 0.5 : 0.0008);
    this.closed += (v - this.closed) * (v < this.closed ? 0.5 : 0.0008);
    if (this.open - this.closed < MIN_RANGE) {
      const mid = (this.open + this.closed) / 2;
      this.open = mid + MIN_RANGE / 2;
      this.closed = mid - MIN_RANGE / 2;
    }
  }

  get cockLevel() { return this.closed + (this.open - this.closed) * COCK_AT; }
  get fireLevel() { return this.closed + (this.open - this.closed) * FIRE_AT; }

  // The crosshair position at the moment the thumb started to fall: walk back
  // from now only while the thumb was clearly higher the frame before, so we
  // stop at the last frame before the drop. That skips the hand's jerk during
  // the snap without reaching back into older, stale aim.
  aimAtDropStart() {
    const h = this.history;
    let i = h.length - 1;
    while (i > 0 && h[i - 1].thumb > h[i].thumb + 0.01) i--;
    return h[Math.max(0, i)] ?? { x: this.x, y: this.y };
  }

  drawOverlay(lm) {
    const c = this.overlay, ctx = this.octx;
    const w = this.video.videoWidth, h = this.video.videoHeight;
    if (c.width !== w) { c.width = w; c.height = h; }
    ctx.clearRect(0, 0, w, h);

    // Active box (the overlay is mirrored with CSS, so draw in camera space).
    const { x0, x1, y0, y1 } = this.box;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.strokeRect((1 - x1) * w, y0 * h, (x1 - x0) * w, (y1 - y0) * h);
    ctx.setLineDash([]);
    if (!lm) return;

    const color = !this.gunPose ? '#9c9c9c' : this.cocked ? '#80d010' : '#fc7c3c';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    for (const [a, b] of CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(lm[a].x * w, lm[a].y * h);
      ctx.lineTo(lm[b].x * w, lm[b].y * h);
      ctx.stroke();
    }
    ctx.fillStyle = '#fcfcfc';
    for (const i of [4, 8]) {
      ctx.beginPath();
      ctx.arc(lm[i].x * w, lm[i].y * h, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  get status() {
    if (!this.ready) return '';
    if (!this.visible) return 'No hand: show a finger gun';
    if (!this.gunPose) return 'Curl your other fingers';
    return this.cocked ? 'Cocked: drop thumb to fire' : 'Raise thumb to cock';
  }
}
