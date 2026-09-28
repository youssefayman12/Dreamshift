// Endless Dream: streams validated chunks ahead of the runner, ramps the
// difficulty, and drifts seamlessly from one Dream World into the next.
import { TILE } from '../config.js';
import { Level } from './level.js';
import { CHUNKS, WORLD_META } from '../levels/stages.js';
import { mulberry32 } from '../engine/math.js';

const WORLD_LEN = 760;   // columns per world before drifting onward
const AHEAD = 90;        // columns kept generated ahead of the runner

export class EndlessDirector {
  constructor(worlds, seed = (Math.random() * 1e9) | 0) {
    this.worlds = worlds;         // ordered list of unlocked world ids
    this.rng = mulberry32(seed);
    this.level = new Level({ endless: true, speed: [345, 345], speedMax: 560, speedRampLen: 70000, theme: worlds[0] });
    this.worldIdx = 0;
    this.worldStartCol = 0;
    this.boundaries = [];         // {x, from, to}
    this.lastIds = [];
    this.pools = {};
    for (const w of worlds) {
      this.pools[w] = Object.values(CHUNKS).filter((c) => c.diff !== undefined && c.diff > 0 && !c.noEndless && c.world === w);
    }
    this.append('c_start', false);
    this.fill(0);
  }

  get world() { return this.worlds[this.worldIdx % this.worlds.length]; }
  get worldName() { return WORLD_META[this.world]?.name ?? ''; }

  maxDiff(col) {
    if (col < 150) return 1;
    if (col < 450) return 2;
    if (col < 1100) return 3;
    return 4;
  }

  append(id, mirror, safe = false) {
    const L = this.level;
    const c = CHUNKS[id];
    L.appendChunk(c, { mirror, style: this.world });
    const mark = L.chunkMarks[L.chunkMarks.length - 1];
    mark.safe = safe || c.diff === 0;
    this.lastIds.push(id);
    if (this.lastIds.length > 4) this.lastIds.shift();
  }

  fill(runnerX) {
    const L = this.level;
    const need = Math.floor(runnerX / TILE) + AHEAD;
    while (L.colCount < need) {
      const col = L.colCount;
      if (col - this.worldStartCol > WORLD_LEN && this.worlds.length > 1) {
        const from = this.world;
        this.worldIdx++;
        this.worldStartCol = col;
        this.boundaries.push({ x: col * TILE, from, to: this.world });
        this.append('c_rest', false, true);
        this.append('c_rest', false, true);
        continue;
      }
      const maxD = this.maxDiff(col);
      const pool = this.pools[this.world].filter((c) => c.diff <= maxD && !this.lastIds.includes(c.id));
      if (!pool.length) { this.append('c_rest', false, true); continue; }
      // Bias towards the harder end of what's allowed.
      pool.sort((a, b) => a.diff - b.diff);
      const pick = pool[Math.floor(Math.pow(this.rng(), 0.7) * pool.length)];
      this.append(pick.id, this.rng() < 0.5);
      if (this.rng() < 0.45) this.append('c_rest', false, true);
    }
    L.finalize();
    L.trimBefore(runnerX - 40 * TILE);
  }
}
