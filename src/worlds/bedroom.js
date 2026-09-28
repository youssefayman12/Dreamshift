// World 3 — Endless Bedroom: you've shrunk (or the room grew). Wallpaper
// skies, a colossal window and alarm clock, shelves of giant books, drifting
// toys — and a paper whale that swims through the night.
import { mulberry32, clamp, rgba, lerp, TAU, easeInOutSine } from '../engine/math.js';
import { makeSprite } from '../render/sprites.js';
import { slots, bgY, SkyCache, drawFog, drawBokeh } from './common.js';

const SPINES = ['#6b2a35', '#2c3a66', '#2e5a43', '#8a6a2a', '#5a3470', '#7a4a2a'];

function shelfSprite(scale, rng) {
  const w = 220 + rng() * 120, h = 520 + rng() * 200;
  return makeSprite(w, h, w / 2, h, scale, (ctx) => {
    ctx.fillStyle = '#2a1520';
    ctx.fillRect(0, 0, w, h);
    const shelves = Math.floor(h / 110);
    for (let s = 0; s < shelves; s++) {
      const y = 20 + s * 110;
      let x = 14;
      while (x < w - 20) {
        const bw = 10 + rng() * 14, bh = 60 + rng() * 34;
        ctx.fillStyle = rgba(SPINES[Math.floor(rng() * SPINES.length)], 0.32);
        if (rng() < 0.1) {
          ctx.save(); ctx.translate(x, y + 95); ctx.rotate(-0.25); ctx.fillRect(0, -bh, bw, bh); ctx.restore();
        } else ctx.fillRect(x, y + 95 - bh, bw, bh);
        x += bw + 1;
      }
      ctx.fillStyle = '#3a2029';
      ctx.fillRect(0, y + 95, w, 10);
    }
  });
}

function lampSprite(scale) {
  return makeSprite(360, 700, 180, 700, scale, (ctx) => {
    const cone = ctx.createLinearGradient(0, 120, 0, 700);
    cone.addColorStop(0, 'rgba(255,200,120,0.28)');
    cone.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = cone;
    ctx.beginPath(); ctx.moveTo(120, 120); ctx.lineTo(240, 120); ctx.lineTo(360, 700); ctx.lineTo(0, 700); ctx.fill();
    ctx.fillStyle = '#4a2a22';
    ctx.beginPath(); ctx.moveTo(110, 125); ctx.lineTo(250, 125); ctx.lineTo(215, 30); ctx.lineTo(145, 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,215,150,0.5)';
    ctx.fillRect(112, 118, 136, 7);
    ctx.fillStyle = '#2a1712';
    ctx.fillRect(175, 0, 10, 30);
  });
}

function blockSprite(scale, letter, col) {
  return makeSprite(60, 60, 30, 30, scale, (ctx) => {
    ctx.fillStyle = col;
    ctx.fillRect(6, 6, 48, 48);
    ctx.strokeStyle = 'rgba(255,240,210,0.5)'; ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 40, 40);
    ctx.fillStyle = 'rgba(255,240,210,0.75)';
    ctx.font = '900 30px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(letter, 30, 32);
  });
}

function planeSprite(scale) {
  return makeSprite(80, 40, 40, 20, scale, (ctx) => {
    ctx.fillStyle = 'rgba(255,245,230,0.75)';
    ctx.beginPath(); ctx.moveTo(78, 20); ctx.lineTo(4, 4); ctx.lineTo(24, 20); ctx.lineTo(4, 36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(200,180,170,0.8)';
    ctx.beginPath(); ctx.moveTo(78, 20); ctx.lineTo(24, 20); ctx.lineTo(30, 28); ctx.closePath(); ctx.fill();
  });
}

function whaleSprite(scale) {
  // An origami paper whale made of flat facets.
  return makeSprite(900, 360, 450, 180, scale, (ctx) => {
    const facets = [
      [[40, 180], [260, 60], [420, 170], '#e9dccf'],
      [[260, 60], [620, 40], [420, 170], '#f7efe6'],
      [[620, 40], [800, 150], [420, 170], '#d8c8ba'],
      [[40, 180], [420, 170], [330, 290], '#c9b7a8'],
      [[420, 170], [800, 150], [600, 280], '#bfae9f'],
      [[330, 290], [420, 170], [600, 280], '#d2c1b2'],
      [[800, 150], [880, 60], [860, 150], '#e9dccf'],
      [[800, 150], [890, 240], [860, 150], '#c9b7a8'],
      [[380, 250], [470, 350], [520, 260], '#b6a494'],
    ];
    for (const [a, b, c, col] of facets) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(90,70,60,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.fillStyle = '#3a2a24';
    ctx.beginPath(); ctx.arc(170, 150, 9, 0, TAU); ctx.fill();
  });
}

export class BedroomTheme {
  constructor() {
    this.id = 'bedroom';
    this.name = 'Endless Bedroom';
    this.pal = {
      fog: '#1a0c14', haze: '#3a1f2c', solidTop: '#2b1812', solidBot: '#110806', edge: '#ffdca6', edgeGlow: '#ff9f4a',
      alt: '#3d2519', altEdge: '#fff0c9', accent: '#ffdca6', accent2: '#ffb3c7', mote: '#ffe2b0',
      phaseA: '#c9a8ff', phaseB: '#7fe8ff', vignette: '#0b0306', tintUp: '#ff7a3c',
    };
    this.music = 'bedroom';
    this.sky = new SkyCache([[0, '#12070f'], [0.5, '#2a1422'], [0.85, '#4a2630'], [1, '#6a3a2e']]);
    this.state = { whale: null, shatter: null };
  }

  build(scale, sprites) {
    this.sprites = sprites;
    const bs = Math.min(scale, 1.5) * 0.9;
    const r = mulberry32(303);
    this.shelves = [];
    for (let i = 0; i < 4; i++) this.shelves.push(shelfSprite(bs, r));
    this.lamp = lampSprite(bs);
    this.blocks = ['A', 'Z', 'Z', 'D', 'R', 'E', 'M'].map((l, i) => blockSprite(bs, l, SPINES[i % SPINES.length]));
    this.plane = planeSprite(bs);
    this.whale = whaleSprite(Math.min(scale, 1.1));
    // Wallpaper tile
    this.paper = makeSprite(120, 120, 0, 0, Math.min(scale, 1), (ctx) => {
      ctx.fillStyle = 'rgba(255,210,170,0.06)';
      ctx.beginPath(); ctx.arc(30, 30, 8, 0.6, TAU - 0.6); ctx.arc(34, 30, 6, TAU - 0.9, 0.9, true); ctx.fill();
      for (const [x, y] of [[90, 40], [60, 95], [15, 85]]) {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 ? 2 : 5, a = (i / 10) * TAU;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.fill();
      }
    });
  }

  reset() { this.state = { whale: null, shatter: null }; }

  onSetpiece(ev, v) {
    if (ev.type === 'creature') this.state.whale = { start: v.t };
    if (ev.type === 'shatter') this.state.shatter = { start: v.t };
  }

  drawBack(ctx, v) {
    this.sky.draw(ctx, v);
    const sh = this.state.shatter;
    const shk = sh ? easeInOutSine(clamp((v.t - sh.start) / 3, 0, 1)) : 0;

    // Beyond the wall (visible once the room shatters): a starry void.
    if (shk > 0) {
      ctx.fillStyle = '#070312';
      ctx.globalAlpha = shk;
      ctx.fillRect(0, 0, v.w, v.h);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 90; i++) {
        const x = ((i * 137.5 - v.camX * 0.02) % v.w + v.w) % v.w, y = (i * 71.3) % v.h;
        ctx.globalAlpha = shk * (0.3 + (i % 5) * 0.12);
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }

    // Wallpaper (breaks into drifting panels during the shatter).
    const off = (v.camX * 0.05) % 120;
    const panel = 240;
    for (let px = -panel; px < v.w + panel; px += panel) {
      for (let py = -panel; py < v.h + panel; py += panel) {
        ctx.save();
        if (shk > 0) {
          const seed = Math.sin(px * 12.9 + py * 78.2) * 43758.5;
          const rnd = seed - Math.floor(seed);
          ctx.translate(px + panel / 2, py + panel / 2);
          ctx.rotate((rnd - 0.5) * shk * 0.8 + Math.sin(v.t * 0.5 + rnd * 6) * 0.05 * shk);
          ctx.translate((rnd - 0.5) * 80 * shk, (rnd - 0.5) * 120 * shk + v.gShift * 10 * shk);
          const s = 1 - shk * 0.25;
          ctx.scale(s, s);
          ctx.translate(-panel / 2, -panel / 2);
        } else ctx.translate(px, py);
        ctx.fillStyle = '#2a1422';
        ctx.globalAlpha = shk > 0 ? 0.95 : 0;
        if (shk > 0) ctx.fillRect(2, 2, panel - 4, panel - 4);
        ctx.globalAlpha = 1;
        for (let tx = -off; tx < panel; tx += 120) for (let ty = 0; ty < panel; ty += 120) {
          ctx.drawImage(this.paper.c, tx, ty, 120, 120);
        }
        ctx.restore();
      }
    }

    // The colossal window with the real night outside.
    const wx = v.w * 0.7 - ((v.camX * 0.03) % (v.w * 1.6)), wy = bgY(v, 40, 0.1, 0.5);
    for (const ox of [wx, wx + v.w * 1.6]) {
      if (ox < -400 || ox > v.w + 400) continue;
      ctx.fillStyle = '#0d1030';
      ctx.fillRect(ox - 170, wy, 340, 400);
      ctx.fillStyle = '#fff6dc';
      ctx.beginPath(); ctx.arc(ox + 60, wy + 110, 40, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0d1030';
      ctx.beginPath(); ctx.arc(ox + 76, wy + 98, 36, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3a2029'; ctx.lineWidth = 18;
      ctx.strokeRect(ox - 170, wy, 340, 400);
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(ox, wy); ctx.lineTo(ox, wy + 400); ctx.moveTo(ox - 170, wy + 200); ctx.lineTo(ox + 170, wy + 200); ctx.stroke();
      // curtains
      ctx.fillStyle = 'rgba(110,40,60,0.8)';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        const cx = ox + side * 200;
        ctx.moveTo(cx - 40, wy - 30);
        for (let y = 0; y <= 480; y += 40) ctx.lineTo(cx + Math.sin(y * 0.05 + v.t + side) * 10 + (side === -1 ? 30 : -30), wy - 30 + y);
        ctx.lineTo(cx + side * 40, wy + 450);
        ctx.lineTo(cx + side * 40, wy - 30);
        ctx.fill();
      }
    }

    // Paper whale set piece swimming through the room.
    const W = this.state.whale;
    if (W) {
      const k = (v.t - W.start) / 14;
      if (k < 1) {
        const x = lerp(v.w + 500, -600, k);
        const y = bgY(v, 180, 0.2, 1) + Math.sin(k * 10) * 30;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(k * 10 + 1) * 0.06);
        ctx.globalAlpha = 0.55 * Math.min(1, k * 8, (1 - k) * 8);
        ctx.drawImage(this.whale.c, -this.whale.ox, -this.whale.oy, this.whale.w, this.whale.h);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    // Giant alarm clock whose hands follow dream time.
    slots(v, 0.1, 900, 71, (x, r) => {
      if (r() < 0.4) return;
      const y = bgY(v, 170 + r() * 80, 0.25, 0.8);
      const R = 110;
      ctx.fillStyle = '#3a1f28';
      ctx.beginPath(); ctx.arc(x - 70, y - 100, 36, 0, TAU); ctx.arc(x + 70, y - 100, 36, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, R + 14, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8d6bd';
      ctx.globalAlpha = 0.18;
      ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,230,200,0.45)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.85, y + Math.sin(a) * R * 0.85); ctx.lineTo(x + Math.cos(a) * R * 0.95, y + Math.sin(a) * R * 0.95); ctx.stroke();
      }
      const spin = sh ? 8 : 1;
      const ha = v.t * 0.05 * spin + v.gShift * 0.3, ma = v.t * 0.6 * spin;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(ha) * R * 0.5, y - Math.cos(ha) * R * 0.5); ctx.stroke();
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(ma) * R * 0.8, y - Math.cos(ma) * R * 0.8); ctx.stroke();
    });

    // Furniture skyline: shelves (some hanging upside down) and lamps.
    slots(v, 0.16, 360, 83, (x, r) => {
      const k = r();
      if (k < 0.55) {
        const s = this.shelves[Math.floor(r() * this.shelves.length)];
        const inv = r() < 0.35;
        ctx.save();
        ctx.translate(x, inv ? bgY(v, -140, 0.3, 1) : bgY(v, 720, 0.3, 1));
        ctx.scale(0.8, inv ? -0.8 : 0.8);
        ctx.drawImage(s.c, -s.ox, -s.oy, s.w, s.h);
        ctx.restore();
      } else if (k < 0.75) {
        ctx.globalCompositeOperation = 'lighter';
        const L = this.lamp;
        ctx.drawImage(L.c, x - L.ox * 0.8, bgY(v, -40, 0.3, 1), L.w * 0.8, L.h * 0.8);
        ctx.globalCompositeOperation = 'source-over';
      }
    });

    ctx.fillStyle = rgba(this.pal.haze, 0.4);
    ctx.fillRect(0, 0, v.w, v.h);

    // Drifting toys: letter blocks and paper planes.
    slots(v, 0.35, 260, 97, (x, r) => {
      const k = r();
      const y = bgY(v, 60 + r() * 420, 0.5, 2.4) + Math.sin(v.t * 0.8 + r() * 6) * 12;
      if (k < 0.4) {
        const b = this.blocks[Math.floor(r() * this.blocks.length)];
        const rot = v.t * (r() - 0.5) * 0.8 + r() * 6;
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = 0.7;
        ctx.drawImage(b.c, -b.ox, -b.oy, b.w, b.h);
        ctx.restore(); ctx.globalAlpha = 1;
      } else if (k < 0.65) {
        const drift = ((v.t * 40 + r() * 400) % 800) - 400;
        ctx.save(); ctx.translate(x + drift, y + Math.sin(v.t + k * 9) * 20); ctx.rotate(Math.sin(v.t * 0.9 + k * 7) * 0.2 - v.gShift * 0.1);
        ctx.globalAlpha = 0.6;
        ctx.drawImage(this.plane.c, -this.plane.ox, -this.plane.oy, this.plane.w, this.plane.h);
        ctx.restore(); ctx.globalAlpha = 1;
      }
    });

    ctx.fillStyle = rgba(this.pal.haze, 0.12);
    ctx.fillRect(0, 0, v.w, v.h);
    drawFog(ctx, v, this.pal.fog, 1);
  }

  drawFront(ctx, v) {
    drawBokeh(ctx, v, this.sprites, 'rgba(255,200,140,0.9)', 131, 0.08);
  }

  /** Solids are made of giant books: spines, bands and titles. */
  tileDetail(ctx, x, y, h, t, alt, exp) {
    const c1 = SPINES[h % SPINES.length];
    if (alt) {
      ctx.fillStyle = rgba('#fff0c9', 0.12);
      ctx.fillRect(x, y + 6, 36, 3);
      ctx.fillRect(x, y + 27, 36, 3);
      return;
    }
    if (!exp && (h & 3)) return;
    ctx.fillStyle = rgba(c1, 0.55);
    const w1 = 10 + (h >> 3 & 7);
    ctx.fillRect(x + 1, y + 1, w1, 34);
    ctx.fillStyle = rgba(SPINES[(h >>> 6) % SPINES.length], 0.5);
    ctx.fillRect(x + w1 + 2, y + 1, 33 - w1 - 2, 34);
    ctx.fillStyle = 'rgba(255,220,160,0.25)';
    ctx.fillRect(x + 1, y + 8, w1, 2);
    ctx.fillRect(x + 1, y + 26, w1, 2);
  }

  kinDetail(ctx, k, R) {
    if (k.kind === 'mover') {
      // hardcover book: page block and cover
      ctx.fillStyle = '#f0e2c6';
      ctx.fillRect(R.x + 4, R.y + 6, R.w - 8, R.h - 12);
      ctx.fillStyle = 'rgba(120,90,60,0.35)';
      for (let yy = R.y + 9; yy < R.y + R.h - 6; yy += 4) ctx.fillRect(R.x + 4, yy, R.w - 8, 1);
      ctx.fillStyle = SPINES[k.id % SPINES.length];
      ctx.fillRect(R.x, R.y, 8, R.h);
    } else if (k.kind === 'pillar') {
      for (let yy = R.y, i = 0; yy < R.y + R.h; yy += 12, i++) {
        ctx.fillStyle = rgba(SPINES[(k.id + i) % SPINES.length], 0.8);
        ctx.fillRect(R.x + (i % 2 ? 2 : -2), yy, R.w, Math.min(11, R.y + R.h - yy));
      }
    }
  }

  ambient(v, P, dt) {
    if (Math.random() < dt * 16) {
      P.spawn({
        x: v.camX + v.w * (0.1 + Math.random() * 1.1), y: v.camY + Math.random() * v.h,
        vx: -15 - Math.random() * 20, vy: 0, gravFollow: 25, drag: 0.5,
        life: 3 + Math.random() * 2, size: 2.5, color: this.pal.mote, add: true, alpha: 0.6,
      });
    }
  }
}
