// Pure gameplay entities. No rendering here: every position is a pure function
// of level time so the runtime, the in-browser bot and the headless validator
// all agree exactly.
import { TILE, WORLD_H } from '../config.js';
import { TAU, circleRectDist, rectRectDist } from '../engine/math.js';

let nextId = 1;

// ---------------------------------------------------------------- hazards

function circleHazard(kind, props) {
  return {
    id: nextId++, kind, hazard: true, ...props,
    // subclasses provide balls(t, out)
    hit(px, py, pw, ph, t) {
      const b = this.balls(t);
      for (let i = 0; i < b.length; i += 3) {
        if (circleRectDist(b[i], b[i + 1], px, py, pw, ph) < b[i + 2]) return true;
      }
      return false;
    },
    near(px, py, pw, ph, t) {
      const b = this.balls(t);
      let m = 1e9;
      for (let i = 0; i < b.length; i += 3) {
        const d = circleRectDist(b[i], b[i + 1], px, py, pw, ph) - b[i + 2];
        if (d < m) m = d;
      }
      return m;
    },
  };
}

/** Static spike tile. dir: 'u' (points up, sits on floor), 'd', 'l', 'r'. */
export function makeSpike(c, r, dir) {
  const x = c * TILE, y = r * TILE;
  let hx, hy, hw, hh;
  // Hitboxes are noticeably smaller than the art: deaths must feel earned.
  if (dir === 'u') { hx = x + 8; hy = y + 14; hw = 20; hh = 22; }
  else if (dir === 'd') { hx = x + 8; hy = y; hw = 20; hh = 22; }
  else if (dir === 'l') { hx = x + 14; hy = y + 8; hw = 22; hh = 20; }
  else { hx = x; hy = y + 8; hw = 22; hh = 20; }
  return {
    id: nextId++, kind: 'spike', hazard: true, c, r, dir, x, y,
    minX: x, maxX: x + TILE,
    hit(px, py, pw, ph) {
      return px < hx + hw && px + pw > hx && py < hy + hh && py + ph > hy;
    },
    near(px, py, pw, ph) { return rectRectDist(px, py, pw, ph, hx, hy, hw, hh); },
  };
}

/** A floating thorn orb. Static unless given drift amplitude. */
export function makeDrifter(cx, cy, p = {}) {
  const r = p.r ?? 13;
  const ax = p.ax ?? 0, ay = p.ay ?? 0;
  const period = p.period ?? 2, phase = p.phase ?? 0;
  const out = [0, 0, r];
  const e = circleHazard(ax || ay ? 'drifter' : 'orb', {
    cx, cy, r, ax, ay, period, phase,
    minX: cx - Math.abs(ax) - r - 4, maxX: cx + Math.abs(ax) + r + 4,
    pos(t) {
      const s = Math.sin((t / period + phase) * TAU);
      return [cx + ax * s, cy + ay * s];
    },
    balls(t) {
      const s = Math.sin((t / period + phase) * TAU);
      out[0] = cx + ax * s; out[1] = cy + ay * s;
      return out;
    },
  });
  return e;
}

/** Rotating arms of thorn orbs around a hub. */
export function makeRotor(cx, cy, p = {}) {
  const arms = p.arms ?? 2, len = p.len ?? 72, speed = p.speed ?? 1.2, phase = p.phase ?? 0;
  const step = p.step ?? 19, r = p.r ?? 9, tipR = p.tipR ?? 12;
  const counts = Math.max(1, Math.floor((len - 10) / step));
  const out = new Array((arms * counts + 1) * 3).fill(0);
  return circleHazard('rotor', {
    cx, cy, arms, len, speed, phase, r, tipR,
    minX: cx - len - tipR - 4, maxX: cx + len + tipR + 4,
    angle(t) { return (t * speed + phase) * TAU; },
    balls(t) {
      const a0 = this.angle(t);
      let k = 0;
      out[k++] = cx; out[k++] = cy; out[k++] = 11;
      for (let a = 0; a < arms; a++) {
        const ang = a0 + (a / arms) * TAU;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        for (let i = 1; i <= counts; i++) {
          const d = i === counts ? len : 10 + i * step;
          out[k++] = cx + ca * d; out[k++] = cy + sa * d;
          out[k++] = i === counts ? tipR : r;
        }
      }
      return out;
    },
  });
}

/** A swinging pendulum. dir 1 hangs down from the pivot, -1 stands up. */
export function makePendulum(px, py, p = {}) {
  const len = p.len ?? 150, amp = p.amp ?? 0.9, period = p.period ?? 2.2, phase = p.phase ?? 0;
  const r = p.r ?? 20, dir = p.dir ?? 1;
  const out = [0, 0, r];
  return circleHazard('pendulum', {
    px, py, len, amp, period, phase, r, dir, sync: p.sync,
    minX: px - len - r, maxX: px + len + r,
    angle(t) { return amp * Math.sin((t / period + this.phase) * TAU); },
    balls(t) {
      const a = this.angle(t);
      out[0] = px + Math.sin(a) * len;
      out[1] = py + Math.cos(a) * len * dir;
      return out;
    },
  });
}

// ---------------------------------------------------------------- kinematic solids

/** Floating platform that oscillates. Anchor = top-left cell. */
export function makeMover(x, y, p = {}) {
  const w = (p.w ?? 3) * TILE, h = (p.h ?? 1) * TILE;
  const ax = p.ax ?? 0, ay = p.ay ?? 72, period = p.period ?? 2.4, phase = p.phase ?? 0;
  return {
    id: nextId++, kind: 'mover', solid: true, x, y, w, h, ax, ay, period, phase,
    style: p.style,
    minX: x - Math.abs(ax), maxX: x + w + Math.abs(ax),
    rectAt(t, o) {
      const s = Math.sin((t / period + phase) * TAU);
      o.x = x + ax * s; o.y = y + ay * s; o.w = w; o.h = h;
      return o;
    },
  };
}

/** A pillar that stretches out of a surface and back. side: 'floor' | 'ceil'. */
export function makePillar(x, baseY, p = {}) {
  const w = (p.w ?? 1) * TILE;
  const min = (p.min ?? 1) * TILE, max = (p.max ?? 5) * TILE;
  const period = p.period ?? 2.4, phase = p.phase ?? 0, side = p.side ?? 'floor';
  return {
    id: nextId++, kind: 'pillar', solid: true, x, baseY, w, min, max, period, phase, side, sync: p.sync,
    minX: x, maxX: x + w,
    lenAt(t) {
      const s = 0.5 - 0.5 * Math.cos((t / period + this.phase) * TAU);
      return min + (max - min) * s;
    },
    rectAt(t, o) {
      const l = this.lenAt(t);
      o.x = x; o.w = w; o.h = l;
      o.y = side === 'floor' ? baseY - l : baseY;
      return o;
    },
  };
}

// ---------------------------------------------------------------- mirroring

/** Mirror an entity vertically (used when a chunk is flipped floor<->ceiling). */
export function mirrorEntity(e) {
  switch (e.kind) {
    case 'orb':
    case 'drifter':
      return makeDrifter(e.cx, WORLD_H - e.cy, { r: e.r, ax: e.ax, ay: -e.ay, period: e.period, phase: e.phase });
    case 'rotor':
      return makeRotor(e.cx, WORLD_H - e.cy, { arms: e.arms, len: e.len, speed: -e.speed, phase: -e.phase, r: e.r, tipR: e.tipR });
    case 'pendulum':
      return makePendulum(e.px, WORLD_H - e.py, { len: e.len, amp: e.amp, period: e.period, phase: e.phase, r: e.r, dir: -e.dir, sync: e.sync });
    case 'mover':
      return makeMover(e.x, WORLD_H - e.y - e.h, { w: e.w / TILE, h: e.h / TILE, ax: e.ax, ay: -e.ay, period: e.period, phase: e.phase, style: e.style });
    case 'pillar':
      return makePillar(e.x, WORLD_H - e.baseY, {
        w: e.w / TILE, min: e.min / TILE, max: e.max / TILE, period: e.period, phase: e.phase,
        side: e.side === 'floor' ? 'ceil' : 'floor', sync: e.sync,
      });
    default:
      return e;
  }
}

/** Create an entity from a chunk legend definition at a tile cell. */
export function makeEntity(def, c, r) {
  const x = c * TILE, y = r * TILE, cx = x + TILE / 2, cy = y + TILE / 2;
  switch (def.type) {
    case 'orb': return makeDrifter(cx, cy, def);
    case 'drifter': return makeDrifter(cx, cy, def);
    case 'rotor': return makeRotor(cx, cy, def);
    case 'pendulum': return makePendulum(cx, def.dir === -1 ? y + TILE : y, def);
    case 'mover': return makeMover(x, y, def);
    case 'pillar': return makePillar(x, def.side === 'ceil' ? y : y + TILE, def);
    default: throw new Error('Unknown entity type ' + def.type);
  }
}
