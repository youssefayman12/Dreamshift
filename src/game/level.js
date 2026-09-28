// Level data + runtime queries. Levels are assembled from ASCII "chunks"
// (see src/levels) so new content can be authored without touching code.
//
// Chunk legend (15 rows, any width):
//   #  solid          =  solid (alternate look)     X  crumbling block
//   A  phase block A  B  phase block B (A and B alternate on the beat)
//   ^  spike up       v  spike down    <  spike left   >  spike right
//   x  thorn orb      o  dream fragment    *  lucid star (big bonus)
//   C  checkpoint     E  exit portal       F  flip gate    T  tutorial cue
//   any other letter: custom entity from the chunk's `ents` legend
import { TILE, ROWS, WORLD_H, PHYS } from '../config.js';
import { makeSpike, makeDrifter, makeEntity, mirrorEntity } from './entities.js';

export const T_EMPTY = 0, T_SOLID = 1, T_SOLID2 = 2, T_CRUMBLE = 3, T_PHASEA = 4, T_PHASEB = 5;
const BIN = 8; // columns per spatial bin

const SOLID_CHARS = { '#': T_SOLID, '=': T_SOLID2, X: T_CRUMBLE, A: T_PHASEA, B: T_PHASEB };
const SPIKE_CHARS = { '^': 'u', v: 'd', '<': 'l', '>': 'r' };
const MIRROR_CHAR = { '^': 'v', v: '^' };

export function mirrorRows(rows) {
  return rows.slice().reverse().map((row) => row.replace(/[\^v]/g, (ch) => MIRROR_CHAR[ch]));
}

export class Level {
  constructor(opts = {}) {
    this.speed0 = opts.speed?.[0] ?? 340;
    this.speed1 = opts.speed?.[1] ?? this.speed0;
    this.speedRampLen = opts.speedRampLen ?? 0; // 0 => ramp over whole level
    this.speedMax = opts.speedMax ?? this.speed1;
    this.endless = !!opts.endless;
    this.phasePeriod = opts.phasePeriod ?? 2.0;
    this.cols = [];        // array of Uint8Array(ROWS)
    this.styles = [];      // per column: theme id for rendering (endless blends worlds)
    this.colOffset = 0;    // columns dropped from the front (endless)
    this.bins = new Map(); // bin -> hazards[]
    this.hazards = [];
    this.kinematics = [];
    this.pickups = [];
    this.checkpoints = [];
    this.gates = [];
    this.tutors = [];
    this.events = [];
    this.chunkMarks = [];  // {x, id} for debugging / analytics
    this.finishX = Infinity;
    this.portal = null;
    this.theme = opts.theme ?? 'city';
  }

  get width() { return (this.colOffset + this.cols.length) * TILE; }
  get colCount() { return this.colOffset + this.cols.length; }

  speedAt(x) {
    if (this.endless) {
      // Gentle ramp that keeps getting faster but never unreadable.
      const k = Math.min(1, x / (this.speedRampLen || 60000));
      return this.speed0 + (this.speedMax - this.speed0) * (1 - Math.pow(1 - k, 1.6));
    }
    const len = this.speedRampLen || this.finishX || 1;
    const k = Math.max(0, Math.min(1, x / len));
    return this.speed0 + (this.speed1 - this.speed0) * k;
  }

  // ------------------------------------------------------------ building

  appendChunk(chunk, opts = {}) {
    const mirror = !!opts.mirror;
    const rows = mirror ? mirrorRows(chunk.rows) : chunk.rows;
    if (rows.length !== ROWS) throw new Error(`Chunk ${chunk.id} has ${rows.length} rows`);
    const w = rows[0].length;
    for (const row of rows) {
      if (row.length !== w) throw new Error(`Chunk ${chunk.id} has ragged rows`);
    }
    const c0 = this.colCount;
    const style = opts.style ?? chunk.style ?? this.theme;
    this.chunkMarks.push({ x: c0 * TILE, id: chunk.id + (mirror ? '~' : ''), w });
    for (let cc = 0; cc < w; cc++) {
      const col = new Uint8Array(ROWS);
      for (let r = 0; r < ROWS; r++) {
        const ch = rows[r][cc];
        const c = c0 + cc;
        if (SOLID_CHARS[ch] !== undefined) { col[r] = SOLID_CHARS[ch]; continue; }
        if (ch === '.' || ch === ' ') continue;
        if (SPIKE_CHARS[ch]) { this.addHazard(makeSpike(c, r, SPIKE_CHARS[ch])); continue; }
        const x = c * TILE, y = r * TILE;
        switch (ch) {
          case 'x': this.addHazard(makeDrifter(x + TILE / 2, y + TILE / 2)); break;
          case 'o': this.pickups.push({ id: this.pickups.length, type: 'frag', x: x + TILE / 2, y: y + TILE / 2 }); break;
          case '*': this.pickups.push({ id: this.pickups.length, type: 'star', x: x + TILE / 2, y: y + TILE / 2 }); break;
          case 'C':
            if (!this.endless) this.checkpoints.push(this.makeCheckpoint(c, r, col, rows, cc));
            break;
          case 'E':
            if (!this.endless) { this.finishX = x; this.portal = { x, y: y + TILE / 2 }; }
            break;
          case 'F': this.gates.push({ id: this.gates.length, x: x + 6, y: y - TILE, w: TILE - 12, h: TILE * 3 }); break;
          case 'T':
            if (!this.endless) this.tutors.push({ x, kind: chunk.tutor ?? 'flip', r }); break;
          default: {
            const def = chunk.ents?.[ch];
            if (!def) throw new Error(`Chunk ${chunk.id}: unknown char '${ch}'`);
            // Entities are defined in un-mirrored space; mirror geometry after.
            const rr = mirror ? ROWS - 1 - r : r;
            let e = makeEntity(def, c, rr);
            if (mirror) e = mirrorEntity(e);
            if (e.solid) this.kinematics.push(e);
            else this.addHazard(e);
          }
        }
      }
      this.cols.push(col);
      this.styles.push(style);
    }
    if (chunk.events) {
      for (const ev of chunk.events) this.events.push({ ...ev, x: (c0 + (ev.col ?? 0)) * TILE });
    }
    return c0;
  }

  makeCheckpoint(c, r, colSoFar, rows, cc) {
    // Gravity for respawn is chosen by which half of the playfield C is in.
    const g = r >= ROWS / 2 ? 1 : -1;
    let rr = r;
    if (g === 1) { while (rr < ROWS && !SOLID_CHARS[rows[rr][cc]]) rr++; }
    else { while (rr >= 0 && !SOLID_CHARS[rows[rr][cc]]) rr--; }
    const y = g === 1 ? rr * TILE - PHYS.ph : (rr + 1) * TILE;
    return { id: this.checkpoints.length, x: c * TILE, y, g, r };
  }

  addEvent(type, params = {}) {
    this.events.push({ type, ...params, x: this.colCount * TILE + (params.dx ?? 0) });
  }

  addHazard(h) {
    this.hazards.push(h);
    const b0 = Math.floor(h.minX / TILE / BIN), b1 = Math.floor(h.maxX / TILE / BIN);
    for (let b = b0; b <= b1; b++) {
      let arr = this.bins.get(b);
      if (!arr) this.bins.set(b, (arr = []));
      arr.push(h);
    }
  }

  finalize() {
    this.pickups.sort((a, b) => a.x - b.x);
    this.pickups.forEach((p, i) => (p.id = i));
    this.gates.sort((a, b) => a.x - b.x);
    this.gates.forEach((g, i) => (g.id = i));
    this.checkpoints.sort((a, b) => a.x - b.x);
    this.events.sort((a, b) => a.x - b.x);
    if (!this.endless && !isFinite(this.finishX)) this.finishX = this.width - TILE * 4;
    this.starCount = this.pickups.filter((p) => p.type === 'star').length;
    this.fragCount = this.pickups.filter((p) => p.type === 'frag').length;
    return this;
  }

  /** Drop columns far behind the player (endless mode memory bound). */
  trimBefore(x) {
    const c = Math.floor(x / TILE) - this.colOffset;
    if (c < 64) return;
    const drop = c - 32;
    this.cols.splice(0, drop);
    this.styles.splice(0, drop);
    this.colOffset += drop;
    const minX = this.colOffset * TILE;
    const keep = (e) => (e.maxX ?? e.x + (e.w || 0) + 200) >= minX;
    this.hazards = this.hazards.filter(keep);
    this.kinematics = this.kinematics.filter(keep);
    for (const b of [...this.bins.keys()]) if ((b + 1) * BIN * TILE < minX) this.bins.delete(b);
    this.pickups = this.pickups.filter((p) => p.x >= minX - 100);
    this.events = this.events.filter((e) => e.x >= minX - 2000);
  }

  // ------------------------------------------------------------ queries

  tile(c, r) {
    if (r < 0 || r >= ROWS) return T_EMPTY;
    const col = this.cols[c - this.colOffset];
    return col ? col[r] : T_EMPTY;
  }

  styleAt(c) { return this.styles[c - this.colOffset] ?? this.theme; }

  phaseOn(type, t) {
    const P = this.phasePeriod;
    const m = ((t % P) + P) % P;
    return type === T_PHASEA ? m < P / 2 : m >= P / 2;
  }

  /** Is tile (c,r) solid for runner p at time t. */
  solidTile(c, r, t, p) {
    const ty = this.tile(c, r);
    if (ty === T_EMPTY) return false;
    if (ty === T_SOLID || ty === T_SOLID2) return true;
    if (ty === T_CRUMBLE) {
      const trig = p?.crumbles?.get(c * ROWS + r);
      return trig === undefined || t < trig + PHYS.crumbleTime;
    }
    if (ty === T_PHASEA || ty === T_PHASEB) {
      if (!this.phaseOn(ty, t)) return false;
      if (p?.phaseIgnore && p.phaseIgnore.includes(c * ROWS + r)) return false;
      return true;
    }
    return false;
  }

  /**
   * Collect solid rects overlapping the given box at time t. Returns count;
   * rects are written into `out` as flat [x,y,w,h,kinIndex] tuples.
   */
  overlaps(x, y, w, h, t, p, out) {
    let n = 0;
    const c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 1e-6) / TILE);
    const r0 = Math.max(0, Math.floor(y / TILE)), r1 = Math.min(ROWS - 1, Math.floor((y + h - 1e-6) / TILE));
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        if (this.solidTile(c, r, t, p)) {
          out[n++] = c * TILE; out[n++] = r * TILE; out[n++] = TILE; out[n++] = TILE; out[n++] = -1;
        }
      }
    }
    const ks = this.kinematics;
    for (let i = 0; i < ks.length; i++) {
      const k = ks[i];
      if (k.maxX < x || k.minX > x + w) continue;
      const R = k.rectAt(t, TMP);
      if (x < R.x + R.w && x + w > R.x && y < R.y + R.h && y + h > R.y) {
        out[n++] = R.x; out[n++] = R.y; out[n++] = R.w; out[n++] = R.h; out[n++] = i;
      }
    }
    return n / 5;
  }

  hazardsAround(x, cb) {
    const b = Math.floor(x / TILE / BIN);
    for (let k = b - 1; k <= b + 1; k++) {
      const arr = this.bins.get(k);
      if (arr) for (let i = 0; i < arr.length; i++) cb(arr[i]);
    }
  }
}

const TMP = { x: 0, y: 0, w: 0, h: 0 };

/** Assemble a level from a stage definition and chunk library. */
export function buildStage(stage, lib) {
  const L = new Level({ speed: stage.speed, phasePeriod: stage.phasePeriod, theme: stage.world });
  for (const part of stage.parts) {
    if (typeof part === 'string') {
      const [id, flag] = part.split('~');
      const chunk = lib[id];
      if (!chunk) throw new Error(`Stage ${stage.id}: unknown chunk ${id}`);
      L.appendChunk(chunk, { mirror: flag === '' || flag === 'm' });
    } else if (part.event) {
      L.addEvent(part.event, part);
    }
  }
  return L.finalize();
}

export { WORLD_H };
