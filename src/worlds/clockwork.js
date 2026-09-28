// World 4 — Clockwork Nightmare: colossal gears, melting clock faces, swinging
// pendulums and embers. Unsettling, never gory. Ends by fracturing into void.
import { mulberry32, clamp, rgba, lerp, TAU, easeInOutSine } from '../engine/math.js';
import { makeSprite } from '../render/sprites.js';
import { slots, bgY, SkyCache, drawFog, drawBokeh } from './common.js';

function gearSprite(scale, R, teeth, col, hole = true) {
  const W = R * 2 + 40;
  return makeSprite(W, W, W / 2, W / 2, scale, (ctx) => {
    ctx.translate(W / 2, W / 2);
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * TAU, a1 = ((i + 0.5) / teeth) * TAU;
      const ro = R + 16, ri = R;
      ctx.lineTo(Math.cos(a0) * ri, Math.sin(a0) * ri);
      ctx.lineTo(Math.cos(a0 + 0.05) * ro, Math.sin(a0 + 0.05) * ro);
      ctx.lineTo(Math.cos(a1 - 0.05) * ro, Math.sin(a1 - 0.05) * ro);
      ctx.lineTo(Math.cos(a1) * ri, Math.sin(a1) * ri);
    }
    ctx.closePath();
    ctx.fill();
    if (hole) {
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55, R * 0.22, 0, TAU); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(0, 0, R * 0.12, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  });
}

function meltingClock(scale, rng) {
  return makeSprite(300, 340, 150, 150, scale, (ctx) => {
    ctx.translate(150, 150);
    ctx.fillStyle = '#3a1c10';
    ctx.beginPath();
    ctx.ellipse(0, 0, 120, 100, -0.2, 0, TAU);
    ctx.fill();
    // drip
    ctx.beginPath();
    ctx.moveTo(-40, 80); ctx.quadraticCurveTo(-30, 180, 10, 175); ctx.quadraticCurveTo(30, 170, 40, 80); ctx.fill();
    ctx.fillStyle = '#6b3a1c';
    ctx.beginPath(); ctx.ellipse(0, 0, 100, 82, -0.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,110,0.45)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 80, Math.sin(a) * 64);
      ctx.lineTo(Math.cos(a) * 92, Math.sin(a) * 74);
      ctx.stroke();
    }
  });
}

export class ClockworkTheme {
  constructor() {
    this.id = 'clockwork';
    this.name = 'Clockwork Nightmare';
    this.pal = {
      fog: '#170804', haze: '#2e140a', solidTop: '#221612', solidBot: '#0c0605', edge: '#ffbf5e', edgeGlow: '#ff8a2a',
      alt: '#33201a', altEdge: '#ffe0a8', accent: '#ffbf5e', accent2: '#ff8a5c', mote: '#ffb06a',
      phaseA: '#c9a8ff', phaseB: '#7fe8ff', vignette: '#080201', tintUp: '#ff6a2a',
    };
    this.music = 'clockwork';
    this.sky = new SkyCache([[0, '#080403'], [0.45, '#1c0c07'], [0.8, '#44200e'], [1, '#7a3f18']]);
    this.state = { rapid: null, fracture: null, wake: null };
  }

  build(scale, sprites) {
    this.sprites = sprites;
    const bs = Math.min(scale, 1.4) * 0.9;
    this.gearsFar = [gearSprite(bs, 180, 22, '#2a150b'), gearSprite(bs, 120, 16, '#2e170c')];
    this.gearsMid = [gearSprite(bs, 90, 12, '#3a1d0e'), gearSprite(bs, 60, 10, '#422210'), gearSprite(bs, 130, 18, '#381b0d')];
    this.clock = meltingClock(bs, mulberry32(4));
  }

  reset() { this.state = { rapid: null, fracture: null, wake: null }; }

  onSetpiece(ev, v) {
    if (ev.type in this.state) this.state[ev.type] = { start: v.t };
  }

  drawBack(ctx, v) {
    this.sky.draw(ctx, v);
    const fr = this.state.fracture;
    const fk = fr ? easeInOutSine(clamp((v.t - fr.start) / 3, 0, 1)) : 0;
    const rapid = this.state.rapid;
    const tempo = rapid ? 1 + clamp((v.t - rapid.start) / 4, 0, 1) * 2 : 1;

    // Far gears: enormous and slow (they tear apart during the fracture).
    slots(v, 0.06, 520, 41, (x, r) => {
      const s = this.gearsFar[Math.floor(r() * 2)];
      const y = bgY(v, r() < 0.5 ? -40 + r() * 80 : 520 + r() * 100, 0.2, 0.6);
      const dir = r() < 0.5 ? 1 : -1;
      ctx.save();
      ctx.translate(x + (r() - 0.5) * fk * 160, y + (r() - 0.5) * fk * 200);
      ctx.rotate(v.t * 0.05 * dir * tempo + v.gShift * 0.15 * dir + fk * (r() - 0.5) * 2);
      ctx.drawImage(s.c, -s.ox, -s.oy, s.w, s.h);
      ctx.restore();
    });

    // Melting clocks with hands that don't agree on the time.
    slots(v, 0.12, 700, 53, (x, r) => {
      if (r() < 0.35) return;
      const y = bgY(v, 120 + r() * 220, 0.3, 0.8);
      const c = this.clock;
      const tilt = (r() - 0.5) * 0.6 + fk * (r() - 0.5);
      ctx.save();
      ctx.translate(x, y + fk * (r() - 0.3) * 160);
      ctx.rotate(tilt);
      ctx.drawImage(c.c, -c.ox, -c.oy, c.w, c.h);
      ctx.strokeStyle = 'rgba(255,200,130,0.6)';
      ctx.lineCap = 'round';
      const sp = (0.2 + r()) * tempo * (r() < 0.5 ? -1 : 1);
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(v.t * sp * 0.2) * 40, Math.sin(v.t * sp * 0.2) * 32); ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(v.t * sp * 2.4) * 70, Math.sin(v.t * sp * 2.4) * 56); ctx.stroke();
      ctx.restore();
    });

    // Background pendulums.
    slots(v, 0.18, 430, 67, (x, r) => {
      if (r() < 0.5) return;
      const len = 260 + r() * 200;
      const a = Math.sin(v.t * (1.2 + r()) * tempo + r() * 6) * 0.5;
      const py = bgY(v, -80, 0.3, 1);
      const bx = x + Math.sin(a) * len, by = py + Math.cos(a) * len;
      ctx.strokeStyle = '#2a140b';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = '#2e170c';
      ctx.beginPath(); ctx.arc(bx, by, 34, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,170,80,0.18)';
      ctx.beginPath(); ctx.arc(bx - 8, by - 8, 12, 0, TAU); ctx.fill();
    });

    // Fracture: glowing cracks split the sky and let violet void light through.
    if (fk > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const rr = mulberry32(i * 977 + 3);
        let x = ((i * 311 - v.camX * 0.08) % (v.w + 600) + v.w + 600) % (v.w + 600) - 300;
        let y = -20;
        ctx.strokeStyle = `rgba(190,150,255,${0.5 * fk})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        while (y < v.h + 20) {
          x += (rr() - 0.5) * 90;
          y += 40 + rr() * 60;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = `rgba(160,110,255,${0.12 * fk})`;
        ctx.lineWidth = 14;
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.fillStyle = rgba(this.pal.haze, 0.34);
    ctx.fillRect(0, 0, v.w, v.h);

    // Mid gears: nearer, faster, meshing along the top and bottom.
    slots(v, 0.3, 240, 79, (x, r) => {
      const s = this.gearsMid[Math.floor(r() * 3)];
      const top = r() < 0.5;
      const y = top ? bgY(v, -30, 0.5, 2) : bgY(v, 570, 0.5, 2);
      const dir = (Math.floor(x / 240) % 2) ? 1 : -1;
      ctx.save();
      ctx.translate(x + fk * (r() - 0.5) * 300, y + fk * (top ? 1 : -1) * r() * 200);
      ctx.rotate(v.t * 0.35 * dir * tempo + fk * r() * 3);
      ctx.drawImage(s.c, -s.ox, -s.oy, s.w, s.h);
      ctx.restore();
    });

    // The rapid set piece: the world pulses amber in time.
    if (rapid) {
      const k = clamp((v.t - rapid.start) / 1, 0, 1) * clamp(1 - (v.t - rapid.start - 14) / 2, 0, 1);
      const beat = Math.pow(0.5 + 0.5 * Math.sin(v.t * TAU * 2), 6);
      ctx.fillStyle = `rgba(255,120,40,${0.08 * beat * k})`;
      ctx.fillRect(0, 0, v.w, v.h);
    }

    ctx.fillStyle = rgba(this.pal.haze, 0.12);
    ctx.fillRect(0, 0, v.w, v.h);
    drawFog(ctx, v, this.pal.fog, 1);
  }

  drawFront(ctx, v) {
    drawBokeh(ctx, v, this.sprites, 'rgba(255,150,60,0.9)', 151, 0.08);
    // Waking up: the dream brightens as the final portal approaches.
    const w = this.state.wake;
    if (w) {
      const k = clamp((v.t - w.start) / 2.5, 0, 1);
      ctx.fillStyle = `rgba(255,244,230,${0.25 * k})`;
      ctx.fillRect(0, 0, v.w, v.h);
    }
  }

  /** Riveted iron plates. */
  tileDetail(ctx, x, y, h, t, alt, exp) {
    if (alt) {
      ctx.fillStyle = 'rgba(255,200,120,0.14)';
      ctx.fillRect(x + 2, y + 4, 32, 3);
      ctx.fillRect(x + 2, y + 29, 32, 3);
      return;
    }
    if (!exp && (h & 3)) return;
    ctx.fillStyle = 'rgba(255,190,110,0.35)';
    ctx.fillRect(x + 5, y + 5, 3, 3);
    ctx.fillRect(x + 28, y + 5, 3, 3);
    ctx.fillRect(x + 5, y + 28, 3, 3);
    ctx.fillRect(x + 28, y + 28, 3, 3);
    if ((h & 15) === 1) {
      ctx.strokeStyle = 'rgba(255,190,110,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x + 18, y + 18, 8, 0, TAU); ctx.stroke();
    }
  }

  ambient(v, P, dt) {
    // Embers ride the current gravity.
    if (Math.random() < dt * 20) {
      P.spawn({
        x: v.camX + v.w * (0.1 + Math.random() * 1.1), y: v.camY + Math.random() * v.h,
        vx: -30 - Math.random() * 40, vy: 0, gravFollow: -35, drag: 0.4,
        life: 2 + Math.random() * 2, size: 2.5, color: Math.random() < 0.5 ? '#ffb06a' : '#ff7a3c', add: true, alpha: 0.8,
      });
    }
  }
}
