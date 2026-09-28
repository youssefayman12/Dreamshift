// Draws gameplay geometry in world space. Readability rules:
//  * solids: dark fill + bright luminous edge in the world's accent colour
//  * hazards: always the same crimson/pink thorn language, in every world
//  * pickups: warm gold, never used for anything dangerous
import { TILE, ROWS, PHYS } from '../config.js';
import { T_SOLID, T_SOLID2, T_CRUMBLE, T_PHASEA, T_PHASEB } from '../game/level.js';
import { drawSprite, HAZARD } from './sprites.js';
import { rgba, clamp, TAU } from '../engine/math.js';

const ROT = { u: 0, r: Math.PI / 2, d: Math.PI, l: -Math.PI / 2 };

function isStatic(ty) { return ty === T_SOLID || ty === T_SOLID2; }

export class LevelView {
  constructor() {
    this.gradCache = new WeakMap();
  }

  solidFill(ctx, pal) {
    let g = this.gradCache.get(pal);
    if (!g || g.ctx !== ctx) {
      const grad = ctx.createLinearGradient(0, 0, 0, ROWS * TILE);
      grad.addColorStop(0, pal.solidTop);
      grad.addColorStop(0.5, pal.solidBot);
      grad.addColorStop(1, pal.solidTop);
      g = { ctx, grad };
      this.gradCache.set(pal, g);
    }
    return g.grad;
  }

  draw(ctx, run, v, themes, sprites) {
    const L = run.level;
    const t = run.t;
    const c0 = Math.floor(v.camX / TILE) - 1;
    const c1 = Math.ceil((v.camX + v.w) / TILE) + 1;
    // Endless mode can mix worlds; draw each column run in its own theme.
    let segStart = c0;
    let cur = L.styleAt(c0);
    for (let c = c0; c <= c1 + 1; c++) {
      const st = c <= c1 ? L.styleAt(c) : null;
      if (st !== cur) {
        this.drawSolids(ctx, L, segStart, c - 1, themes(cur), t, run.runner);
        segStart = c; cur = st;
      }
    }
    this.drawKinematics(ctx, L, v, themes(L.theme), t);
    this.drawGates(ctx, L, v, t, run.runner);
    this.drawCheckpoints(ctx, L, v, t, run, sprites);
    this.drawPortal(ctx, L, v, t);
    this.drawPickups(ctx, L, v, t, sprites);
    this.drawHazards(ctx, L, v, t, sprites);
  }

  drawSolids(ctx, L, c0, c1, theme, t, runner) {
    const pal = theme.pal;
    // 1. fills (row runs)
    ctx.fillStyle = this.solidFill(ctx, pal);
    ctx.beginPath();
    for (let r = 0; r < ROWS; r++) {
      let run0 = -1;
      for (let c = c0; c <= c1 + 1; c++) {
        const s = c <= c1 && isStatic(L.tile(c, r));
        if (s && run0 < 0) run0 = c;
        if (!s && run0 >= 0) { ctx.rect(run0 * TILE, r * TILE, (c - run0) * TILE, TILE); run0 = -1; }
      }
    }
    // Extend floor/ceiling fill beyond the playfield so it feels anchored.
    for (let c = c0; c <= c1; c++) {
      if (isStatic(L.tile(c, 0))) ctx.rect(c * TILE, -400, TILE, 400);
      if (isStatic(L.tile(c, ROWS - 1))) ctx.rect(c * TILE, ROWS * TILE, TILE, 400);
    }
    ctx.fill();
    // alt tiles get a tinted overlay
    ctx.fillStyle = pal.alt;
    ctx.beginPath();
    for (let c = c0; c <= c1; c++) for (let r = 0; r < ROWS; r++) if (L.tile(c, r) === T_SOLID2) ctx.rect(c * TILE, r * TILE, TILE, TILE);
    ctx.fill();

    // 2. per-theme details
    for (let c = c0; c <= c1; c++) {
      for (let r = 0; r < ROWS; r++) {
        const ty = L.tile(c, r);
        if (!isStatic(ty)) continue;
        // skip deeply buried tiles: only decorate near surfaces
        const h = ((c * 73856093) ^ (r * 19349663)) >>> 0;
        const exp = (r > 0 && !isStatic(L.tile(c, r - 1)) ? 1 : 0) | (r < ROWS - 1 && !isStatic(L.tile(c, r + 1)) ? 2 : 0);
        theme.tileDetail(ctx, c * TILE, r * TILE, h, t, ty === T_SOLID2, exp);
      }
    }

    // 3. luminous edges on exposed faces
    const edges = (glow) => {
      ctx.beginPath();
      for (let c = c0; c <= c1; c++) {
        for (let r = 0; r < ROWS; r++) {
          if (!isStatic(L.tile(c, r))) continue;
          const x = c * TILE, y = r * TILE;
          if (r > 0 && !isStatic(L.tile(c, r - 1))) { ctx.moveTo(x, y); ctx.lineTo(x + TILE, y); }
          if (r < ROWS - 1 && !isStatic(L.tile(c, r + 1))) { ctx.moveTo(x, y + TILE); ctx.lineTo(x + TILE, y + TILE); }
          if (!isStatic(L.tile(c - 1, r))) { ctx.moveTo(x, y); ctx.lineTo(x, y + TILE); }
          if (!isStatic(L.tile(c + 1, r))) { ctx.moveTo(x + TILE, y); ctx.lineTo(x + TILE, y + TILE); }
        }
      }
      ctx.stroke();
    };
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(pal.edgeGlow, 0.22);
    ctx.lineWidth = 9;
    edges();
    ctx.strokeStyle = pal.edge;
    ctx.lineWidth = 2.2;
    edges();

    // 4. crumbling + phase blocks
    for (let c = c0; c <= c1; c++) {
      for (let r = 0; r < ROWS; r++) {
        const ty = L.tile(c, r);
        if (ty === T_CRUMBLE) this.drawCrumble(ctx, c, r, t, runner, pal);
        else if (ty === T_PHASEA || ty === T_PHASEB) this.drawPhase(ctx, L, c, r, ty, t, pal);
      }
    }
  }

  drawCrumble(ctx, c, r, t, runner, pal) {
    const trig = runner.crumbles.get(c * ROWS + r);
    let x = c * TILE, y = r * TILE;
    let alpha = 1, rot = 0;
    if (trig !== undefined) {
      const k = (t - trig) / PHYS.crumbleTime;
      if (k >= 1) {
        // falling away
        const f = k - 1;
        if (f > 1.2) return;
        const dir = r < ROWS / 2 ? -1 : 1;
        y += dir * f * f * 300;
        rot = f * 1.5 * ((c % 2) ? 1 : -1);
        alpha = 1 - f / 1.2;
      } else {
        x += Math.sin(t * 90 + c) * 1.8 * k;
        y += Math.cos(t * 77 + r) * 1.2 * k;
      }
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x + TILE / 2, y + TILE / 2);
    ctx.rotate(rot);
    ctx.fillStyle = pal.solidTop;
    ctx.fillRect(-TILE / 2 + 1, -TILE / 2 + 1, TILE - 2, TILE - 2);
    ctx.strokeStyle = '#ffc07a';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(-TILE / 2 + 2, -TILE / 2 + 2, TILE - 4, TILE - 4);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,192,122,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-10, -18); ctx.lineTo(-2, -4); ctx.lineTo(-8, 6); ctx.lineTo(0, 18);
    ctx.moveTo(-2, -4); ctx.lineTo(10, 2);
    ctx.stroke();
    ctx.restore();
  }

  drawPhase(ctx, L, c, r, ty, t, pal) {
    const on = L.phaseOn(ty, t, c);
    const P = L.phasePeriod;
    const tt = t + (L.phaseOff?.[c - L.colOffset] ?? 0);
    const m = ((tt % P) + P) % P;
    // time until this block turns on
    const onAt = ty === T_PHASEA ? P : P / 2;
    let until = (onAt - m + P) % P;
    const col = ty === T_PHASEA ? pal.phaseA : pal.phaseB;
    const x = c * TILE, y = r * TILE;
    if (on) {
      ctx.fillStyle = rgba(col, 0.28);
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.4;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = rgba(col, 0.55);
      ctx.fillRect(x + 12, y + 12, TILE - 24, TILE - 24);
    } else {
      const warn = until < 0.4 ? 1 - until / 0.4 : 0;
      ctx.strokeStyle = rgba(col, 0.22 + warn * 0.6 * (0.6 + 0.4 * Math.sin(t * 40)));
      ctx.lineWidth = 1.5 + warn;
      ctx.setLineDash([4, 5]);
      ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
      ctx.setLineDash([]);
      if (warn > 0) {
        ctx.fillStyle = rgba(col, warn * 0.2);
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
      }
    }
  }

  drawKinematics(ctx, L, v, theme, t) {
    const pal = theme.pal;
    const R = { x: 0, y: 0, w: 0, h: 0 };
    for (const k of L.kinematics) {
      if (k.maxX < v.camX - 50 || k.minX > v.camX + v.w + 50) continue;
      k.rectAt(t, R);
      ctx.fillStyle = pal.alt;
      ctx.fillRect(R.x, R.y, R.w, R.h);
      if (theme.kinDetail) theme.kinDetail(ctx, k, R, t);
      ctx.strokeStyle = rgba(pal.edgeGlow, 0.25);
      ctx.lineWidth = 8;
      ctx.strokeRect(R.x, R.y, R.w, R.h);
      ctx.strokeStyle = pal.altEdge ?? pal.edge;
      ctx.lineWidth = 2.2;
      ctx.strokeRect(R.x, R.y, R.w, R.h);
      // motion hint: small chevrons showing travel axis
      ctx.fillStyle = rgba(pal.altEdge ?? pal.edge, 0.5);
      if (k.kind === 'mover') {
        const cx = R.x + R.w / 2;
        const s = Math.cos((t / k.period + k.phase) * TAU);
        const dir = Math.sign(s * (k.ay || k.ax)) || 1;
        for (const yy of [R.y - 8, R.y + R.h + 8]) {
          ctx.beginPath();
          ctx.moveTo(cx - 5, yy); ctx.lineTo(cx + 5, yy); ctx.lineTo(cx, yy + 5 * dir); ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  drawHazards(ctx, L, v, t, sprites) {
    const x0 = v.camX - 200, x1 = v.camX + v.w + 200;
    const spr = sprites.s;
    for (const h of L.hazards) {
      if (h.maxX < x0 || h.minX > x1) continue;
      switch (h.kind) {
        case 'spike': {
          const cx = h.x + TILE / 2, cy = h.y + TILE / 2;
          drawSprite(ctx, spr.spike, cx, cy, 1, 1, ROT[h.dir]);
          break;
        }
        case 'orb':
        case 'drifter': {
          const b = h.balls(t);
          const s = h.r / 13;
          if (h.kind === 'drifter') {
            ctx.strokeStyle = 'rgba(255,79,139,0.18)';
            ctx.setLineDash([3, 6]);
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(h.cx - h.ax, h.cy - h.ay); ctx.lineTo(h.cx + h.ax, h.cy + h.ay); ctx.stroke();
            ctx.setLineDash([]);
          }
          drawSprite(ctx, spr.orb, b[0], b[1], s, s, t * 1.5 + h.id);
          break;
        }
        case 'rotor': {
          const b = h.balls(t);
          ctx.strokeStyle = HAZARD.mid;
          ctx.lineWidth = 4;
          const per = (b.length / 3 - 1) / h.arms;
          ctx.beginPath();
          for (let a = 0; a < h.arms; a++) {
            const i = (1 + (a + 1) * per - 1) * 3;
            ctx.moveTo(h.cx, h.cy); ctx.lineTo(b[i], b[i + 1]);
          }
          ctx.stroke();
          for (let i = 0; i < b.length; i += 3) {
            const s = b[i + 2] / 13;
            drawSprite(ctx, spr.orb, b[i], b[i + 1], s, s, t * 3 + i);
          }
          break;
        }
        case 'pendulum': {
          const b = h.balls(t);
          ctx.strokeStyle = 'rgba(255,200,220,0.35)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.moveTo(h.px, h.py); ctx.lineTo(b[0], b[1]); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,200,220,0.6)';
          ctx.beginPath(); ctx.arc(h.px, h.py, 5, 0, TAU); ctx.fill();
          const s = h.r / 13;
          drawSprite(ctx, spr.orb, b[0], b[1], s, s, h.angle(t) * 2);
          break;
        }
      }
    }
  }

  drawPickups(ctx, L, v, t, sprites) {
    const x0 = v.camX - 40, x1 = v.camX + v.w + 40;
    const P = L.pickups;
    // binary search first visible
    let lo = 0, hi = P.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (P[m].x < x0) lo = m + 1; else hi = m; }
    for (let i = lo; i < P.length; i++) {
      const k = P[i];
      if (k.x > x1) break;
      if (k.taken) continue;
      const bob = Math.sin(t * 3 + k.x * 0.05) * 3;
      if (k.type === 'frag') {
        const sx = Math.cos(t * 3 + k.x * 0.1);
        drawSprite(ctx, sprites.s.frag, k.x, k.y + bob, Math.abs(sx) * 0.7 + 0.3, 1);
      } else {
        const s = 1 + Math.sin(t * 4) * 0.08;
        drawSprite(ctx, sprites.s.star, k.x, k.y + bob, s, s, Math.sin(t * 1.5) * 0.2);
      }
    }
  }

  drawGates(ctx, L, v, t, runner) {
    for (const G of L.gates) {
      if (G.x < v.camX - 60 || G.x > v.camX + v.w + 60) continue;
      const used = G.id <= runner.lastGate;
      const cx = G.x + G.w / 2, cy = G.y + G.h / 2;
      const a = used ? 0.25 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#d9c8ff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(cx, cy, 14, G.h / 2, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(180,140,255,0.35)';
      ctx.lineWidth = 10;
      ctx.stroke();
      // up/down arrows travelling around the ring
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 2; i++) {
        const k = ((t * 1.4 + i * 0.5) % 1);
        const y = cy - G.h / 2 + k * G.h;
        ctx.globalAlpha = a * Math.sin(k * Math.PI);
        ctx.beginPath(); ctx.moveTo(cx - 6, y - 4); ctx.lineTo(cx + 6, y - 4); ctx.lineTo(cx, y + 4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx - 6, cy + (cy - y) + 4); ctx.lineTo(cx + 6, cy + (cy - y) + 4); ctx.lineTo(cx, cy + (cy - y) - 4); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawCheckpoints(ctx, L, v, t, run, sprites) {
    for (const cp of L.checkpoints) {
      if (cp.x < v.camX - 80 || cp.x > v.camX + v.w + 80) continue;
      const lit = run.cp.id >= cp.id;
      const baseY = cp.g === 1 ? cp.y + 34 : cp.y;
      const dir = cp.g === 1 ? -1 : 1;
      const x = cp.x + 11;
      const top = baseY + dir * 66;
      ctx.strokeStyle = lit ? '#ffe4a8' : 'rgba(220,210,255,0.5)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, top); ctx.lineTo(x + 12, top); ctx.stroke();
      const lx = x + 12, ly = top - dir * 10 + Math.sin(t * 2) * 1.5;
      if (lit) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8 + Math.sin(t * 9) * 0.1;
        ctx.drawImage(sprites.glow('rgba(255,200,110,0.9)').c, lx - 40, ly - 40, 80, 80);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = lit ? '#ffcf6b' : 'rgba(40,30,70,0.9)';
      ctx.strokeStyle = lit ? '#fff3cf' : 'rgba(220,210,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx - 7, ly - 9); ctx.lineTo(lx + 7, ly - 9); ctx.lineTo(lx + 9, ly + 9); ctx.lineTo(lx - 9, ly + 9); ctx.closePath();
      ctx.fill(); ctx.stroke();
      if (lit) {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(lx, ly + 2, 2.5, 4 + Math.sin(t * 20) * 0.8, 0, 0, TAU); ctx.fill();
      }
    }
  }

  drawPortal(ctx, L, v, t) {
    const P = L.portal;
    if (!P || P.x < v.camX - 200 || P.x > v.camX + v.w + 200) return;
    const cx = P.x + 40, cy = 270;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const k = i / 6;
      ctx.strokeStyle = `hsla(${(t * 60 + i * 40) % 360},90%,75%,${0.5 - k * 0.3})`;
      ctx.lineWidth = 6 - i * 0.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 50 + i * 10 + Math.sin(t * 3 + i) * 4, 190 - i * 12, Math.sin(t * 0.7 + i) * 0.08, 0, TAU);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 200);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.3, 'rgba(210,190,255,0.35)');
    g.addColorStop(1, 'rgba(120,80,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, 70, 200, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawTutor(ctx, run, v, t, label) {
    for (const tu of run.level.tutors) {
      if (tu.x < v.camX - 100 || tu.x > v.camX + v.w + 200) continue;
      const up = tu.r >= 7;
      const active = run.freeze && run.freeze.tutor === tu;
      const x = tu.x + 30;
      const y = up ? 330 : 210;
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.7;
      ctx.translate(x, y);
      const pulse = 1 + Math.sin(t * 6) * (active ? 0.07 : 0.03);
      ctx.scale(pulse, pulse);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 20px "Trebuchet MS", sans-serif';
      const w = Math.max(96, ctx.measureText(label).width + 36);
      ctx.fillStyle = 'rgba(12,6,34,0.72)';
      ctx.strokeStyle = '#8ff6ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-w / 2, -20, w, 40, 20) : ctx.rect(-w / 2, -20, w, 40);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, 0, 1);
      ctx.font = '700 12px "Trebuchet MS", sans-serif';
      ctx.fillStyle = 'rgba(220,240,255,0.85)';
      ctx.fillText(up ? 'shift gravity up' : 'shift gravity down', 0, 34);
      // arrow travelling in the flip direction
      ctx.fillStyle = '#8ff6ff';
      const dy = up ? -1 : 1;
      const off = up ? 34 + ((t * 1.5) % 1) * 16 : 52 + ((t * 1.5) % 1) * 16;
      ctx.globalAlpha *= 1 - ((t * 1.5) % 1) * 0.6;
      ctx.beginPath();
      ctx.moveTo(-12, dy * off); ctx.lineTo(12, dy * off); ctx.lineTo(0, dy * (off + 16)); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawDeathMarks(ctx, run, t) {
    ctx.strokeStyle = 'rgba(255,120,170,0.35)';
    ctx.lineWidth = 2;
    for (const m of run.deathMarks) {
      const s = 7;
      ctx.beginPath();
      ctx.moveTo(m.x - s, m.y - s); ctx.lineTo(m.x + s, m.y + s);
      ctx.moveTo(m.x + s, m.y - s); ctx.lineTo(m.x - s, m.y + s);
      ctx.stroke();
    }
  }
}

export { clamp };
