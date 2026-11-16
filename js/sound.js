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
// Fixed reference levels, measured on these NASA clips, so meters and loudness show real change.
const LIGHT_MIN = 0.0005;      // night lights: total light that reads as empty
const LIGHT_FULL = 0.00097;    // night lights: total light that reads as full
const CHANGE_FULL = 0.003;     // night lights: share of the map that reads as full change
const CO2_FULL = 0.016;        // co2: share of the map in thick orange that reads as full
const LIGHTNING_FULL = 0.0024; // lightning: share of the view that reads as full
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
    // Phones: a bigger audio buffer stops crackling, a shorter reverb saves CPU,
    // and the 'playback' session plays sound even when an iPhone is on silent.
    const phone = window.matchMedia('(pointer: coarse)').matches;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
    this.master = new Tone.Volume(-80).toDestination();
    this.limiter = new Tone.Limiter(-3).connect(this.master);
    this.reverb = new Tone.Reverb({ decay: phone ? 4.5 : 9, preDelay: 0.06, wet: 0.45 }).connect(this.limiter);
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
      lat: 0.5, side: 0.5,
      motionN: new Norm(0.004), colN: new Norm(0.0002),
    };
    this.applyTune(track.tune);
    const now = Tone.now();
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(this.explore ? 2600 : 1500, now);
    if (this.explore) return; // explore mode: no drones or pads, only hovered spots
    if (track.id === 'lightning') {
      this.drone.triggerAttack(note(0), now + 0.05);
      this.pad.triggerAttack([note(D3), note(D3 + 2), note(D3 + 4)], now + 0.05, 0.25);
    } else if (track.id === 'nightlights') {
      this.drone.triggerAttack(note(D3), now + 0.05);
    } else if (track.id === 'co2') {
      this.pad.triggerAttack([note(D3), note(D3 + 2), note(D3 + 4)], now + 0.05, 0.35);
    }
  }

  // ---------- notes ----------
  canPlay(now) {
    const limit = this.explore ? 10 : MAX_NOTES_PER_SEC;
    this.noteTimes = this.noteTimes.filter((x) => now - x < 1);
    if (this.noteTimes.length >= limit) return false;
    this.noteTimes.push(now);
    return true;
  }

  // loc = where on the map the note comes from: { u: 0 west .. 1 east, v: 0 north .. 1 south }
  bellAt(i, time, vel, pan, loc) {
    if (!this.canPlay(Tone.now())) return;
    this.bellPan.pan.rampTo(pan, 0.05, time);
    this.bell.triggerAttackRelease(note(i), 0.3, time, clamp(vel, 0.05, 1));
    if (this.onNote && loc) this.onNote(loc, vel);
  }

  softAt(i, time, vel, pan, loc) {
    if (!this.canPlay(Tone.now())) return;
    this.softPan.pan.rampTo(pan, 0.05, time);
    this.soft.triggerAttackRelease(note(i), 0.5, time, clamp(vel, 0.05, 1));
    if (this.onNote && loc) this.onNote(loc, vel);
  }

  // ---------- explore mode ----------
  // While exploring, the automatic music stops and only the hovered spot sounds.
  setExplore(on) {
    if (!this.ready) return;
    this.explore = on;
    this.stopAll();
    this.noteTimes = [];
    const now = Tone.now();
    this.filter.frequency.cancelScheduledValues(now);
    this.filter.frequency.setValueAtTime(on ? 2600 : 1500, now);
    if (!on && this.track) this.setTrack(this.track);
  }

  // sound = { kind: 'bell' | 'soft' | 'none', idx, vel, count }
  playExplore(sound, pan, loc) {
    if (!this.ready || !this.explore || !sound || sound.kind === 'none') return;
    const now = Tone.now() + 0.01;
    const count = sound.kind === 'arp' ? 1 : Math.max(1, sound.count || 1);
    for (let k = 0; k < count; k++) {
      const time = now + k * 0.12;
      if (sound.kind === 'soft') this.softAt(sound.idx, time, sound.vel, pan, loc);
      else if (sound.kind === 'arp') {
        // a chord played as a quick arpeggio: root, third and fifth of the scale
        [0, 2, 4].forEach((step, j) => this.bellAt(sound.idx + step, time + j * 0.14, sound.vel, pan, j === 0 ? loc : null));
      } else this.bellAt(sound.idx + (k % 2) * 2, time, sound.vel, pan, k === 0 ? loc : null);
    }
  }

  update(f, dt) {
    if (!this.ready || !this.track || this.explore) return { meters: {}, playhead: null };
    const now = Tone.now();
    if (this.track.id === 'ocean') return this.ocean(f, dt, now);
    if (this.track.id === 'nightlights') return this.nightlights(f, dt, now);
    if (this.track.id === 'co2') return this.co2(f, dt, now);
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
          this.bellAt(idx, now + 0.06 + k * 0.14 + Math.random() * 0.05, 0.25 + 0.35 * s.m,
            panOf(c, 16, 0.75), { u: (c + 0.5) / 16, v: (s.row + 0.5) / 16 });
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
  // in the change map, purple (new lights) rings high and orange (lights out) rings low.
  nightlights(f, dt, now) {
    const s = this.s;
    const t = this.track.tune;
    s.g = clamp((f.density - LIGHT_MIN) / (LIGHT_FULL - LIGHT_MIN), 0, 1); // fixed scale, so growth from 2012 to 2023 is audible
    const changeMode = f.purple > 0.0004;
    this.droneVol.volume.rampTo(BASE.drone + (t.drone || 0) - 12 + 12 * s.g, 0.5);
    s.timer += dt;
    if (s.timer >= t.step) {
      s.timer = 0;
      s.col = (s.col + 1) % 16;
      const col = f.cols[s.col];
      const bn = s.colN.norm(col.density);
      if (bn > t.gate) {
        const idx = D4 + Math.round((1 - col.posD) * 9);
        const pan = panOf(s.col, 16, 0.8);
        const vel = 0.2 + 0.5 * bn;
        const loc = { u: (s.col + 0.5) / 16, v: col.posD };
        if (changeMode && col.purple > 0.0003) this.bellAt(idx + 2, now + 0.02, vel, pan, loc);
        else this.bellAt(idx, now + 0.02, vel * 0.9, pan, loc);
        if (changeMode && col.orange > 0.0002 && col.orange > col.purple * 0.15) {
          this.softAt(idx - 5, now + 0.16, vel + 0.1, pan, loc);
        }
      }
    }
    return {
      meters: {
        total: s.g,
        more: changeMode ? clamp(f.purple / CHANGE_FULL, 0, 1) : 0, // same scale for both,
        less: changeMode ? clamp(f.orange / CHANGE_FULL, 0, 1) : 0, // so they can be compared
      },
      playhead: { axis: 'x', pos: (Math.max(s.col, 0) + 0.5) / 16 },
    };
  }

  // Lightning: only detected lightning makes chimes. No lightning, no chimes.
  // Pitch follows height on the globe, pan follows left to right.
  lightning(f, dt, now) {
    const s = this.s;
    const t = this.track.tune;
    const present = f.density > 0.00003;
    const d = present ? clamp(f.density / LIGHTNING_FULL, 0, 1) : 0; // fixed scale: more lightning, more chimes
    s.d += 0.25 * (d - s.d);
    if (present) { s.lat = 1 - f.posYD; s.side = f.posXD; }
    const rate = Math.min(MAX_NOTES_PER_SEC, 3.4 * s.d * t.rate);
    s.acc = Math.min(2, s.acc + rate * dt);
    while (s.acc >= 1) {
      s.acc -= 1;
      if (!present) break;
      const c = pickWeighted(f.cols.map((x) => x.density));
      const v = f.cols[c].posD;
      const idx = D4 + Math.round((1 - v) * 9);
      this.bellAt(idx, now + Math.random() * 0.08, 0.25 + 0.3 * s.d, panOf(c, 16, 0.85), { u: (c + 0.5) / 16, v });
    }
    this.filter.frequency.rampTo(500 + 2000 * s.d, 0.8);
    return {
      meters: { density: s.d, latitude: s.lat, side: s.side },
      playhead: null,
    };
  }

  // CO2: the background pad swells with the total thick CO2 on screen, so the day-night pulse
  // is heard as breathing. A playhead sweeps west to east; thick plumes sound a low soft tone,
  // pitched by latitude.
  co2(f, dt, now) {
    const s = this.s;
    const t = this.track.tune;
    s.g += 0.3 * (clamp(f.density / CO2_FULL, 0, 1) - s.g);
    this.padVol.volume.rampTo(BASE.pad + (t.pad || 0) - 14 + 16 * s.g, 0.6);
    this.filter.frequency.rampTo(400 + 2400 * s.g, 0.6);
    if (f.density > 0.0004) { s.lat = 1 - f.posYD; s.side = f.posXD; }
    s.timer += dt;
    if (s.timer >= t.step) {
      s.timer = 0;
      s.col = (s.col + 1) % 16;
      const col = f.cols[s.col];
      const bn = s.colN.norm(col.density);
      if (col.density > 0.0005 && bn > t.gate) {
        const idx = D3 + 1 + Math.round((1 - col.posD) * 9);
        this.softAt(idx, now + 0.02, 0.25 + 0.55 * bn, panOf(s.col, 16, 0.8), { u: (s.col + 0.5) / 16, v: col.posD });
      }
    }
    return {
      meters: { amount: s.g, latitude: s.lat, side: s.side },
      playhead: { axis: 'x', pos: (Math.max(s.col, 0) + 0.5) / 16 },
    };
  }
}
