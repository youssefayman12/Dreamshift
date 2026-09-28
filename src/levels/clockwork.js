// World 4 — Clockwork Nightmare. New ideas: giant pendulums sweeping the
// floor, gears grinding at the surfaces, flip gates that force gravity to
// change (rapid alternation), and a fractured finale of floating slabs.
import { mk, floorGap, ceilGap, floorSpikes, ceilSpikes, frags } from './chunk.js';

const pend = (phase, len = 355, amp = 0.75, period = 2.2, sync = 'on') => ({ type: 'pendulum', len, amp, period, phase, r: 20, sync });
const gear = (speed, phase = 0) => ({ type: 'rotor', arms: 4, len: 46, speed, phase, r: 9, tipR: 12, step: 17 });

export const clockChunks = [
  // Pendulums sweep the floor just as you arrive: go over them — and come
  // back down before the thorns. A star waits right behind the first swing.
  mk('k_pendulums', 40, [
    [2, 12, 'p'], ceilSpikes(19, 23), [12, 17, '*'], [2, 29, 'q'], ceilSpikes(35, 38),
    frags(2, 6, 16, 2), frags(12, 19, 23, 2), frags(2, 25, 33, 2), frags(12, 35, 38, 1),
  ], { diff: 2, ents: { p: pend(0), q: pend(0.5) } }),
  // Gears grind at floor and ceiling in turn: be on the other side.
  mk('k_gears', 40, [
    [12, 8, 'g'], [2, 16, 'h'], [12, 24, 'g'], [2, 32, 'h'],
    frags(2, 6, 10, 2), frags(12, 14, 18, 2), frags(2, 22, 26, 2), frags(12, 30, 34, 2),
  ], { diff: 2, ents: { g: gear(0.55), h: gear(-0.55, 0.125) } }),
  // Flip gates: gravity alternates on its own — ride it, or dodge a gate.
  mk('k_gates', 40, [
    [11, 6, 'F'], [3, 11, 'F'], [11, 16, 'F'], [3, 21, 'F'], [11, 26, 'F'], [3, 31, 'F'],
    [7, 8, 'o'], [7, 13, 'o'], [7, 18, 'o'], [7, 23, 'o'], [7, 28, 'o'], [7, 33, 'o'], [12, 19, '*'],
  ], { diff: 2 }),
  // Tick-tock doors that open on the beat, with a pendulum overhead.
  mk('k_tock', 40, [
    ['rect', 2, 9, 7, 10, 'B'], ['rect', 8, 9, 12, 10, 'A'],
    [2, 20, 'p'],
    ['rect', 2, 31, 7, 32, 'A'], ['rect', 8, 31, 12, 32, 'B'],
    frags(7, 4, 36, 4),
  ], { diff: 3, ents: { p: pend(0.25, 250, 0.9, 2.4) } }),
  // Rapid alternation with thorn seeds on the automatic path.
  mk('k_rapid', 44, [
    [11, 5, 'F'], [3, 10, 'F'], [11, 17, 'F'], [3, 22, 'F'], [11, 27, 'F'], [3, 32, 'F'], [11, 38, 'F'],
    [7, 19, 'x'],
    frags(12, 11, 14, 1), frags(2, 21, 24, 1), frags(12, 36, 40, 2),
  ], { diff: 3 }),
  // The fracture: architecture adrift in the void.
  mk('k_fracture', 46, [
    ceilGap(4, 39), floorGap(11, 39),
    ['rect', 5, 10, 5, 16, '='], ['rect', 10, 17, 10, 23, '='], ['rect', 4, 24, 4, 30, '='], ['rect', 9, 31, 9, 37, '='],
    frags(6, 11, 16, 2), frags(9, 18, 23, 2), frags(5, 25, 30, 2), frags(8, 32, 37, 2),
  ], { diff: 3 }),
  // Split: a gear gauntlet for a star, or a calm crawl above.
  mk('k_split', 44, [
    ['rect', 7, 6, 8, 37, '='],
    [12, 14, 'g'], [9, 22, 'h'], [12, 30, 'g'], [12, 22, '*'],
    ceilSpikes(16, 19), [6, 26, '^^^'],
    frags(2, 7, 15, 2), frags(6, 17, 23, 2), frags(2, 28, 36, 2), frags(12, 8, 12, 2),
  ], { diff: 3, ents: { g: gear(0.5), h: { ...gear(-0.5), len: 30, tipR: 10 } } }),
];
