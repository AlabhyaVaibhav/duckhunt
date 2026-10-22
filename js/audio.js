// Chiptune-style sound effects synthesised with WebAudio.

const midi = n => 440 * 2 ** ((n - 69) / 12);

export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // Must be called from a user gesture.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.3;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.3;
    return this.muted;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  tone(freq, t, dur, { type = 'square', vol = 0.2, to = null } = {}) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(t, dur, { vol = 0.5, from = 5000, to = 300 } = {}) {
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur);
  }

  // seq: [[midiNote | null, steps], ...]
  melody(seq, { step = 0.11, type = 'square', vol = 0.12, bass = null } = {}) {
    let t = this.now + 0.02;
    for (const [n, len] of seq) {
      if (n !== null) this.tone(midi(n), t, step * len * 0.9, { type, vol });
      t += step * len;
    }
    if (bass) {
      let tb = this.now + 0.02;
      for (const [n, len] of bass) {
        if (n !== null) this.tone(midi(n), tb, step * len * 0.9, { type: 'triangle', vol: vol * 1.6 });
        tb += step * len;
      }
    }
    return t - this.now;
  }

  shot() {
    const t = this.now;
    this.noise(t, 0.35, { vol: 0.9, from: 7000, to: 200 });
    this.tone(160, t, 0.14, { type: 'triangle', vol: 0.7, to: 40 });
  }

  quack() {
    const t = this.now;
    for (const dt of [0, 0.13]) {
      this.tone(720, t + dt, 0.08, { type: 'sawtooth', vol: 0.07, to: 430 });
    }
  }

  flap() {
    this.noise(this.now, 0.05, { vol: 0.08, from: 1800, to: 600 });
  }

  fall() {
    this.tone(1500, this.now, 0.9, { type: 'square', vol: 0.05, to: 260 });
  }

  thud() {
    const t = this.now;
    this.tone(120, t, 0.14, { type: 'triangle', vol: 0.6, to: 45 });
    this.noise(t, 0.1, { vol: 0.3, from: 900, to: 100 });
  }

  click() {
    this.tone(1200, this.now, 0.04, { type: 'square', vol: 0.05 });
  }

  intro() {
    return this.melody(
      [[67, 1], [72, 1], [76, 1], [72, 1], [79, 2], [76, 1], [77, 1],
       [79, 1], [81, 1], [79, 1], [76, 1], [72, 2], [74, 1], [76, 1], [72, 4]],
      { bass: [[48, 4], [55, 4], [53, 4], [55, 4], [48, 4]] },
    );
  }

  gotDuck() {
    return this.melody([[72, 1], [76, 1], [79, 1], [84, 2], [79, 1], [84, 3]], { step: 0.09 });
  }

  laugh() {
    const seq = [];
    for (let i = 0; i < 4; i++) seq.push([62, 1], [null, 0.4], [58, 1], [null, 0.6]);
    return this.melody(seq, { step: 0.09, type: 'square', vol: 0.1 });
  }

  flyAway() {
    return this.melody([[76, 1], [74, 1], [72, 1], [71, 1], [69, 3]], { step: 0.1, vol: 0.08 });
  }

  roundClear() {
    return this.melody(
      [[72, 1], [76, 1], [79, 1], [84, 2], [81, 1], [84, 1], [88, 4]],
      { step: 0.12, bass: [[48, 6], [53, 2], [55, 4]] },
    );
  }

  perfect() {
    return this.melody(
      [[72, 1], [76, 1], [79, 1], [84, 1], [76, 1], [79, 1], [84, 1], [88, 1],
       [79, 1], [84, 1], [88, 1], [91, 4]],
      { step: 0.09, bass: [[48, 4], [52, 4], [55, 8]] },
    );
  }

  gameOver() {
    return this.melody(
      [[72, 2], [67, 2], [64, 2], [60, 1], [62, 1], [60, 6]],
      { step: 0.16, type: 'triangle', vol: 0.18, bass: [[48, 8], [43, 6]] },
    );
  }
}
