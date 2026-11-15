// Dot Earth: the NASA frame that is playing, redrawn live as a field of fine dots.
// Bright data makes dense dots, dark areas stay empty, and each dot keeps the colour of the data.
// When a note plays, a ring of dots spreads from the place on the map that the note came from.

export const CELL = 4; // one dot every 4 screen pixels (finer on high-density screens)
const RIPPLE_MS = 1700;

// 8 x 8 ordered-dither thresholds (Bayer matrix), 0..1
const BAYER = (() => {
  const m = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38,
    60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
  return m.map((v) => (v + 0.5) / 64);
})();

// Pure drawing step: src = RGBA samples (cols x rows), out = RGBA pixels (cols*CELL x rows*CELL).
// mask (optional) = cells that are never drawn (labels and colour bars inside the NASA frame).
export function drawDots(src, cols, rows, out, opts, ripples = [], mask = null) {
  out.fill(0);
  const W = cols * CELL;
  const gain = opts.gain ?? 1.5;
  const gamma = opts.gamma ?? 0.85;
  const colour = opts.colour ?? 0; // 0 = brightness only, 1 = only coloured data makes dots
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      let r = src[i], g = src[i + 1], b = src[i + 2];
      if (mask && mask[y * cols + x]) { r = 0; g = 0; b = 0; }
      const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
      const sat = hi > 0 ? (hi - lo) / hi : 0;
      const level0 = (hi / 255) * gain * (1 - colour + colour * 1.5 * sat);
      let v = Math.min(1, Math.pow(level0, gamma));
      v = v < 0.04 ? 0 : (v - 0.04) / 0.96; // floor: black stays empty
      let ring = 0;
      for (const p of ripples) {
        const k = 1 - Math.abs(Math.hypot(x - p.x, y - p.y) - p.rad) / (p.thick || 2.2);
        if (k > 0) ring = Math.max(ring, k * p.a);
      }
      v = Math.min(1, v + ring);
      if (v <= BAYER[(y & 7) * 8 + (x & 7)]) continue;

      // Dot colour: the data's own hue, slightly softened; ring dots turn white.
      const max = Math.max(hi, 48);
      const level = 0.5 + 0.5 * v;
      const soften = Math.min(1, 0.22 + ring);
      const cr = ((r / max) * (1 - soften) + soften) * level * 255;
      const cg = ((g / max) * (1 - soften) + soften) * level * 255;
      const cb = ((b / max) * (1 - soften) + soften) * level * 255;
      const size = v > 0.9 ? 3 : 2;
      for (let dy = 0; dy < size; dy++) {
        let o = ((y * CELL + dy) * W + x * CELL) * 4;
        for (let dx = 0; dx < size; dx++, o += 4) {
          out[o] = cr; out[o + 1] = cg; out[o + 2] = cb; out[o + 3] = 255;
        }
      }
    }
  }
}

// Which part of the view fills a box of the given shape ("cover" fit).
export function coverRect(viewAspect, boxAspect, focusY = 0.5) {
  if (viewAspect > boxAspect) {
    const w = boxAspect / viewAspect;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = viewAspect / boxAspect;
  return { x: 0, y: Math.max(0, Math.min(1 - h, focusY - h / 2)), w: 1, h };
}

export class DotEarth {
  constructor(canvas, video) {
    this.canvas = canvas;
    this.video = video;
    this.ctx = canvas.getContext('2d');
    this.small = document.createElement('canvas');
    this.sctx = this.small.getContext('2d', { willReadFrequently: true });
    this.poster = new Image();
    this.poster.addEventListener('load', () => { this.dirty = true; });
    this.track = null;
    this.ripples = [];
    this.live = false;
    this.dirty = true;
    this.fit = { x: 0, y: 0, w: 1, h: 1 };
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    let last = 0;
    const loop = (now) => {
      requestAnimationFrame(loop);
      if (document.hidden || now - last < 70) return;
      if (!(this.dirty || this.ripples.length || (this.live && !this.reduced))) return;
      last = now;
      this.draw(now);
    };
    requestAnimationFrame(loop);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.cols = Math.max(8, Math.ceil((rect.width * this.dpr) / CELL));
    this.rows = Math.max(8, Math.ceil((rect.height * this.dpr) / CELL));
    this.canvas.width = this.cols * CELL;
    this.canvas.height = this.rows * CELL;
    this.small.width = this.cols;
    this.small.height = this.rows;
    this.image = this.ctx.createImageData(this.cols * CELL, this.rows * CELL);
    this.dirty = true;
  }

  setTrack(track) {
    this.track = track;
    this.ripples = [];
    this.poster.src = track.poster;
    this.dirty = true;
  }

  setLive(on) { this.live = on; this.dirty = true; }

  // u, v = position inside the track's view, 0..1
  ping(u, v, strength = 0.7) {
    if (this.reduced) return;
    const f = this.fit;
    const x = ((u - f.x) / f.w) * this.cols;
    const y = ((v - f.y) / f.h) * this.rows;
    if (x < -8 || y < -8 || x > this.cols + 8 || y > this.rows + 8) return;
    this.ripples.push({ x, y, t0: performance.now(), s: strength });
    if (this.ripples.length > 8) this.ripples.shift();
  }

  // Cells covered by the track's "ignore" areas, in dot coordinates.
  maskFor(track, f) {
    const key = `${track.id}:${this.cols}x${this.rows}:${f.x},${f.y},${f.w},${f.h}`;
    if (this.maskKey === key) return this.mask;
    const mask = new Uint8Array(this.cols * this.rows);
    for (const r of track.ignore || []) {
      const x0 = Math.floor(((r.x - f.x) / f.w) * this.cols), x1 = Math.ceil(((r.x + r.w - f.x) / f.w) * this.cols);
      const y0 = Math.floor(((r.y - f.y) / f.h) * this.rows), y1 = Math.ceil(((r.y + r.h - f.y) / f.h) * this.rows);
      for (let y = Math.max(0, y0); y < Math.min(this.rows, y1); y++) {
        for (let x = Math.max(0, x0); x < Math.min(this.cols, x1); x++) mask[y * this.cols + x] = 1;
      }
    }
    this.maskKey = key;
    this.mask = mask;
    return mask;
  }

  draw(now = performance.now()) {
    const t = this.track;
    if (!t) return;
    const { cols, rows, sctx, video } = this;
    const useVideo = video.readyState >= 2 && video.videoWidth > 0;
    const usePoster = !useVideo && this.poster.complete && this.poster.naturalWidth > 0;
    if (!useVideo && !usePoster) return;
    const v = t.view;
    const srcW = useVideo ? video.videoWidth : this.poster.naturalWidth;
    const srcH = useVideo ? video.videoHeight : this.poster.naturalHeight;
    // The poster image is already cut to the view; the video is the full frame.
    const vx = useVideo ? v.x * srcW : 0, vy = useVideo ? v.y * srcH : 0;
    const vw = useVideo ? v.w * srcW : srcW, vh = useVideo ? v.h * srcH : srcH;
    this.fit = coverRect(vw / vh, cols / rows, t.focusY ?? 0.5);
    const f = this.fit;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(useVideo ? video : this.poster, vx + f.x * vw, vy + f.y * vh, f.w * vw, f.h * vh, 0, 0, cols, rows);
    const src = sctx.getImageData(0, 0, cols, rows).data;

    this.ripples = this.ripples.filter((p) => now - p.t0 < RIPPLE_MS);
    const rip = this.ripples.map((p) => {
      const age = (now - p.t0) / RIPPLE_MS;
      return { x: p.x, y: p.y, rad: (2 + age * 24) * this.dpr, a: p.s * (1 - age), thick: 2.2 * this.dpr };
    });
    drawDots(src, cols, rows, this.image.data, t.dot || {}, rip, this.maskFor(t, f));
    this.ctx.putImageData(this.image, 0, 0);
    this.dirty = false;
  }
}
