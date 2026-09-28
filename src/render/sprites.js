// Pre-rendered sprites. Everything is drawn procedurally once per render
// scale, then blitted — keeps per-frame cost low on phones.
import { TILE } from '../config.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/**
 * A sprite is authored in world units; it is rasterised at `scale` px/unit.
 * { c: canvas, w, h (world units), ox, oy (anchor in world units) }
 */
export function makeSprite(w, h, ox, oy, scale, draw) {
  const c = makeCanvas(w * scale, h * scale);
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  draw(ctx, w, h);
  return { c, w, h, ox, oy };
}

export function drawSprite(ctx, s, x, y, sx = 1, sy = 1, rot = 0) {
  if (rot === 0 && sx === 1 && sy === 1) {
    ctx.drawImage(s.c, x - s.ox, y - s.oy, s.w, s.h);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(sx, sy);
  ctx.drawImage(s.c, -s.ox, -s.oy, s.w, s.h);
  ctx.restore();
}

export const HAZARD = {
  core: '#2a0716',
  mid: '#b0124a',
  rim: '#ff4f8b',
  hot: '#ffd1e0',
  glow: 'rgba(255,60,120,',
};

function thorn(ctx, bx, by, w, h, bright = 1) {
  const g = ctx.createLinearGradient(bx, by, bx, by - h);
  g.addColorStop(0, HAZARD.core);
  g.addColorStop(0.55, HAZARD.mid);
  g.addColorStop(1, HAZARD.rim);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(bx - w / 2, by);
  ctx.quadraticCurveTo(bx - w * 0.12, by - h * 0.5, bx, by - h);
  ctx.quadraticCurveTo(bx + w * 0.12, by - h * 0.5, bx + w / 2, by);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = HAZARD.rim;
  ctx.globalAlpha = 0.9 * bright;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.globalAlpha = 1;
  // facet highlight
  ctx.fillStyle = 'rgba(255,220,235,0.55)';
  ctx.beginPath();
  ctx.moveTo(bx, by - h);
  ctx.quadraticCurveTo(bx - w * 0.05, by - h * 0.5, bx - w * 0.18, by - 2);
  ctx.lineTo(bx - w * 0.05, by - 2);
  ctx.closePath();
  ctx.fill();
}

export class SpriteBank {
  constructor() { this.scale = 0; this.s = {}; }

  build(scale) {
    if (Math.abs(scale - this.scale) < 0.01) return;
    this.scale = scale;
    const s = this.s;
    const P = 14; // glow padding
    // Spike bed tile, pointing up; other directions are rotated at draw time.
    s.spike = makeSprite(TILE + P * 2, TILE + P * 2, P, P, scale, (ctx) => {
      const glow = ctx.createRadialGradient(P + 18, P + 36, 2, P + 18, P + 30, 30);
      glow.addColorStop(0, HAZARD.glow + '0.45)');
      glow.addColorStop(1, HAZARD.glow + '0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, TILE + P * 2, TILE + P * 2);
      thorn(ctx, P + 6, P + 36, 11, 17, 0.7);
      thorn(ctx, P + 30, P + 36, 11, 20, 0.7);
      thorn(ctx, P + 18, P + 36, 16, 31);
      ctx.fillStyle = HAZARD.hot;
      ctx.beginPath(); ctx.arc(P + 18, P + 6, 1.6, 0, 6.3); ctx.fill();
    });
    // Thorn orb (the "nightmare seed").
    s.orb = makeSprite(64, 64, 32, 32, scale, (ctx) => {
      const glow = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
      glow.addColorStop(0, HAZARD.glow + '0.55)');
      glow.addColorStop(1, HAZARD.glow + '0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 64, 64);
      ctx.save();
      ctx.translate(32, 32);
      for (let i = 0; i < 9; i++) {
        ctx.save();
        ctx.rotate((i / 9) * Math.PI * 2);
        thorn(ctx, 0, -9, 8, 12, 0.8);
        ctx.restore();
      }
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 11);
      g.addColorStop(0, '#ff9dbd');
      g.addColorStop(0.5, HAZARD.mid);
      g.addColorStop(1, HAZARD.core);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.3); ctx.fill();
      ctx.strokeStyle = HAZARD.rim; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = HAZARD.hot;
      ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, 6.3); ctx.fill();
      ctx.restore();
    });
    // Dream fragment — a small pale-gold crystal.
    s.frag = makeSprite(40, 40, 20, 20, scale, (ctx) => {
      const glow = ctx.createRadialGradient(20, 20, 1, 20, 20, 20);
      glow.addColorStop(0, 'rgba(255,240,190,0.7)');
      glow.addColorStop(0.35, 'rgba(255,220,150,0.18)');
      glow.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 40, 40);
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath();
      ctx.moveTo(20, 11); ctx.lineTo(25, 20); ctx.lineTo(20, 29); ctx.lineTo(15, 20);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath(); ctx.moveTo(20, 11); ctx.lineTo(25, 20); ctx.lineTo(20, 20); ctx.closePath(); ctx.fill();
    });
    // Lucid star — the big optional prize.
    s.star = makeSprite(90, 90, 45, 45, scale, (ctx) => {
      const glow = ctx.createRadialGradient(45, 45, 2, 45, 45, 45);
      glow.addColorStop(0, 'rgba(255,236,160,0.85)');
      glow.addColorStop(0.3, 'rgba(255,200,90,0.3)');
      glow.addColorStop(1, 'rgba(255,200,90,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 90, 90);
      ctx.translate(45, 45);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 7.5 : 17;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -17, 0, 17);
      g.addColorStop(0, '#fffbe6'); g.addColorStop(1, '#ffc23d');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    });
    // Generic soft glow (white; tint with globalCompositeOperation='lighter').
    s.glow = makeSprite(128, 128, 64, 64, Math.min(scale, 1), (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    });
    this.tinted = {};
  }

  /** Coloured glow sprite (cached per colour). */
  glow(color) {
    let s = this.tinted[color];
    if (!s) {
      s = makeSprite(128, 128, 64, 64, Math.min(this.scale, 1), (ctx) => {
        const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
      });
      this.tinted[color] = s;
    }
    return s;
  }
}
