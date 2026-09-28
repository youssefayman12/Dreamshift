// Helpers shared by the Dream World themes.
import { mulberry32, rgba, TAU } from '../engine/math.js';
import { makeSprite } from '../render/sprites.js';

/** Iterate deterministic "slots" of a parallax layer (infinite, no tiling). */
export function slots(v, factor, spacing, seed, fn) {
  const off = v.camX * factor;
  const i0 = Math.floor((off - 420) / spacing);
  const i1 = Math.floor((off + v.w + 420) / spacing);
  for (let i = i0; i <= i1; i++) {
    const rng = mulberry32((seed ^ Math.imul(i, 2654435761)) >>> 0);
    fn(i * spacing - off, rng, i);
  }
}

/** Vertical position of a background element anchored at world y. */
export function bgY(v, worldY, factor, depth = 0) {
  return worldY - v.camY * factor + v.gShift * depth * 22;
}

export class SkyCache {
  constructor(stops) { this.stops = stops; this.h = 0; this.grad = null; }
  draw(ctx, v) {
    if (!this.grad || this.h !== v.h || this.ctx !== ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, v.h);
      for (const [o, c] of this.stops) g.addColorStop(o, c);
      this.grad = g; this.h = v.h; this.ctx = ctx;
    }
    ctx.fillStyle = this.grad;
    ctx.fillRect(0, 0, v.w, v.h);
  }
}

export function makeStars(n, seed) {
  const r = mulberry32(seed);
  const s = [];
  for (let i = 0; i < n; i++) s.push({ x: r() * 2400, y: r() * 1.0, a: 0.3 + r() * 0.7, sz: r() < 0.1 ? 2.2 : 1.1, tw: r() * 6, sp: 0.5 + r() * 2 });
  return s;
}

export function drawStars(ctx, v, stars, factor, color = '#fff', yRange = 0.7) {
  const off = v.camX * factor;
  ctx.fillStyle = color;
  for (const s of stars) {
    let x = (s.x - off) % 2400;
    if (x < 0) x += 2400;
    if (x > v.w) continue;
    const a = s.a * (0.55 + 0.45 * Math.sin(v.t * s.sp + s.tw));
    ctx.globalAlpha = a;
    const y = s.y * v.h * yRange + v.gShift * 4;
    ctx.fillRect(x, y, s.sz, s.sz);
  }
  ctx.globalAlpha = 1;
}

export function cloudSprite(scale, w, h, color, seed) {
  const r = mulberry32(seed);
  return makeSprite(w, h, w / 2, h / 2, scale, (ctx) => {
    for (let i = 0; i < 9; i++) {
      const x = w * (0.2 + r() * 0.6), y = h * (0.35 + r() * 0.35), rad = h * (0.2 + r() * 0.25);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba(color, 0.5));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  });
}

export function moonSprite(scale, R, body, halo, craters = true, seed = 7) {
  const W = R * 3.2;
  return makeSprite(W, W, W / 2, W / 2, scale, (ctx) => {
    const c = W / 2;
    const h = ctx.createRadialGradient(c, c, R * 0.8, c, c, W / 2);
    h.addColorStop(0, rgba(halo, 0.35));
    h.addColorStop(1, rgba(halo, 0));
    ctx.fillStyle = h;
    ctx.fillRect(0, 0, W, W);
    const g = ctx.createRadialGradient(c - R * 0.3, c - R * 0.3, R * 0.1, c, c, R);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, body);
    g.addColorStop(1, rgba(body, 0.85));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.fill();
    if (craters) {
      const r = mulberry32(seed);
      ctx.save();
      ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.clip();
      for (let i = 0; i < 14; i++) {
        const a = r() * TAU, d = r() * R * 0.85, cr = R * (0.04 + r() * 0.14);
        ctx.fillStyle = `rgba(90,70,140,${0.06 + r() * 0.1})`;
        ctx.beginPath(); ctx.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, cr, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  });
}

/** Horizontal fog bands that separate the playfield from the backdrop. */
export function drawFog(ctx, v, color, strength = 1) {
  const top = -v.camY, bot = 540 - v.camY;
  let g = ctx.createLinearGradient(0, bot - 140, 0, bot + 60);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, 0.55 * strength));
  ctx.fillStyle = g;
  ctx.fillRect(0, bot - 140, v.w, 200);
  g = ctx.createLinearGradient(0, top + 140, 0, top - 60);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, 0.45 * strength));
  ctx.fillStyle = g;
  ctx.fillRect(0, top - 60, v.w, 200);
  // Beyond the playfield: the dream dissolves into void.
  if (top > 0) {
    ctx.fillStyle = rgba(color, 0.6 * strength);
    ctx.fillRect(0, 0, v.w, top - 60);
  }
  if (bot + 60 < v.h) {
    ctx.fillStyle = rgba(color, 0.6 * strength);
    ctx.fillRect(0, bot + 60, v.w, v.h - bot - 60);
  }
}

/** Soft fast-moving foreground bokeh motes for depth. */
export function drawBokeh(ctx, v, sprites, color, seed, alpha = 0.1) {
  const gs = sprites.glow(color);
  ctx.globalCompositeOperation = 'lighter';
  slots(v, 1.6, 380, seed, (x, r) => {
    if (r() < 0.45) return;
    const y = r() * v.h + Math.sin(v.t * 0.4 + r() * 6) * 20 + v.gShift * 30;
    const s = 60 + r() * 90;
    ctx.globalAlpha = alpha * (0.4 + r() * 0.6);
    ctx.drawImage(gs.c, x - s / 2, y - s / 2, s, s);
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
