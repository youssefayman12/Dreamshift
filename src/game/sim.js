// Deterministic runner physics shared by gameplay, the bot and the validator.
// Positions: (x, y) is the top-left of the hitbox. g = +1 falls down, -1 up.
import { TILE, ROWS, WORLD_H, PHYS } from '../config.js';
import { T_CRUMBLE, T_PHASEA, T_PHASEB } from './level.js';

const { pw: PW, ph: PH } = PHYS;
const BUF = new Float64Array(5 * 64);
const R = { x: 0, y: 0, w: 0, h: 0 };

export function createRunner(x, y, g) {
  return {
    x, y, vy: 0, g, grounded: true, coyote: 0, alive: true,
    groundKin: -1, groundKinEdge: 0,
    crumbles: new Map(), phaseIgnore: [],
    lastGate: -1, airTime: 0, death: null,
  };
}

export function cloneRunner(p) {
  return {
    ...p,
    crumbles: p.crumbles.size ? new Map(p.crumbles) : new Map(),
    phaseIgnore: p.phaseIgnore.slice(),
  };
}

export function canFlip(p) {
  return p.alive && (p.grounded || p.coyote > 0);
}

export function flip(p) {
  p.g = -p.g;
  p.vy = p.g * PHYS.flipKick;
  p.grounded = false;
  p.coyote = 0;
  p.groundKin = -1;
}

function kill(p, cause, x, y) {
  p.alive = false;
  p.death = { cause, x: x ?? p.x + PW / 2, y: y ?? p.y + PH / 2 };
}

function blocked(L, x, y, t, p) {
  return L.overlaps(x, y, PW, PH, t, p, BUF) > 0;
}

/**
 * Advance the runner one fixed step. `ev` (optional) receives gameplay
 * events so the presentation layer can react: land, gate, crumble, etc.
 */
export function step(p, L, t, dt, ev) {
  if (!p.alive) return;
  const tPrev = t - dt;

  // Phase blocks that materialise around the runner never trap them.
  {
    const prev = p.phaseIgnore;
    const next = [];
    const c0 = Math.floor(p.x / TILE), c1 = Math.floor((p.x + PW + 8) / TILE);
    const r0 = Math.max(0, Math.floor((p.y - 2) / TILE)), r1 = Math.min(ROWS - 1, Math.floor((p.y + PH + 2) / TILE));
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) {
      const ty = L.tile(c, r);
      if (ty !== T_PHASEA && ty !== T_PHASEB) continue;
      const key = c * ROWS + r;
      const inside = p.x < (c + 1) * TILE && p.x + PW + 8 > c * TILE && p.y < (r + 1) * TILE && p.y + PH > r * TILE;
      if (inside && (!L.phaseOn(ty, tPrev) || prev.includes(key))) next.push(key);
    }
    p.phaseIgnore = next;
  }

  // 1. Ride kinematic surfaces we're standing on.
  if (p.grounded && p.groundKin >= 0) {
    const k = L.kinematics[p.groundKin];
    if (k) {
      k.rectAt(t, R);
      const edge = p.g === 1 ? R.y : R.y + R.h;
      p.y += edge - p.groundKinEdge;
      p.groundKinEdge = edge;
    }
  }

  // 2. Kinematic solids that moved into us push us vertically.
  let n = L.overlaps(p.x, p.y, PW, PH, t, p, BUF);
  if (n > 0) {
    for (let i = 0; i < n; i++) {
      const ki = BUF[i * 5 + 4];
      if (ki < 0) continue;
      const ry = BUF[i * 5 + 1], rh = BUF[i * 5 + 3];
      const up = p.y + PH - ry, down = ry + rh - p.y;
      if (up < down) p.y = ry - PH; else p.y = ry + rh;
    }
    if (blocked(L, p.x, p.y, t, p)) { kill(p, 'crush'); return; }
  }

  // 3. Constant forward motion; walls kill unless it's a clipped corner.
  const vx = L.speedAt(p.x);
  const nx = p.x + vx * dt;
  n = L.overlaps(nx, p.y, PW, PH, t, p, BUF);
  if (n > 0) {
    let minTop = Infinity, maxBot = -Infinity;
    for (let i = 0; i < n; i++) {
      const ry = BUF[i * 5 + 1], rh = BUF[i * 5 + 3];
      if (ry < minTop) minTop = ry;
      if (ry + rh > maxBot) maxBot = ry + rh;
    }
    const upNudge = p.y + PH - minTop;   // obstacle only clips our feet
    const downNudge = maxBot - p.y;      // obstacle only clips our head
    let fixed = false;
    if (upNudge <= PHYS.cornerTol && !blocked(L, nx, minTop - PH, t, p)) { p.y = minTop - PH; fixed = true; }
    else if (downNudge <= PHYS.cornerTol && !blocked(L, nx, maxBot, t, p)) { p.y = maxBot; fixed = true; }
    if (!fixed) {
      // Find the wall face for a readable death burst.
      let wx = Infinity;
      for (let i = 0; i < n; i++) wx = Math.min(wx, BUF[i * 5]);
      p.x = Math.min(nx, wx - PW);
      kill(p, 'wall', wx, p.y + PH / 2);
      return;
    }
  }
  p.x = nx;

  // 4. Gravity.
  const wasGrounded = p.grounded;
  p.vy += p.g * PHYS.gravity * dt;
  if (p.vy > PHYS.maxFall) p.vy = PHYS.maxFall;
  if (p.vy < -PHYS.maxFall) p.vy = -PHYS.maxFall;
  const vyBefore = p.vy;
  const ny = p.y + p.vy * dt;
  n = L.overlaps(p.x, ny, PW, PH, t, p, BUF);
  let landedKin = -1;
  if (n > 0) {
    if (p.vy > 0) {
      let top = Infinity;
      for (let i = 0; i < n; i++) {
        const ry = BUF[i * 5 + 1];
        if (ry < top) { top = ry; landedKin = BUF[i * 5 + 4]; }
      }
      p.y = Math.min(ny, top - PH);
    } else {
      let bot = -Infinity;
      for (let i = 0; i < n; i++) {
        const b = BUF[i * 5 + 1] + BUF[i * 5 + 3];
        if (b > bot) { bot = b; landedKin = BUF[i * 5 + 4]; }
      }
      p.y = Math.max(ny, bot);
    }
    p.vy = 0;
    if (blocked(L, p.x, p.y, t, p)) { kill(p, 'crush'); return; }
  } else {
    p.y = ny;
  }

  // 5. Ground probe in the gravity direction.
  const probeY = p.g === 1 ? p.y + 1.5 : p.y - 1.5;
  n = L.overlaps(p.x, probeY, PW, PH, t, p, BUF);
  p.grounded = n > 0;
  p.groundKin = -1;
  if (p.grounded) {
    for (let i = 0; i < n; i++) {
      const ki = BUF[i * 5 + 4];
      if (ki >= 0) {
        p.groundKin = ki;
        p.groundKinEdge = p.g === 1 ? BUF[i * 5 + 1] : BUF[i * 5 + 1] + BUF[i * 5 + 3];
      }
    }
    if (p.vy * p.g > 0) p.vy = 0;
    // Trigger crumbling blocks underfoot.
    const r = p.g === 1 ? Math.floor((p.y + PH + 2) / TILE) : Math.floor((p.y - 2) / TILE);
    const c0 = Math.floor(p.x / TILE), c1 = Math.floor((p.x + PW - 1e-6) / TILE);
    for (let c = c0; c <= c1; c++) {
      if (L.tile(c, r) === T_CRUMBLE) {
        const key = c * ROWS + r;
        if (!p.crumbles.has(key)) {
          p.crumbles.set(key, t);
          ev?.push({ type: 'crumble', c, r });
        }
      }
    }
    if (!wasGrounded) {
      ev?.push({ type: 'land', impact: Math.abs(vyBefore) || Math.abs(p.airVy || 0), air: p.airTime });
      p.airTime = 0;
    }
    p.coyote = PHYS.coyote;
  } else {
    if (wasGrounded) p.coyote = PHYS.coyote;
    else p.coyote = Math.max(0, p.coyote - dt);
    p.airTime += dt;
    p.airVy = vyBefore;
  }

  // 6. Flip gates force a gravity change.
  const gates = L.gates;
  for (let i = p.lastGate + 1; i < gates.length; i++) {
    const G = gates[i];
    if (G.x > p.x + PW) break;
    if (G.x + G.w < p.x) { p.lastGate = i; continue; }
    if (p.y < G.y + G.h && p.y + PH > G.y) {
      p.lastGate = i;
      flip(p);
      ev?.push({ type: 'gate', gate: G });
    }
  }

  // 7. Hazards.
  let hit = null;
  L.hazardsAround(p.x, (h) => {
    if (!hit && h.hit(p.x, p.y, PW, PH, t)) hit = h;
  });
  if (hit) {
    kill(p, 'hazard');
    p.death.hazard = hit;
    return;
  }

  // 8. The dream void above and below the playfield.
  if (p.y > WORLD_H + PHYS.voidMargin || p.y + PH < -PHYS.voidMargin) kill(p, 'void');
}

export { PW, PH };
