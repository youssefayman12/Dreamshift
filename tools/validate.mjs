// Headless level validator. For every stage it proves the level is beatable
// from the start and from every checkpoint, and measures how wide each
// required flip's timing window is (frames at 120 Hz).
//
//   node tools/validate.mjs            all stages
//   node tools/validate.mjs 1-2        one stage
//   node tools/validate.mjs --print c_split   print a chunk's ASCII
//   node tools/validate.mjs --chunks   solve every chunk in isolation (endless pool)
import { TILE, SIM_DT, PHYS } from '../src/config.js';
import { buildStage, Level } from '../src/game/level.js';
import { createRunner, cloneRunner, flip, step } from '../src/game/sim.js';
import { explore, pathTo } from '../src/game/solver.js';
import { STAGES, CHUNKS } from '../src/levels/stages.js';

const args = process.argv.slice(2);

if (args[0] === '--print') {
  for (const id of args.slice(1)) {
    const c = CHUNKS[id];
    console.log(`\n${id} (${c.w} cols)`);
    const ruler = [...Array(c.w)].map((_, i) => (i % 10 === 0 ? String(i / 10 % 10) : ' ')).join('');
    console.log('    ' + ruler);
    c.rows.forEach((r, i) => console.log(String(i).padStart(2) + '  ' + r));
  }
  process.exit(0);
}

function timeAt(L, x) {
  let px = 3 * TILE, t = 0;
  while (px < x) { px += L.speedAt(px) * SIM_DT; t += SIM_DT; }
  return t;
}

function analyze(L, start, t0, goalX) {
  const res = explore(L, start, t0, goalX, { every: 1, maxStates: 3000 });
  if (!res.ok) return { ok: false, x: res.x, col: Math.floor(res.x / TILE) };
  const nodes = res.nodes;
  // Backward pass: which keys at each frame can still reach the goal.
  const goodIdx = nodes.map(() => new Set());
  nodes[nodes.length - 1].forEach((_, i) => goodIdx[nodes.length - 1].add(i));
  for (let f = nodes.length - 1; f > 0; f--) {
    for (const i of goodIdx[f]) {
      const n = nodes[f][i];
      goodIdx[f - 1].add(n.parent);
      for (const a of n.alt) goodIdx[f - 1].add(a);
    }
  }
  const goodKeys = nodes.map((arr, f) => new Set([...goodIdx[f]].map((i) => arr[i].key)));
  // Canonical path: pick the final node whose path has the fewest flips.
  let best = null;
  for (let i = 0; i < Math.min(nodes[nodes.length - 1].length, 40); i++) {
    const fl = pathTo(nodes, i);
    if (!best || fl.length < best.length) best = fl;
  }
  // Replay canonical path, recording states before each frame.
  const states = [];
  const p = cloneRunner(start);
  const flipSet = new Set(best);
  for (let f = 0; f < nodes.length - 1; f++) {
    states.push(cloneRunner(p));
    if (flipSet.has(f)) flip(p);
    step(p, L, t0 + (f + 1) * SIM_DT, SIM_DT);
  }
  const keyOf = (q) => {
    // must mirror solver key
    let k = `${Math.round(q.y * 2)}|${Math.round(q.vy / 6)}|${q.g}|${q.grounded ? 1 : 0}|${q.lastGate}|${q.coyote > 0 ? 1 : 0}`;
    if (q.crumbles.size) {
      const minC = Math.floor(q.x / TILE) - 2;
      const ks = [];
      for (const [c] of q.crumbles) if (Math.floor(c / 15) >= minC) ks.push(c);
      if (ks.length) k += '|' + ks.sort((a, b) => a - b).join(',');
    }
    return k;
  };
  const tryFlipAt = (f) => {
    if (f < 0 || f >= states.length - 1) return false;
    const q = cloneRunner(states[f]);
    if (!(q.grounded || q.coyote > 0)) return false;
    flip(q);
    step(q, L, t0 + (f + 1) * SIM_DT, SIM_DT);
    return q.alive && goodKeys[f + 1].has(keyOf(q));
  };
  const windows = [];
  for (let k = 0; k < best.length; k++) {
    const F = best[k];
    const prevF = k > 0 ? best[k - 1] : -1, nextF = k < best.length - 1 ? best[k + 1] : Infinity;
    let lo = 0, hi = 0;
    while (F - lo - 1 > prevF && tryFlipAt(F - lo - 1)) lo++;
    // Later flips: states after F on canonical path include the flip; replay a no-flip branch.
    const q = cloneRunner(states[F]);
    for (let d = 1; d < 40 && F + d < nextF && F + d < states.length - 1; d++) {
      step(q, L, t0 + (F + d) * SIM_DT, SIM_DT);
      if (!q.alive || !(q.grounded || q.coyote > 0)) break;
      const r = cloneRunner(q);
      flip(r);
      step(r, L, t0 + (F + d + 1) * SIM_DT, SIM_DT);
      if (!(r.alive && goodKeys[F + d + 1].has(keyOf(r)))) break;
      hi++;
    }
    windows.push({ col: Math.floor(states[F].x / TILE), frames: lo + hi + 1 });
  }
  return { ok: true, flips: best.length, windows, seconds: nodes.length * SIM_DT };
}

let failed = 0;
function report(label, L, start, t0, goalX) {
  const r = analyze(L, start, t0, goalX);
  if (!r.ok) {
    failed++;
    const mark = L.chunkMarks.filter((m) => m.x <= r.x).pop();
    console.log(`  ✗ ${label}: STUCK at col ${r.col} (chunk ${mark?.id} +${r.col - Math.floor(mark.x / TILE)})`);
    return;
  }
  const tight = r.windows.filter((w) => w.frames < 12).sort((a, b) => a.frames - b.frames);
  const min = r.windows.reduce((m, w) => Math.min(m, w.frames), 99);
  const tightStr = tight.slice(0, 6).map((w) => {
    const mark = L.chunkMarks.filter((m) => m.x <= w.col * TILE).pop();
    return `${mark.id}+${w.col - mark.x / TILE}:${w.frames}f`;
  }).join(' ');
  console.log(`  ✓ ${label}: ${r.seconds.toFixed(1)}s, ${r.flips} flips, min window ${min}f ${tight.length ? '| tight: ' + tightStr : ''}`);
}

if (args[0] === '--chunks') {
  for (const id of Object.keys(CHUNKS)) {
    const c = CHUNKS[id];
    if (c.diff === undefined || c.noEndless) continue;
    for (const mirror of [false, true]) for (const sp of [360, 520]) {
      const L = new Level({ speed: [sp, sp], endless: true });
      L.appendChunk(CHUNKS.c_rest); L.appendChunk(c, { mirror }); L.appendChunk(CHUNKS.c_rest); L.appendChunk(CHUNKS.c_rest);
      L.finalize();
      for (const g of [1, -1]) {
        const start = createRunner(TILE * 2, g === 1 ? 13 * TILE - PHYS.ph : 2 * TILE, g);
        const res = explore(L, start, 0, (12 + c.w + 6) * TILE, { every: 2, keepPaths: false, maxStates: 1500 });
        if (!res.ok) { console.log(`  ✗ ${id}${mirror ? '~' : ''} @${sp} g${g}: stuck col ${Math.floor(res.x / TILE) - 12}`); failed++; }
      }
    }
  }
  console.log(failed ? `${failed} failures` : 'all chunks ok');
  process.exit(failed ? 1 : 0);
}

for (const s of STAGES) {
  if (args.length && !args.includes(s.id)) continue;
  const L = buildStage(s, CHUNKS);
  const cols = L.colCount;
  console.log(`${s.id} ${s.name}: ${cols} cols, ${L.fragCount} fragments, ${L.starCount} stars, ${L.checkpoints.length} checkpoints, ~${timeAt(L, L.finishX).toFixed(1)}s`);
  const start = createRunner(3 * TILE, 13 * TILE - PHYS.ph, 1);
  report('start', L, start, 0, L.finishX);
  for (const cp of L.checkpoints) {
    const r = createRunner(cp.x, cp.y, cp.g);
    report(`cp@${cp.x / TILE}`, L, r, timeAt(L, cp.x), L.finishX);
  }
}
if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
