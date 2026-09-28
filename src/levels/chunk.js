// Chunk authoring helper. A chunk starts as a standard corridor (two rows of
// ceiling, two rows of floor) and is sculpted with overlay operations:
//   [row, col, 'str']            write a string horizontally
//   ['|', col, row, 'str']       write a string vertically (downwards)
//   ['rect', r0, c0, r1, c1, ch] fill an inclusive rectangle
// Rows: 0-1 ceiling, 2 = where a ceiling-runner is, 12 = where a floor-runner is,
// 13-14 floor. Printing a chunk (tools/validate.mjs --print) shows the ASCII.
import { ROWS } from '../config.js';

export function mk(id, w, ops = [], meta = {}) {
  const g = [];
  for (let r = 0; r < ROWS; r++) g.push(new Array(w).fill(r < 2 || r > 12 ? '#' : '.'));
  for (const op of ops) {
    if (op[0] === '|') {
      const [, c, r, s] = op;
      for (let i = 0; i < s.length; i++) set(g, r + i, c, s[i], id);
    } else if (op[0] === 'rect') {
      const [, r0, c0, r1, c1, ch] = op;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) set(g, r, c, ch, id);
    } else {
      const [r, c, s] = op;
      for (let i = 0; i < s.length; i++) if (s[i] !== ' ') set(g, r, c + i, s[i], id);
    }
  }
  return { id, rows: g.map((a) => a.join('')), w, ...meta };
}

function set(g, r, c, ch, id) {
  if (r < 0 || r >= g.length || c < 0 || c >= g[0].length) {
    throw new Error(`chunk ${id}: op out of bounds at r${r} c${c}`);
  }
  g[r][c] = ch;
}

/** Gap in the floor (rows 13-14) from col a to b inclusive. */
export const floorGap = (a, b) => ['rect', 13, a, 14, b, '.'];
/** Gap in the ceiling (rows 0-1). */
export const ceilGap = (a, b) => ['rect', 0, a, 1, b, '.'];
/** Row of floor spikes (row 12) */
export const floorSpikes = (a, b) => [12, a, '^'.repeat(b - a + 1)];
export const ceilSpikes = (a, b) => [2, a, 'v'.repeat(b - a + 1)];
/** Dream fragments every `step` columns along a row. */
export function frags(r, a, b, step = 2) {
  let s = '';
  for (let c = a; c <= b; c++) s += (c - a) % step === 0 ? 'o' : ' ';
  return [r, a, s];
}
/** Arc of fragments tracing a flip from floor (dir=-1 → up) or ceiling. */
export function arc(c, dir = -1) {
  const rows = dir === -1 ? [11, 9, 6, 3] : [3, 5, 8, 11];
  return rows.map((r, i) => [r, c + i, 'o']);
}
