// Frame analyzer: shrinks the current video frame onto a small canvas,
// splits it into a 16 x 16 grid and measures each cell 12 times a second.

export const GX = 16;
export const GY = 16;
const KEYS = ['lum', 'temp', 'sat', 'motion', 'purple', 'orange', 'density'];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

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
    this.w = canvas.width;
    this.h = canvas.height;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.reset();
  }

  reset() {
    this.prevLum = null;
    this.state = null; // smoothed cell values
  }

  sample(video, track) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const { w, h, ctx } = this;
    const crop = track.crop || { x: 0, y: 0, w: 1, h: 1 };
    ctx.drawImage(video, crop.x * vw, crop.y * vh, crop.w * vw, crop.h * vh, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;

    const n = GX * GY;
    const raw = {};
    for (const k of KEYS) raw[k] = new Float32Array(n);
    const count = new Float32Array(n);
    const tempCount = new Float32Array(n);
    const lumNow = new Float32Array(w * h);
    const thresh = track.tune.thresh ?? 0.5;
    const prev = this.prevLum;

    for (let y = 0; y < h; y++) {
      const rowBase = Math.floor((y * GY) / h) * GX;
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const i = p * 4;
        const r = px[i] / 255;
        const g = px[i + 1] / 255;
        const b = px[i + 2] / 255;
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        lumNow[p] = l;
        const cell = rowBase + Math.floor((x * GX) / w);
        count[cell]++;
        raw.lum[cell] += l;
        if (l > thresh) raw.density[cell]++;
        if (prev) raw.motion[cell] += Math.abs(l - prev[p]);

        // Colour: hue tells temperature (blue cold to red warm) and purple/orange change.
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const sat = max > 0 ? (max - min) / max : 0;
        if (sat > 0.35 && max > 0.2) {
          const hue = hueOf(r, g, b, max, min);
          raw.sat[cell]++;
          const hh = hue >= 330 ? hue - 360 : hue; // reds just below 360 count as warm
          if (hh <= 260) {
            raw.temp[cell] += clamp01((240 - hh) / 240);
            tempCount[cell]++;
          }
          if (hue >= 255 && hue <= 320 && max > 0.25) raw.purple[cell]++;
          if (hue >= 15 && hue <= 50 && sat > 0.45 && max > 0.35) raw.orange[cell]++;
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
  for (let r = 0; r < GY; r++) {
    for (let c = 0; c < GX; c++) {
      const i = r * GX + c;
      add(rows[r], cells, i, c / (GX - 1)); // row: position west (0) to east (1)
      add(cols[c], cells, i, r / (GY - 1)); // column: position north (0) to south (1)
      add(all, cells, i, r / (GY - 1));
    }
  }
  rows.forEach((o) => finish(o, GX));
  cols.forEach((o) => finish(o, GY));
  finish(all, GX * GY);
  return {
    cells, rows, cols,
    lum: all.lum, sat: all.sat, motion: all.motion, density: all.density,
    purple: all.purple, orange: all.orange, temp: all.temp,
    posY: all.pos, posYD: all.posD,
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
  o.posD = o.wD > 0 ? o.pD / o.wD : 0.5; // position weighted by bright points
}
