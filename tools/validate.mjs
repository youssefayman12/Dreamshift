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

// Must mirror the solver's state key.
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
  // "Sensible human" route: stay put until staying put becomes fatal, then
  // flip in the middle of the widest window of good timings before that.
  const isGood = (q, f) => q.alive && goodKeys[f].has(keyOf(q));
  let p = cloneRunner(start);
  let f = 0;
  const windows = [];
  const last = nodes.length - 1;
  const H = 110;
  let flips = 0;
  while (f < last - 1) {
    if (!(p.grounded || p.coyote > 0)) {
      step(p, L, t0 + (f + 1) * SIM_DT, SIM_DT); f++;
      if (!p.alive) return { ok: true, flips, windows, seconds: nodes.length * SIM_DT, lost: f, lostCol: Math.floor(p.x / TILE) };
      continue;
    }
    // Scan ahead on the no-flip continuation.
    const flipGood = [];
    let q = cloneRunner(p), dStar = -1;
    for (let d = 0; d < H && f + d < last - 1; d++) {
      const r = cloneRunner(q); flip(r); step(r, L, t0 + (f + d + 1) * SIM_DT, SIM_DT);
      flipGood.push((q.grounded || q.coyote > 0) && isGood(r, f + d + 1));
      step(q, L, t0 + (f + d + 1) * SIM_DT, SIM_DT);
      if (!isGood(q, f + d + 1)) { dStar = d; break; }
    }
    if (dStar < 0) {
      // No flip needed within the horizon: advance a chunk of frames.
      const adv = Math.max(1, Math.min(30, flipGood.length));
      for (let k = 0; k < adv && f < last - 1; k++) { step(p, L, t0 + (f + 1) * SIM_DT, SIM_DT); f++; }
      continue;
    }
    // Widest interval of good flip frames in [0, dStar].
    let best = null;
    for (let d = 0; d <= dStar && d < flipGood.length; d++) {
      if (!flipGood[d]) continue;
      let e = d; while (e + 1 <= dStar && flipGood[e + 1]) e++;
      if (!best || e - d >= best[1] - best[0]) best = [d, e];
      d = e;
    }
    if (!best && process.env.DBG) {
      console.log('LOST state', { y: p.y, vy: p.vy, g: p.g, gr: p.grounded, coy: p.coyote, x: p.x / TILE, dStar, fg: flipGood.slice(0, 5), good: isGood(p, f) });
    }
    if (!best) return { ok: true, flips, windows, seconds: nodes.length * SIM_DT, lost: f, lostCol: Math.floor(p.x / TILE) };
    const at = Math.floor((best[0] + best[1]) / 2);
    for (let k = 0; k < at; k++) { step(p, L, t0 + (f + 1) * SIM_DT, SIM_DT); f++; }
    // Only count windows that aren't truncated by the level end.
    if (last - f > 60) windows.push({ col: Math.floor(p.x / TILE), frames: best[1] - best[0] + 1 });
    flip(p); flips++;
    step(p, L, t0 + (f + 1) * SIM_DT, SIM_DT); f++;
  }
  return { ok: true, flips, windows, seconds: nodes.length * SIM_DT };
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
  if (r.lost) {
    const mark = L.chunkMarks.filter((m) => m.x <= r.lostCol * TILE).pop();
    console.log(`  ! ${label}: human-policy route lost at ${mark.id}+${r.lostCol - mark.x / TILE}`);
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
      const phased = c.rows.some((r) => /[AB]/.test(r)) || c.ents;
      for (const g of [1, -1]) for (const t0 of phased ? [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1] : [0]) {
        const start = createRunner(TILE * 2, g === 1 ? 13 * TILE - PHYS.ph : 2 * TILE, g);
        const res = explore(L, start, t0, (12 + c.w + 6) * TILE, { every: 2, keepPaths: false, maxStates: 1500 });
        if (!res.ok) { console.log(`  ✗ ${id}${mirror ? '~' : ''} @${sp} g${g} t${t0}: stuck col ${Math.floor(res.x / TILE) - 12}`); failed++; }
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
