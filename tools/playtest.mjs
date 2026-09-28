// Monte Carlo playtest: a "sensible but imperfect" player. At each decision it
// aims for the middle of the widest good flip window, then misses by Gaussian
// timing noise (sigma in frames at 120 Hz). Reports, per checkpoint section,
// the chance of clearing it on a single attempt.
//   node tools/playtest.mjs [sigmaFrames=6] [trials=40] [stageIds...]
import { TILE, SIM_DT } from '../src/config.js';
import { buildStage } from '../src/game/level.js';
import { createRunner, cloneRunner, flip, step } from '../src/game/sim.js';
import { explore } from '../src/game/solver.js';
import { STAGES, CHUNKS } from '../src/levels/stages.js';

const [sigArg, trialsArg, ...ids] = process.argv.slice(2);
const SIGMA = +(sigArg ?? 6), TRIALS = +(trialsArg ?? 40);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

function keyOf(q) {
  let k = `${Math.round(q.y * 2)}|${Math.round(q.vy / 6)}|${q.g}|${q.grounded ? 1 : 0}|${q.lastGate}|${q.coyote > 0 ? 1 : 0}`;
  if (q.crumbles.size) {
    const minC = Math.floor(q.x / TILE) - 2;
    const ks = [];
    for (const [c] of q.crumbles) if (Math.floor(c / 15) >= minC) ks.push(c);
    if (ks.length) k += '|' + ks.sort((a, b) => a - b).join(',');
  }
  return k;
}

function section(L, start, t0, goalX) {
  const res = explore(L, start, t0, goalX, { every: 1, maxStates: 3000 });
  const nodes = res.nodes;
  const goodIdx = nodes.map(() => new Set());
  nodes[nodes.length - 1].forEach((_, i) => goodIdx[nodes.length - 1].add(i));
  for (let f = nodes.length - 1; f > 0; f--) for (const i of goodIdx[f]) { const n = nodes[f][i]; goodIdx[f - 1].add(n.parent); for (const a of n.alt) goodIdx[f - 1].add(a); }
  const good = nodes.map((arr, f) => new Set([...goodIdx[f]].map((i) => arr[i].key)));
  const last = nodes.length - 1;
  const isGood = (q, f) => q.alive && f <= last && good[f].has(keyOf(q));
  let wins = 0;
  for (let trial = 0; trial < TRIALS; trial++) {
    let p = cloneRunner(start), f = 0, plannedAt = -1, dead = false;
    while (f < last - 1 && !dead) {
      if (plannedAt < 0 && (p.grounded || p.coyote > 0)) {
        // plan: where does staying put become fatal, and what's the widest window before it?
        const flipGood = []; let q = cloneRunner(p), dStar = -1;
        for (let d = 0; d < 110 && f + d < last - 1; d++) {
          const r = cloneRunner(q); flip(r); step(r, L, t0 + (f + d + 1) * SIM_DT, SIM_DT);
          flipGood.push((q.grounded || q.coyote > 0) && isGood(r, f + d + 1));
          step(q, L, t0 + (f + d + 1) * SIM_DT, SIM_DT);
          if (!isGood(q, f + d + 1)) { dStar = d; break; }
        }
        if (dStar >= 0) {
          let best = null;
          for (let d = 0; d <= dStar && d < flipGood.length; d++) {
            if (!flipGood[d]) continue; let e = d; while (e + 1 <= dStar && flipGood[e + 1]) e++;
            if (!best || e - d >= best[1] - best[0]) best = [d, e]; d = e;
          }
          const aim = best ? (best[0] + best[1]) / 2 : 0;
          plannedAt = f + Math.max(0, Math.round(aim + gauss() * SIGMA));
        }
      }
      if (plannedAt >= 0 && f >= plannedAt && (p.grounded || p.coyote > 0)) { flip(p); plannedAt = -1; }
      else if (plannedAt >= 0 && f >= plannedAt + 17) plannedAt = -1; // buffer expired
      step(p, L, t0 + (f + 1) * SIM_DT, SIM_DT); f++;
      if (!p.alive) dead = true;
      if (!dead && (p.grounded) && plannedAt < 0) { /* replan next frame */ }
    }
    if (!dead) wins++;
  }
  return wins / TRIALS;
}

function timeAt(L, x) { let px = 3 * TILE, t = 0; while (px < x) { px += L.speedAt(px) * SIM_DT; t += SIM_DT; } return t; }

for (const s of STAGES) {
  if (ids.length && !ids.includes(s.id)) continue;
  const L = buildStage(s, CHUNKS);
  const starts = [{ x: 3 * TILE, y: 13 * TILE - 34, g: 1 }, ...L.checkpoints];
  const out = [];
  let expected = 0;
  for (let i = 0; i < starts.length; i++) {
    const cp = starts[i];
    const goal = i + 1 < starts.length ? starts[i + 1].x + TILE : L.finishX;
    const rate = section(L, createRunner(cp.x, cp.y, cp.g), i === 0 ? 0 : timeAt(L, cp.x), goal);
    out.push(Math.round(rate * 100) + '%');
    expected += rate > 0 ? 1 / rate : 99;
  }
  console.log(`${s.id} ${s.name.padEnd(15)} sections: ${out.join('  ')}   ~${expected.toFixed(1)} attempts`);
}
