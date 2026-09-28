// World 2 — Moonlit Garden: giant blooms, floating stones with waterfalls
// that pour upward, fireflies, an aurora, and a ringed moon that sinks close.
import { mulberry32, clamp, easeInOutSine, rgba, lerp, TAU } from '../engine/math.js';
import { makeSprite } from '../render/sprites.js';
import { slots, bgY, SkyCache, makeStars, drawStars, drawFog, drawBokeh } from './common.js';

function flowerSprite(scale, rng, col, petalCol) {
  const H = 360 + rng() * 260;
  const R = 50 + rng() * 60;
  const petals = 5 + Math.floor(rng() * 4);
  const lean = (rng() - 0.5) * 120;
  const W = R * 3 + Math.abs(lean) * 2;
  return makeSprite(W, H + R * 1.6, W / 2, H + R * 1.6, scale, (ctx) => {
    const bx = W / 2, by = H + R * 1.6;
    const hx = bx + lean, hy = R * 1.3;
    ctx.strokeStyle = col;
    ctx.lineWidth = 7 + rng() * 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.bezierCurveTo(bx, by - H * 0.4, hx - lean * 0.2, hy + H * 0.4, hx, hy);
    ctx.stroke();
    // leaves
    ctx.fillStyle = col;
    for (let i = 0; i < 3; i++) {
      const k = 0.3 + i * 0.2;
      const lx = lerp(bx, hx, k), ly = lerp(by, hy, k);
      ctx.save(); ctx.translate(lx, ly); ctx.rotate((i % 2 ? 1 : -1) * 0.9);
      ctx.beginPath(); ctx.ellipse(i % 2 ? 24 : -24, 0, 30, 9, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // blossom
    ctx.save();
    ctx.translate(hx, hy);
    for (let i = 0; i < petals; i++) {
      ctx.save();
      ctx.rotate((i / petals) * TAU);
      const g = ctx.createLinearGradient(0, 0, 0, -R);
      g.addColorStop(0, col); g.addColorStop(1, petalCol);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, -R * 0.55, R * 0.32, R * 0.6, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = rgba('#fff3c4', 0.5);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.18, 0, TAU); ctx.fill();
    ctx.restore();
  });
}

function stoneSprite(scale, rng) {
  const w = 90 + rng() * 110, h = 70 + rng() * 60;
  return makeSprite(w + 20, h + 30, (w + 20) / 2, 20, scale, (ctx) => {
    const x0 = 10, top = 20;
    ctx.fillStyle = '#123a3a';
    ctx.beginPath();
    ctx.moveTo(x0, top);
    const n = 6;
    for (let i = 1; i < n; i++) ctx.lineTo(x0 + (w * i) / n, top + 10 + rng() * h);
    ctx.lineTo(x0 + w, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2e7a5e';
    ctx.beginPath(); ctx.ellipse(x0 + w / 2, top, w / 2 + 4, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6fe0a8';
    for (let i = 0; i < 6; i++) ctx.fillRect(x0 + rng() * w, top - 6 - rng() * 6, 2, 8);
  });
}

function planetSprite(scale) {
  const R = 120;
  const W = R * 4.4;
  return makeSprite(W, W, W / 2, W / 2, scale, (ctx) => {
    const c = W / 2;
    const halo = ctx.createRadialGradient(c, c, R * 0.9, c, c, W / 2);
    halo.addColorStop(0, 'rgba(180,255,230,0.3)');
    halo.addColorStop(1, 'rgba(180,255,230,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, W);
    // back half of ring
    ctx.save(); ctx.translate(c, c); ctx.rotate(-0.35);
    ctx.strokeStyle = 'rgba(220,255,240,0.35)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 1.9, R * 0.45, 0, Math.PI, TAU); ctx.stroke();
    ctx.restore();
    const g = ctx.createRadialGradient(c - R * 0.4, c - R * 0.4, 10, c, c, R);
    g.addColorStop(0, '#f2fff8'); g.addColorStop(0.7, '#9fd8cc'); g.addColorStop(1, '#5b9c98');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(c, c, R, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(40,110,110,0.18)';
    for (let i = 0; i < 5; i++) ctx.fillRect(c - R, c - R * 0.6 + i * R * 0.3, R * 2, R * 0.1);
    ctx.restore();
    ctx.save(); ctx.translate(c, c); ctx.rotate(-0.35);
    ctx.strokeStyle = 'rgba(230,255,245,0.6)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 1.9, R * 0.45, 0, 0, Math.PI); ctx.stroke();
    ctx.restore();
  });
}

export class GardenTheme {
  constructor() {
    this.id = 'garden';
    this.name = 'Moonlit Garden';
    this.pal = {
      fog: '#05222a', haze: '#0b3b44', solidTop: '#0e2c2c', solidBot: '#031212', edge: '#a6ffd6', edgeGlow: '#30e0a0',
      alt: '#15403a', altEdge: '#ffd9f0', accent: '#a6ffd6', accent2: '#ffd9f0', mote: '#d4ffe9',
      phaseA: '#c9a8ff', phaseB: '#7fe8ff', vignette: '#010809', tintUp: '#20ffc0',
    };
    this.music = 'garden';
    this.sky = new SkyCache([[0, '#020b13'], [0.45, '#062636'], [0.8, '#0e5458'], [1, '#3c9c84']]);
    this.stars = makeStars(140, 23);
    this.state = { bloom: null, lunar: null };
  }

  build(scale, sprites) {
    this.sprites = sprites;
    const bs = Math.min(scale, 1.5) * 0.9;
    const r = mulberry32(202);
    this.far = [];
    for (let i = 0; i < 6; i++) this.far.push(flowerSprite(bs * 0.8, r, '#0b2d33', '#1d5a5c'));
    this.mid = [];
    for (let i = 0; i < 6; i++) this.mid.push(flowerSprite(bs, r, '#0f3a3a', i % 2 ? '#4a8f9a' : '#7a5f9e'));
    this.stones = [];
    for (let i = 0; i < 4; i++) this.stones.push(stoneSprite(bs, r));
    this.planet = planetSprite(Math.min(scale, 1.2));
    this.bigBloom = flowerSprite(bs, mulberry32(5), '#12403e', '#c9a8ff');
  }

  reset() { this.state = { bloom: null, lunar: null }; }

  onSetpiece(ev, v) {
    if (ev.type === 'bloom') this.state.bloom = { start: v.t };
    if (ev.type === 'lunar') this.state.lunar = { start: v.t };
  }

  drawBack(ctx, v) {
    this.sky.draw(ctx, v);
    drawStars(ctx, v, this.stars, 0.02, '#e8fff6', 0.6);

    // Aurora ribbons
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 2; k++) {
      ctx.strokeStyle = k ? 'rgba(160,120,255,0.07)' : 'rgba(80,255,190,0.08)';
      ctx.lineWidth = 70 - k * 20;
      ctx.beginPath();
      for (let x = -20; x <= v.w + 20; x += 40) {
        const y = 70 + k * 50 + Math.sin(x * 0.004 + v.t * 0.25 + k * 2 - v.camX * 0.0004) * 40 + v.gShift * 6;
        if (x < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Ringed moon; sinks close during the "lunar" set piece.
    const L = this.state.lunar;
    const lp = L ? easeInOutSine(clamp((v.t - L.start) / 10, 0, 1)) : 0;
    const ps = lerp(0.8, 1.7, lp) * (1 + v.pulse * 0.03);
    const px = lerp(v.w * 0.72, v.w * 0.55, lp);
    const py = lerp(v.h * 0.25, v.h * 0.6, lp) + v.gShift * 12;
    const P = this.planet;
    ctx.drawImage(P.c, px - P.ox * ps, py - P.oy * ps, P.w * ps, P.h * ps);

    // Far flower forest (some grow down from the sky).
    slots(v, 0.09, 150, 31, (x, r) => {
      if (r() < 0.3) return;
      const s = this.far[Math.floor(r() * this.far.length)];
      const inv = r() < 0.35;
      const sway = Math.sin(v.t * 0.4 + r() * 6) * 0.04 + v.gShift * 0.03;
      ctx.save();
      ctx.translate(x, inv ? bgY(v, -120, 0.3, 0.6) : bgY(v, 700, 0.3, 0.6));
      ctx.rotate(sway);
      ctx.scale(0.9, inv ? -0.9 : 0.9);
      ctx.drawImage(s.c, -s.ox, -s.oy, s.w, s.h);
      ctx.restore();
    });

    ctx.fillStyle = rgba(this.pal.haze, 0.32);
    ctx.fillRect(0, 0, v.w, v.h);

    // The giant bloom set piece.
    const B = this.state.bloom;
    if (B) {
      const k = clamp((v.t - B.start) / 4, 0, 1);
      const e = easeInOutSine(k);
      ctx.save();
      ctx.translate(v.w * 0.6 - (v.camX - (B.cam ?? (B.cam = v.camX))) * 0.05, bgY(v, 260, 0.2, 1));
      ctx.globalCompositeOperation = 'lighter';
      const petals = 9;
      for (let i = 0; i < petals; i++) {
        ctx.save();
        ctx.rotate((i / petals) * TAU + v.t * 0.05);
        const open = lerp(0.1, 1, e);
        ctx.fillStyle = `rgba(${170 + i * 6},${140 + i * 8},255,${0.08 + e * 0.07})`;
        ctx.beginPath(); ctx.ellipse(0, -110 * open - 20, 44, 120 * open + 10, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 90);
      g.addColorStop(0, `rgba(255,245,200,${0.6 * e})`); g.addColorStop(1, 'rgba(255,245,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 90, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }

    // Mid layer: floating stones pouring water upward, and big flowers.
    slots(v, 0.28, 230, 57, (x, r) => {
      const kind = r();
      if (kind < 0.45) {
        const s = this.stones[Math.floor(r() * this.stones.length)];
        const y = bgY(v, 180 + r() * 260, 0.5, 2) + Math.sin(v.t * 0.7 + r() * 6) * 8;
        // Upward waterfall
        const wx = x + (r() - 0.5) * s.w * 0.4;
        const top = y - 700;
        const grad = ctx.createLinearGradient(0, top, 0, y);
        grad.addColorStop(0, 'rgba(160,255,230,0)');
        grad.addColorStop(1, 'rgba(160,255,230,0.25)');
        ctx.fillStyle = grad;
        ctx.fillRect(wx - 7, top, 14, y - top);
        ctx.fillStyle = 'rgba(220,255,245,0.45)';
        const off = (v.t * 160) % 40;
        for (let yy = y - off; yy > top; yy -= 40) ctx.fillRect(wx - 2 + Math.sin(yy * 0.05) * 2, yy, 2, 14);
        ctx.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h);
      } else if (kind < 0.8) {
        const s = this.mid[Math.floor(r() * this.mid.length)];
        const inv = r() < 0.4;
        const sway = Math.sin(v.t * 0.6 + r() * 6) * 0.05 + v.gShift * 0.05;
        ctx.save();
        ctx.translate(x, inv ? bgY(v, -60, 0.5, 1.6) : bgY(v, 640, 0.5, 1.6));
        ctx.rotate(sway * (inv ? -1 : 1));
        ctx.scale(0.75, inv ? -0.75 : 0.75);
        ctx.drawImage(s.c, -s.ox, -s.oy, s.w, s.h);
        ctx.restore();
      }
    });

    ctx.fillStyle = rgba(this.pal.haze, 0.14);
    ctx.fillRect(0, 0, v.w, v.h);
    drawFog(ctx, v, this.pal.fog, 1);
  }

  drawFront(ctx, v) {
    drawBokeh(ctx, v, this.sprites, 'rgba(160,255,210,0.9)', 91, 0.07);
  }

  /** Moss, grass blades and tiny glowing mushrooms on exposed surfaces. */
  tileDetail(ctx, x, y, h, t, alt, exp) {
    if (alt) {
      ctx.fillStyle = 'rgba(255,217,240,0.1)';
      ctx.fillRect(x + 2, y + 16, 32, 4);
    }
    if (!exp) {
      if ((h & 15) === 0) { ctx.fillStyle = 'rgba(120,255,200,0.12)'; ctx.fillRect(x + 12, y + 12, 5, 5); }
      return;
    }
    ctx.strokeStyle = 'rgba(120,240,180,0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const side of [1, 2]) {
      if (!(exp & side)) continue;
      const base = side === 1 ? y : y + 36;
      const dir = side === 1 ? -1 : 1;
      for (let i = 0; i < 4; i++) {
        const bx = x + 4 + i * 9 + ((h >> i) & 3);
        const len = 5 + ((h >> (i + 3)) & 7);
        const sway = Math.sin(t * 2 + bx * 0.1) * 2;
        ctx.moveTo(bx, base);
        ctx.quadraticCurveTo(bx + sway * 0.5, base + dir * len * 0.5, bx + sway, base + dir * len);
      }
    }
    ctx.stroke();
    if ((h & 31) === 3) {
      const side = exp & 1 ? 1 : 2;
      const base = side === 1 ? y : y + 36, dir = side === 1 ? -1 : 1;
      ctx.fillStyle = '#ffd9f0';
      ctx.beginPath(); ctx.ellipse(x + 20, base + dir * 7, 5, 3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,217,240,0.6)';
      ctx.fillRect(x + 19, base + (dir === -1 ? -6 : 0), 2, 6);
    }
  }

  ambient(v, P, dt) {
    // Fireflies that drift with gravity.
    if (Math.random() < dt * 14) {
      P.spawn({
        x: v.camX + v.w * (0.1 + Math.random() * 1.1), y: v.camY + Math.random() * v.h,
        vx: -10 - Math.random() * 20, vy: (Math.random() - 0.5) * 20, gravFollow: 30, drag: 0.6,
        life: 3 + Math.random() * 2, size: 5, size1: 2, color: '#d4ffb0', add: true, alpha: 0.8, shape: 'circle',
      });
    }
  }
}
