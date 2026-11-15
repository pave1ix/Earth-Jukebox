// Pixel field background: a slowly flowing field of square dots, ordered-dithered.
// Its colour follows the current track, its strength follows the music,
// and every note sends a ripple through the field at the note's pan and pitch.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const PALETTES = {
  idle: [130, 150, 205],
  ocean: [90, 200, 255],
  nightlights: [255, 190, 100],
  lightning: [200, 190, 255],
};
const RIPPLE_MS = 1800;

export class PixelField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cell = 8;
    this.ripples = [];
    this.color = [...PALETTES.idle];
    this.target = [...PALETTES.idle];
    this.energy = 0.55;
    this.targetEnergy = 0.55;
    this.t = 0;
    this.running = false;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.cols = Math.ceil(window.innerWidth / this.cell);
    this.rows = Math.ceil(window.innerHeight / this.cell);
    if (!this.running || this.reduced) this.draw();
  }

  setTrack(id) { this.target = [...(PALETTES[id] || PALETTES.idle)]; if (this.reduced) { this.color = [...this.target]; this.draw(); } }

  setEnergy(v) { this.targetEnergy = 0.45 + 0.5 * Math.max(0, Math.min(1, v || 0)); }

  ping(x, y, strength = 0.6) {
    if (this.reduced) return;
    this.ripples.push({ x: x * this.cols, y: y * this.rows, t0: performance.now(), s: strength });
    if (this.ripples.length > 6) this.ripples.shift();
  }

  start() {
    if (this.running) return;
    this.running = true;
    if (this.reduced) { this.draw(); return; }
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      if (document.hidden || now - last < 40) return; // about 25 frames a second
      this.t += Math.min(0.1, (now - last) / 1000);
      last = now;
      this.draw(now);
    };
    requestAnimationFrame(loop);
  }

  draw(now = performance.now()) {
    const { ctx, cols, rows, cell, t } = this;
    for (let i = 0; i < 3; i++) this.color[i] += (this.target[i] - this.color[i]) * 0.04;
    this.energy += (this.targetEnergy - this.energy) * 0.05;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const [r, g, b] = this.color.map(Math.round);
    ctx.fillStyle = `rgb(${r},${g},${b})`;

    this.ripples = this.ripples.filter((p) => now - p.t0 < RIPPLE_MS);
    const rip = this.ripples.map((p) => {
      const age = now - p.t0;
      return { x: p.x, y: p.y, rad: (age / 1000) * 26, a: p.s * (1 - age / RIPPLE_MS) };
    });

    const size = cell - 3;
    for (let y = 0; y < rows; y++) {
      const ny = y / rows;
      const warp = Math.sin(ny * 3.1 + t * 0.15) * 0.9 + Math.sin(ny * 7.3 - t * 0.11) * 0.25;
      for (let x = 0; x < cols; x++) {
        const nx = x / cols;
        let v = 0.5 + 0.5 * Math.sin(nx * 5.2 + warp * 2.4 - t * 0.18);
        v *= 0.55 + 0.45 * Math.sin(nx * 2.1 - ny * 3.7 + t * 0.07);
        v = v * v * this.energy;
        for (const p of rip) {
          const k = 1 - Math.abs(Math.hypot(x - p.x, y - p.y) - p.rad) / 3;
          if (k > 0) v += k * p.a;
        }
        if (v > BAYER[(y & 3) * 4 + (x & 3)]) {
          ctx.globalAlpha = v > 0.6 ? 0.9 : v > 0.3 ? 0.55 : 0.3;
          ctx.fillRect(x * cell, y * cell, size, size);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
