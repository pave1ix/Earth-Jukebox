/* global Tone */
// Sound engine: turns frame measurements into calm, in-key music with Tone.js.
// Every note snaps to a D major pentatonic scale, so any mapping stays consonant.

const DEGREES = [0, 2, 4, 7, 9];
const ROOT = 38; // D2
const SCALE = [];
for (let o = 0; o < 5; o++) for (const d of DEGREES) SCALE.push(ROOT + 12 * o + d);
const D3 = 5;  // index of D3 in SCALE
const D4 = 10; // index of D4 in SCALE
const MAX_NOTES_PER_SEC = 4;
const BASE = { pad: -16, bell: -14, soft: -12, drone: -22 }; // dB before tuning offsets

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const note = (i) => Tone.Frequency(SCALE[clamp(Math.round(i), 0, SCALE.length - 1)], 'midi').toNote();
const panOf = (c, n, width) => ((c / (n - 1)) * 2 - 1) * width;

// Auto-gain: divides by a slowly decaying recent maximum so quiet clips still move.
class Norm {
  constructor(floor, decay = 0.997) { this.floor = floor; this.max = floor; this.decay = decay; }
  norm(v) { this.max = Math.max(v, this.max * this.decay, this.floor); return clamp(v / this.max, 0, 1); }
}

function pickWeighted(weights) {
  let sum = 0;
  for (const w of weights) sum += Math.max(0, w);
  if (sum <= 0) return Math.floor(Math.random() * weights.length);
  let r = Math.random() * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

export class SoundEngine {
  constructor() {
    this.ready = false;
    this.live = false;
    this.userDb = -6;
    this.track = null;
    this.s = {};
    this.noteTimes = [];
  }

  async init() {
    this.master = new Tone.Volume(-80).toDestination();
    this.limiter = new Tone.Limiter(-3).connect(this.master);
    this.reverb = new Tone.Reverb({ decay: 9, preDelay: 0.06, wet: 0.45 }).connect(this.limiter);
    if (this.reverb.ready) await this.reverb.ready;
    this.filter = new Tone.Filter({ type: 'lowpass', frequency: 1500, rolloff: -12, Q: 0.5 }).connect(this.reverb);

    this.padVol = new Tone.Volume(BASE.pad).connect(this.filter);
    this.bellVol = new Tone.Volume(BASE.bell).connect(this.filter);
    this.softVol = new Tone.Volume(BASE.soft).connect(this.filter);
    this.droneVol = new Tone.Volume(BASE.drone).connect(this.filter);
    this.bellPan = new Tone.Panner(0).connect(this.bellVol);
    this.softPan = new Tone.Panner(0).connect(this.softVol);

    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsine', count: 3, spread: 18 },
      envelope: { attack: 2.5, decay: 1, sustain: 0.7, release: 5 },
    }).connect(this.padVol);
    this.pad.maxPolyphony = 10;

    this.bell = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.01,
      modulationIndex: 1.6,
      oscillator: { type: 'sine' },
      modulation: { type: 'sine' },
      envelope: { attack: 0.004, decay: 1.4, sustain: 0, release: 1.6 },
      modulationEnvelope: { attack: 0.004, decay: 0.9, sustain: 0, release: 1 },
    }).connect(this.bellPan);
    this.bell.maxPolyphony = 12;

    this.soft = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.04, decay: 1.6, sustain: 0, release: 1.6 },
    }).connect(this.softPan);
    this.soft.maxPolyphony = 8;

    this.drone = new Tone.Synth({
      oscillator: { type: 'fatsine', count: 3, spread: 12 },
      envelope: { attack: 3, decay: 0.1, sustain: 1, release: 3 },
    }).connect(this.droneVol);

    this.ready = true;
  }

  // ---------- volume and transitions ----------
  setVolume(pct) {
    this.userDb = pct <= 0 ? -80 : 20 * Math.log10(pct / 100) - 2;
    if (this.ready && this.live) this.master.volume.rampTo(this.userDb, 0.1);
  }

  fadeIn(sec) {
    this.live = true;
    const now = Tone.now();
    this.master.volume.cancelScheduledValues(now);
    this.master.volume.rampTo(this.userDb, sec, now);
  }

  fadeOut(sec) {
    this.live = false;
    if (!this.ready) return Promise.resolve();
    const now = Tone.now();
    this.master.volume.cancelScheduledValues(now);
    this.master.volume.rampTo(-80, sec, now);
    return new Promise((r) => setTimeout(r, sec * 1000 + 40));
  }

  stopAll() {
    if (!this.ready) return;
    const now = Tone.now();
    this.pad.releaseAll(now);
    this.bell.releaseAll(now);
    this.soft.releaseAll(now);
    this.drone.triggerRelease(now);
  }

  applyTune(t) {
    if (!this.ready) return;
    this.padVol.volume.rampTo(BASE.pad + (t.pad || 0), 0.2);
    this.bellVol.volume.rampTo(BASE.bell + (t.bell || 0), 0.2);
    this.softVol.volume.rampTo(BASE.soft + (t.soft || 0), 0.2);
    this.droneVol.volume.rampTo(BASE.drone + (t.drone || 0), 0.2);
    this.reverb.wet.rampTo(t.reverb ?? 0.45, 0.3);
  }

  setTrack(track) {
    this.track = track;
    this.noteTimes = [];
    this.s = {
      timer: 0, row: 0, dir: 1, col: -1, acc: 0, chord: -1, chordAt: -99,
      temp: 0.5, m: 0, d: 0, g: 0,
      motionN: new Norm(0.004), lumN: new Norm(0.03), glumN: new Norm(0.02),
      denN: new Norm(0.002), purN: new Norm(0.005), oraN: new Norm(0.005),
    };
    this.applyTune(track.tune);
    const now = Tone.now();
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(1500, now);
    if (track.id === 'lightning') {
      this.drone.triggerAttack(note(0), now + 0.05);
      this.pad.triggerAttack([note(D3), note(D3 + 2), note(D3 + 4)], now + 0.05, 0.25);
    } else if (track.id === 'nightlights') {
      this.drone.triggerAttack(note(D3), now + 0.05);
    }
  }

  // ---------- notes ----------
  canPlay(now) {
    this.noteTimes = this.noteTimes.filter((x) => now - x < 1);
    if (this.noteTimes.length >= MAX_NOTES_PER_SEC) return false;
    this.noteTimes.push(now);
    return true;
  }

  bellAt(i, time, vel, pan) {
    if (!this.canPlay(Tone.now())) return;
    this.bellPan.pan.rampTo(pan, 0.05, time);
    this.bell.triggerAttackRelease(note(i), 0.3, time, clamp(vel, 0.05, 1));
  }

  softAt(i, time, vel, pan) {
    if (!this.canPlay(Tone.now())) return;
    this.softPan.pan.rampTo(pan, 0.05, time);
    this.soft.triggerAttackRelease(note(i), 0.5, time, clamp(vel, 0.05, 1));
  }

  update(f, dt) {
    if (!this.ready || !this.track) return { meters: {}, playhead: null };
    const now = Tone.now();
    if (this.track.id === 'ocean') return this.ocean(f, dt, now);
    if (this.track.id === 'nightlights') return this.nightlights(f, dt, now);
    return this.lightning(f, dt, now);
  }

  // Ocean: a scan line moves pole to pole. Temperature on the line sets the chord,
  // current movement sets the filter and how many bells ring.
  ocean(f, dt, now) {
    const s = this.s;
    const t = this.track.tune;
    s.timer += dt;
    if (s.timer >= t.step) {
      s.timer = 0;
      s.row += s.dir;
      if (s.row >= 15) { s.row = 15; s.dir = -1; } else if (s.row <= 0) { s.row = 0; s.dir = 1; }
      const band = f.rows[s.row];
      s.m = s.motionN.norm(band.motion);
      if (band.sat > 0.02) {
        s.temp = band.temp;
        const ci = D3 + Math.round(s.temp * 6);
        if (ci !== s.chord && now - s.chordAt >= t.chordHold) {
          this.pad.releaseAll(now);
          this.pad.triggerAttack([note(ci), note(ci + 2), note(ci + 4)], now + 0.05, 0.35);
          s.chord = ci;
          s.chordAt = now;
        }
        const weights = [];
        for (let c = 0; c < 16; c++) weights.push(f.cells.sat[s.row * 16 + c]);
        const count = Math.min(3, Math.round((0.4 + s.m * 2.6) * t.rate));
        for (let k = 0; k < count; k++) {
          const c = pickWeighted(weights);
          const idx = Math.max(s.chord, D3) + 5 + [0, 2, 4, 1, 3][Math.floor(Math.random() * 5)];
          this.bellAt(idx, now + 0.06 + k * 0.14 + Math.random() * 0.05, 0.25 + 0.35 * s.m, panOf(c, 16, 0.75));
        }
        this.filter.frequency.rampTo(450 + 2800 * s.m, 0.6);
      }
    }
    return {
      meters: { temp: s.temp, motion: s.m, latitude: 1 - s.row / 15 },
      playhead: { axis: 'y', pos: (s.row + 0.5) / 16 },
    };
  }

  // Night lights: a playhead sweeps west to east. Lit columns ring bells;
  // in the change map, purple (more light) rings high and orange (less light) rings low.
  nightlights(f, dt, now) {
    const s = this.s;
    const t = this.track.tune;
    s.g = s.glumN.norm(f.lum);
    this.droneVol.volume.rampTo(BASE.drone + (t.drone || 0) - 10 + 10 * s.g, 0.5);
    s.timer += dt;
    if (s.timer >= t.step) {
      s.timer = 0;
      s.col = (s.col + 1) % 16;
      const col = f.cols[s.col];
      const bn = s.lumN.norm(col.lum);
      if (bn > t.gate) {
        const idx = D4 + Math.round((1 - col.pos) * 9);
        const changeMode = f.purple > 0.006;
        const pan = panOf(s.col, 16, 0.8);
        const vel = 0.2 + 0.5 * bn;
        if (changeMode && col.orange > col.purple * 1.2 && col.orange > 0.01) this.softAt(idx - 5, now + 0.02, vel + 0.1, pan);
        else if (changeMode && col.purple > col.orange * 1.2 && col.purple > 0.01) this.bellAt(idx + 2, now + 0.02, vel, pan);
        else this.bellAt(idx, now + 0.02, vel * 0.9, pan);
      }
    }
    return {
      meters: { brightness: s.g, more: s.purN.norm(f.purple), less: s.oraN.norm(f.orange) },
      playhead: { axis: 'x', pos: (Math.max(s.col, 0) + 0.5) / 16 },
    };
  }

  // Lightning: more lightning on screen means more chimes.
  // Chime pitch follows latitude, pan follows longitude.
  lightning(f, dt, now) {
    const s = this.s;
    const t = this.track.tune;
    const d = s.denN.norm(f.density);
    s.d += 0.2 * (d - s.d);
    s.g = s.glumN.norm(f.lum);
    const rate = Math.min(MAX_NOTES_PER_SEC, (0.15 + 3.2 * s.d) * t.rate);
    s.acc += rate * dt;
    while (s.acc >= 1) {
      s.acc -= 1;
      const c = pickWeighted(f.cols.map((x) => x.density));
      const idx = D4 + Math.round((1 - f.cols[c].posD) * 9);
      this.bellAt(idx, now + Math.random() * 0.08, 0.2 + 0.3 * s.d * Math.random() + 0.1, panOf(c, 16, 0.85));
    }
    this.filter.frequency.rampTo(500 + 2000 * s.d, 0.8);
    return {
      meters: { density: s.d, latitude: 1 - f.posYD, brightness: s.g },
      playhead: null,
    };
  }
}
