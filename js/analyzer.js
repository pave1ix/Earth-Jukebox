// Frame analyzer: reads the visible part of the current video frame,
// splits it into a 16 x 16 grid and measures each cell 12 times a second.

export const GX = 16;
export const GY = 16;
const KEYS = ['lum', 'temp', 'sat', 'motion', 'purple', 'orange', 'density'];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const LAND_GREY = 0.15; // night lights: anything darker than this is unlit land or sea

function hueOf(r, g, b, max, min) {
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

export class Analyzer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.reset();
  }

  reset() {
    this.prevLum = null;
    this.state = null; // smoothed cell values
    this.mask = null;
    this.maskFor = null;
  }

  // Mark pixels inside the track's "ignore" areas so they are never read.
  buildMask(track, w, h) {
    const mask = new Uint8Array(w * h);
    for (const r of track.ignore || []) {
      const x0 = Math.floor(r.x * w), x1 = Math.ceil((r.x + r.w) * w);
      const y0 = Math.floor(r.y * h), y1 = Math.ceil((r.y + r.h) * h);
      for (let y = y0; y < Math.min(h, y1); y++) for (let x = x0; x < Math.min(w, x1); x++) mask[y * w + x] = 1;
    }
    this.mask = mask;
    this.maskFor = track.id;
  }

  // Draw the track's view of the frame at sample size and return the pixels.
  read(video, track) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const [w, h] = track.res;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.prevLum = null;
    }
    const v = track.view;
    this.ctx.imageSmoothingQuality = 'high';
    this.ctx.drawImage(video, v.x * vw, v.y * vh, v.w * vw, v.h * vh, 0, 0, w, h);
    return this.ctx.getImageData(0, 0, w, h).data;
  }

  sample(video, track) {
    const px = this.read(video, track);
    return px ? this.measure(px, track) : null;
  }

  measure(px, track) {
    const [w, h] = track.res;
    if (this.maskFor !== track.id || !this.mask || this.mask.length !== w * h) this.buildMask(track, w, h);
    const mask = this.mask;
    const detect = track.detect;

    const n = GX * GY;
    const raw = {};
    for (const k of KEYS) raw[k] = new Float32Array(n);
    const count = new Float32Array(n);
    const tempCount = new Float32Array(n);
    const lumNow = new Float32Array(w * h);
    const prev = this.prevLum && this.prevLum.length === w * h ? this.prevLum : null;

    for (let y = 0; y < h; y++) {
      const rowBase = Math.floor((y * GY) / h) * GX;
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const cell = rowBase + Math.floor((x * GX) / w);
        count[cell]++;
        if (mask[p]) continue;
        const i = p * 4;
        const r = px[i] / 255;
        const g = px[i + 1] / 255;
        const b = px[i + 2] / 255;
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        lumNow[p] = l;
        raw.lum[cell] += l;
        if (prev) raw.motion[cell] += Math.abs(l - prev[p]);
        const max = Math.max(r, g, b);

        if (detect === 'ocean') {
          // Hue is temperature: blue (cold) through green and yellow to red (hot).
          const min = Math.min(r, g, b);
          const sat = max > 0 ? (max - min) / max : 0;
          if (sat > 0.35 && max > 0.2) {
            const hue = hueOf(r, g, b, max, min);
            raw.sat[cell]++;
            const hh = hue >= 330 ? hue - 360 : hue;
            if (hh <= 260) {
              raw.temp[cell] += clamp01((240 - hh) / 240);
              tempCount[cell]++;
            }
          }
        } else if (detect === 'lights') {
          // Light is anything brighter than the grey land. Purple and orange mark change.
          if (max > LAND_GREY) raw.density[cell] += max - LAND_GREY;
          if (b > r * 1.1 && b > g * 1.1 && max > 0.15) raw.purple[cell]++;
          else if (r > b * 1.6 && g > b * 1.15 && max > 0.18) raw.orange[cell]++;
        } else if (detect === 'yellow') {
          // Lightning points are yellow. Stars, labels and the ISS track are white and are skipped.
          if (r > 0.3 && g > 0.2 && r - b > 0.12 && b < 0.8 * r) raw.density[cell]++;
        }
      }
    }
    this.prevLum = lumNow;

    for (let c = 0; c < n; c++) {
      const k = count[c] || 1;
      for (const key of KEYS) if (key !== 'temp') raw[key][c] /= k;
      raw.temp[c] = tempCount[c] > 0 ? raw.temp[c] / tempCount[c] : -1; // -1 = no coloured pixels
    }

    // Smoothing: values glide instead of jumping.
    const a = clamp01(track.tune.smooth ?? 0.35);
    if (!this.state) {
      this.state = {};
      for (const key of KEYS) this.state[key] = raw[key].slice();
    } else {
      for (const key of KEYS) {
        const s = this.state[key];
        const v = raw[key];
        for (let c = 0; c < n; c++) {
          if (key === 'temp') {
            if (v[c] < 0) continue;
            if (s[c] < 0) { s[c] = v[c]; continue; }
          }
          s[c] += a * (v[c] - s[c]);
        }
      }
    }
    return summarize(this.state);
  }
}

// Turn the grid into rows, columns and whole-frame numbers.
function summarize(cells) {
  const rows = Array.from({ length: GY }, blank);
  const cols = Array.from({ length: GX }, blank);
  const all = blank();
  let px = 0, pw = 0;
  for (let r = 0; r < GY; r++) {
    for (let c = 0; c < GX; c++) {
      const i = r * GX + c;
      add(rows[r], cells, i, c / (GX - 1)); // row: position west (0) to east (1)
      add(cols[c], cells, i, r / (GY - 1)); // column: position north (0) to south (1)
      add(all, cells, i, r / (GY - 1));
      px += cells.density[i] * (c / (GX - 1));
      pw += cells.density[i];
    }
  }
  rows.forEach((o) => finish(o, GX));
  cols.forEach((o) => finish(o, GY));
  finish(all, GX * GY);
  return {
    cells, rows, cols,
    lum: all.lum, sat: all.sat, motion: all.motion, density: all.density,
    purple: all.purple, orange: all.orange, temp: all.temp,
    posY: all.pos, posYD: all.posD, posXD: pw > 0 ? px / pw : 0.5,
  };
}

function blank() {
  return { lum: 0, sat: 0, motion: 0, density: 0, purple: 0, orange: 0, tSum: 0, tW: 0, pL: 0, wL: 0, pD: 0, wD: 0 };
}

function add(o, cells, i, pos) {
  const l = cells.lum[i];
  const s = cells.sat[i];
  const d = cells.density[i];
  o.lum += l; o.sat += s; o.density += d;
  o.motion += cells.motion[i]; o.purple += cells.purple[i]; o.orange += cells.orange[i];
  const t = cells.temp[i];
  if (t >= 0 && s > 0) { o.tSum += t * s; o.tW += s; }
  const wl = l * l;
  o.pL += wl * pos; o.wL += wl;
  o.pD += d * pos; o.wD += d;
}

function finish(o, k) {
  o.lum /= k; o.sat /= k; o.motion /= k; o.density /= k; o.purple /= k; o.orange /= k;
  o.temp = o.tW > 0 ? o.tSum / o.tW : 0.5;
  o.pos = o.wL > 0 ? o.pL / o.wL : 0.5;  // brightness-weighted position
  o.posD = o.wD > 0 ? o.pD / o.wD : 0.5; // position weighted by the detected signal
}
