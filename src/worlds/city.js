// World 1 — Drift City: a floating dream city with an upside-down twin
// hanging from the sky, islands of rooftops and a giant violet moon.
import { mulberry32, clamp, easeInOutSine, rgba, lerp, TAU } from '../engine/math.js';
import { makeSprite } from '../render/sprites.js';
import { slots, bgY, SkyCache, makeStars, drawStars, cloudSprite, moonSprite, drawFog, drawBokeh } from './common.js';

const WIN = ['#ffd27f', '#7ff3ff', '#ff9ad5', '#fff1c1'];

function buildingSprite(scale, rng, body, lit, winAlpha) {
  const w = 50 + rng() * 90, h = 160 + rng() * 300;
  const roof = rng();
  const tilt = rng() < 0.25;
  return makeSprite(w + 40, h + 90, (w + 40) / 2, h + 90, scale, (ctx) => {
    const x0 = 20, y0 = 90;
    ctx.fillStyle = body;
    ctx.fillRect(x0, y0, w, h);
    // roof features
    ctx.beginPath();
    if (roof < 0.3) { ctx.arc(x0 + w / 2, y0, w * 0.35, Math.PI, 0); }
    else if (roof < 0.55) { ctx.moveTo(x0 + w * 0.2, y0); ctx.lineTo(x0 + w / 2, y0 - 70 * rng() - 20); ctx.lineTo(x0 + w * 0.8, y0); }
    else if (roof < 0.75) { ctx.rect(x0 + w * 0.3, y0 - 30, w * 0.4, 30); ctx.rect(x0 + w * 0.48, y0 - 80, 3, 50); }
    else { ctx.rect(x0 + w * 0.1, y0 - 14, w * 0.8, 14); }
    ctx.fill();
    // windows
    const cols = Math.max(2, Math.floor(w / 14)), rows = Math.floor(h / 20);
    const cw = w / cols;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng() > lit) continue;
        ctx.globalAlpha = winAlpha * (0.4 + rng() * 0.6);
        ctx.fillStyle = WIN[Math.floor(rng() * (rng() < 0.7 ? 1 : 4))];
        ctx.fillRect(x0 + c * cw + cw * 0.3, y0 + 10 + r * 20, cw * 0.4, 8);
      }
    }
    ctx.globalAlpha = 1;
    if (tilt) {
      // a broken, floating top slab — impossible architecture
      ctx.fillStyle = body;
      ctx.save();
      ctx.translate(x0 + w / 2, y0 - 40);
      ctx.rotate((rng() - 0.5) * 0.5);
      ctx.fillRect(-w * 0.45, -30, w * 0.9, 26);
      ctx.restore();
    }
  });
}

function islandSprite(scale, rng) {
  const w = 120 + rng() * 120;
  const h = 150;
  return makeSprite(w + 20, h + 120, (w + 20) / 2, 120, scale, (ctx) => {
    const top = 120, x0 = 10;
    // rock underside
    const g = ctx.createLinearGradient(0, top, 0, top + h);
    g.addColorStop(0, '#3b2a6b'); g.addColorStop(1, 'rgba(40,20,70,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0, top);
    const n = 7;
    for (let i = 1; i < n; i++) ctx.lineTo(x0 + (w * i) / n, top + 20 + rng() * h * (1 - Math.abs(i / n - 0.5) * 1.6));
    ctx.lineTo(x0 + w, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4c3a86';
    ctx.fillRect(x0, top - 4, w, 8);
    // little houses
    const houses = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < houses; k++) {
      const hw = 26 + rng() * 26, hh = 26 + rng() * 40;
      const hx = x0 + 10 + rng() * (w - hw - 20);
      ctx.fillStyle = '#2b1f55';
      ctx.fillRect(hx, top - hh, hw, hh);
      ctx.beginPath(); ctx.moveTo(hx - 4, top - hh); ctx.lineTo(hx + hw / 2, top - hh - 18); ctx.lineTo(hx + hw + 4, top - hh); ctx.fill();
      ctx.fillStyle = rng() < 0.5 ? '#ffd27f' : '#7ff3ff';
      ctx.fillRect(hx + hw * 0.35, top - hh * 0.65, hw * 0.3, hh * 0.3);
    }
    // a lamp tree
    ctx.strokeStyle = '#2b1f55'; ctx.lineWidth = 3;
    const tx = x0 + w * (0.1 + rng() * 0.8);
    ctx.beginPath(); ctx.moveTo(tx, top); ctx.lineTo(tx, top - 50); ctx.stroke();
    ctx.fillStyle = '#ffd27f';
    ctx.beginPath(); ctx.arc(tx, top - 52, 4, 0, TAU); ctx.fill();
  });
}

function stairsSprite(scale, rng) {
  return makeSprite(260, 220, 130, 110, scale, (ctx) => {
    // an impossible staircase: steps climbing around a square loop
    const s = 16;
    const face = '#3d2e78', top = '#6a57b8', side = '#241a4c';
    const drawStep = (x, y) => {
      ctx.fillStyle = side; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = top; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y - 6); ctx.lineTo(x + s + 8, y - 6); ctx.lineTo(x + s, y); ctx.fill();
      ctx.fillStyle = face; ctx.beginPath(); ctx.moveTo(x + s, y); ctx.lineTo(x + s + 8, y - 6); ctx.lineTo(x + s + 8, y + s - 6); ctx.lineTo(x + s, y + s); ctx.fill();
    };
    let x = 40, y = 170;
    for (let i = 0; i < 7; i++) { drawStep(x, y); x += s; y -= 10; }
    for (let i = 0; i < 5; i++) { drawStep(x, y); x += 4; y -= 14; }
    for (let i = 0; i < 7; i++) { drawStep(x, y); x -= s; y -= 4; }
    for (let i = 0; i < 5; i++) { drawStep(x, y); x -= 2; y += 16; }
  });
}

export class CityTheme {
  constructor() {
    this.id = 'city';
    this.name = 'Drift City';
    this.pal = {
      fog: '#261041', haze: '#3b1d63', solidTop: '#1a1238', solidBot: '#07051a', edge: '#8ff6ff', edgeGlow: '#35c2ff',
      alt: '#2d2160', altEdge: '#ffd27f', accent: '#8ff6ff', accent2: '#ff9ad5', mote: '#c6f7ff',
      detail: '#ffd27f', phaseA: '#8ff6ff', phaseB: '#ff9ad5', vignette: '#07031a', tintUp: '#5a2cff',
    };
    this.music = 'city';
    this.sky = new SkyCache([[0, '#04031a'], [0.4, '#170d38'], [0.72, '#4c1f5e'], [1, '#9c3f6c']]);
    this.stars = makeStars(170, 11);
    this.state = { moon: null, spin: null };
  }

  build(scale, sprites) {
    this.sprites = sprites;
    const bs = Math.min(scale, 1.5) * 0.9; // backgrounds a touch softer
    const r = mulberry32(99);
    this.far = [], this.hang = [];
    for (let i = 0; i < 8; i++) this.far.push(buildingSprite(bs, r, '#1a1038', 0.25, 0.5));
    for (let i = 0; i < 8; i++) this.hang.push(buildingSprite(bs, r, '#140c2e', 0.2, 0.35));
    this.mid = [];
    for (let i = 0; i < 8; i++) this.mid.push(buildingSprite(bs, r, '#231650', 0.35, 0.8));
    this.islands = [];
    for (let i = 0; i < 4; i++) this.islands.push(islandSprite(bs, r));
    this.stairs = stairsSprite(bs, r);
    this.cloud = [cloudSprite(bs, 420, 150, '#8a4f9e', 3), cloudSprite(bs, 360, 120, '#6b3f9a', 5)];
    this.moon = moonSprite(Math.min(scale, 1.2), 150, '#e9dcff', '#b58cff', true, 5);
  }

  onSetpiece(ev, v) {
    if (ev.type === 'moonrise') this.state.moon = { start: v.t };
    if (ev.type === 'cityspin') this.state.spin = { start: v.t };
  }

  reset() { this.state = { moon: null, spin: null }; }

  drawBack(ctx, v) {
    this.sky.draw(ctx, v);
    drawStars(ctx, v, this.stars, 0.02, '#fff', 0.75);

    // The moon — rises during the "moonrise" set piece.
    const m = this.state.moon;
    let mp = 1;
    if (m) mp = easeInOutSine(clamp((v.t - m.start) / 12, 0, 1));
    const mx = lerp(v.w * 0.86, v.w * 0.64, mp) - (v.camX * 0.004) % 60;
    const my = lerp(v.h * 1.05, v.h * 0.3, mp) + v.gShift * 10;
    const pulse = 1 + v.pulse * 0.04;
    ctx.drawImage(this.moon.c, mx - this.moon.ox * pulse, my - this.moon.oy * pulse, this.moon.w * pulse, this.moon.h * pulse);

    // Rotating city wheel set piece.
    const sp = this.state.spin;
    if (sp) {
      const a = clamp((v.t - sp.start) / 2.5, 0, 1);
      const cx = v.w * 0.55, cy = bgY(v, 330, 0.1, 0.4);
      ctx.save();
      ctx.globalAlpha = 0.75 * a;
      ctx.translate(cx, cy);
      ctx.rotate(v.t * 0.12 + v.gShift * 0.2);
      ctx.fillStyle = '#1a1038';
      ctx.beginPath(); ctx.arc(0, 0, 150, 0, TAU); ctx.fill();
      for (let i = 0; i < 18; i++) {
        const s = this.far[i % this.far.length];
        ctx.save();
        ctx.rotate((i / 18) * TAU);
        ctx.drawImage(s.c, -s.ox * 0.5, -150 - s.h * 0.5 + 10, s.w * 0.5, s.h * 0.5);
        ctx.restore();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // Upside-down city hanging from the sky.
    slots(v, 0.08, 110, 21, (x, r) => {
      if (r() < 0.25) return;
      const s = this.hang[Math.floor(r() * this.hang.length)];
      const y = bgY(v, -120 + r() * 60, 0.3, 0.6);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(0.8, -0.8);
      ctx.drawImage(s.c, -s.ox, -s.oy, s.w, s.h);
      ctx.restore();
    });

    // Far skyline.
    slots(v, 0.14, 95, 33, (x, r) => {
      if (r() < 0.2) return;
      const s = this.far[Math.floor(r() * this.far.length)];
      const y = bgY(v, 640 + r() * 80, 0.3, 0.8);
      const k = 0.8 + r() * 0.3;
      const tilt = r() < 0.15 ? (r() - 0.5) * 0.3 : 0;
      ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(k, k);
      ctx.drawImage(s.c, -s.ox, -s.oy, s.w, s.h);
      ctx.restore();
    });

    // Clouds that stretch when gravity flips.
    ctx.globalCompositeOperation = 'lighter';
    slots(v, 0.22, 520, 44, (x, r) => {
      const c = this.cloud[Math.floor(r() * 2)];
      const y = bgY(v, 120 + r() * 320, 0.4, 1.4) + Math.sin(v.t * 0.2 + r() * 6) * 10;
      const st = 1 + v.pulse * 0.35;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(c.c, x - c.ox, y - c.oy * st, c.w, c.h * st);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Atmospheric perspective: everything behind the playfield sits in haze.
    ctx.fillStyle = rgba(this.pal.haze, 0.3);
    ctx.fillRect(0, 0, v.w, v.h);

    // Mid layer: nearer towers, floating islands, impossible stairs.
    slots(v, 0.3, 170, 55, (x, r) => {
      const kind = r();
      if (kind < 0.42) {
        const s = this.mid[Math.floor(r() * this.mid.length)];
        const inv = r() < 0.4;
        const y = inv ? bgY(v, -80 - r() * 60, 0.5, 1.8) : bgY(v, 700 + r() * 90, 0.5, 1.8);
        ctx.save(); ctx.translate(x, y); ctx.scale(0.9, inv ? -0.9 : 0.9);
        ctx.drawImage(s.c, -s.ox, -s.oy, s.w, s.h);
        ctx.restore();
      } else if (kind < 0.72) {
        const s = this.islands[Math.floor(r() * this.islands.length)];
        const y = bgY(v, 140 + r() * 300, 0.5, 2.2) + Math.sin(v.t * 0.6 + r() * 6) * 8;
        const inv = r() < 0.3;
        ctx.save(); ctx.translate(x, y); ctx.scale(0.7, inv ? -0.7 : 0.7);
        ctx.drawImage(s.c, -s.ox, -s.oy, s.w, s.h);
        ctx.restore();
      } else if (kind < 0.8) {
        const y = bgY(v, 200 + r() * 200, 0.5, 2.2) + Math.sin(v.t * 0.5 + r() * 6) * 10;
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(v.t * 0.1 + r() * 6) * 0.2 + (r() < 0.5 ? Math.PI : 0));
        ctx.globalAlpha = 0.8;
        ctx.drawImage(this.stairs.c, -this.stairs.ox, -this.stairs.oy, this.stairs.w, this.stairs.h);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    });

    ctx.fillStyle = rgba(this.pal.haze, 0.16);
    ctx.fillRect(0, 0, v.w, v.h);
    drawFog(ctx, v, this.pal.fog, 1);
  }

  drawFront(ctx, v) {
    drawBokeh(ctx, v, this.sprites, 'rgba(160,230,255,0.9)', 77, 0.07);
  }

  /** Lit windows inside solid city blocks. */
  tileDetail(ctx, x, y, h, t, alt) {
    if (alt) {
      ctx.fillStyle = 'rgba(255,210,127,0.18)';
      ctx.fillRect(x + 4, y + 10, 28, 3);
      return;
    }
    if ((h & 7) > 1) return;
    ctx.fillStyle = (h & 8) ? 'rgba(255,210,127,0.3)' : 'rgba(143,246,255,0.22)';
    const flick = (h >> 5) % 13 === 0 && Math.sin(t * 7 + h) > 0.6 ? 0.3 : 1;
    ctx.globalAlpha = flick;
    ctx.fillRect(x + 7 + (h >> 4 & 1) * 14, y + 9, 7, 9);
    if (h & 16) ctx.fillRect(x + 21 - (h >> 4 & 1) * 14, y + 21, 7, 9);
    ctx.globalAlpha = 1;
  }

  ambient(v, P, dt) {
    if (Math.random() > dt * 22) return;
    P.spawn({
      x: v.camX + v.w * (0.2 + Math.random()), y: v.camY + Math.random() * v.h,
      vx: -20 - Math.random() * 30, vy: 0, gravFollow: 40, drag: 0.4,
      life: 3 + Math.random() * 2, size: 2 + Math.random() * 2, color: this.pal.mote, add: true, alpha: 0.7,
    });
  }
}
