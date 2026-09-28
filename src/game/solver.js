// Breadth-first search over flip decisions. Because the runner's x is a pure
// function of elapsed frames, the only branching is "flip now or not", and
// states collapse heavily once they land on a surface.
import { TILE, SIM_DT } from '../config.js';
import { cloneRunner, canFlip, flip, step } from './sim.js';

function keyOf(p) {
  let k = `${Math.round(p.y * 2)}|${Math.round(p.vy / 6)}|${p.g}|${p.grounded ? 1 : 0}|${p.lastGate}|${p.coyote > 0 ? 1 : 0}`;
  if (p.crumbles.size) {
    const minC = Math.floor(p.x / TILE) - 2;
    const ks = [];
    for (const [c] of p.crumbles) if (Math.floor(c / 15) >= minC) ks.push(c);
    if (ks.length) k += '|' + ks.sort((a, b) => a - b).join(',');
  }
  return k;
}

/**
 * Explore from `start` at time t0 until x >= goalX or maxFrames.
 * Returns { ok, frames, nodes } where nodes[f] = [{key, parent, flipped, p?}].
 */
export function explore(L, start, t0, goalX, opts = {}) {
  const every = opts.every ?? 2;
  const maxFrames = opts.maxFrames ?? 20000;
  const keepPaths = opts.keepPaths ?? true;
  const maxStates = opts.maxStates ?? 400;
  let frontier = [{ p: cloneRunner(start), parent: -1, flipped: false, key: '', alt: [] }];
  const nodes = [];
  let f = 0;
  let reached = -1;
  while (f < maxFrames) {
    const t = t0 + (f + 1) * SIM_DT;
    const next = [];
    const seen = new Map();
    for (let i = 0; i < frontier.length; i++) {
      const n = frontier[i];
      const options = [false];
      if (f % every === 0 && canFlip(n.p)) options.push(true);
      for (const doFlip of options) {
        const q = options.length > 1 && !doFlip ? cloneRunner(n.p) : doFlip ? cloneRunner(n.p) : n.p;
        if (doFlip) flip(q);
        step(q, L, t, SIM_DT, null);
        if (!q.alive) continue;
        const key = keyOf(q);
        const j = seen.get(key);
        if (j !== undefined) {
          // Merged state: remember every way to get here (for window analysis).
          if (keepPaths) next[j].alt.push(i);
          continue;
        }
        seen.set(key, next.length);
        next.push({ p: q, parent: i, flipped: doFlip, key, alt: [] });
      }
    }
    if (keepPaths) nodes.push(frontier.map((n) => ({ key: n.key, parent: n.parent, alt: n.alt, flipped: n.flipped })));
    if (!next.length) {
      return { ok: false, frames: f, x: frontier[0]?.p.x ?? start.x, nodes, frontier: [] };
    }
    // Hard cap keeps the search bounded in pathological layouts.
    frontier = next.length > maxStates ? next.slice(0, maxStates) : next;
    f++;
    if (frontier[0].p.x >= goalX) { reached = f; break; }
  }
  if (keepPaths) nodes.push(frontier.map((n) => ({ key: n.key, parent: n.parent, alt: n.alt, flipped: n.flipped })));
  return { ok: reached >= 0, frames: f, x: frontier[0].p.x, nodes, frontier };
}

/** Reconstruct the flip frames leading to final-frame node index i. */
export function pathTo(nodes, i) {
  const flips = [];
  for (let f = nodes.length - 1; f > 0; f--) {
    const n = nodes[f][i];
    if (n.flipped) flips.push(f - 1);
    i = n.parent;
  }
  return flips.reverse();
}

/**
 * Receding-horizon planner for the attract-mode bot. Returns an array of
 * frame offsets (from now) at which to flip, or null if doomed.
 */
export function plan(L, runner, t, horizon = 260, rng = Math.random) {
  const res = explore(L, runner, t, Infinity, { maxFrames: horizon, every: 3, maxStates: 160 });
  const last = res.nodes[res.nodes.length - 1];
  if (!res.frontier.length || !last?.length) return null;
  // Prefer calm paths (few flips) but keep some variety.
  let best = null, bestScore = Infinity;
  const tries = Math.min(last.length, 24);
  for (let k = 0; k < tries; k++) {
    const i = k === 0 ? 0 : Math.floor(rng() * last.length);
    const flips = pathTo(res.nodes, i);
    const score = flips.length + rng() * 0.8 + (flips[0] !== undefined && flips[0] < 4 ? 0.5 : 0);
    if (score < bestScore) { bestScore = score; best = flips; }
  }
  return best;
}
