// World 1 — Drift City. Teaches the flip, then gaps, walls, islands, tunnels
// and a split route. Everything is readable at a glance.
import { mk, floorGap, ceilGap, floorSpikes, ceilSpikes, frags, arc } from './chunk.js';

export const cityChunks = [
  // --- tutorial ---------------------------------------------------------
  mk('c_start', 22, [frags(12, 9, 17, 2)]),
  mk('c_tut_up', 34, [[12, 4, 'T'], floorSpikes(13, 26), ...arc(9), frags(2, 14, 24, 2)], { diff: 1 }),
  mk('c_tut_down', 34, [[2, 4, 'T'], ceilSpikes(13, 26), ...arc(9, 1), frags(12, 14, 24, 2)], { diff: 1 }),
  mk('c_tut_gap', 32, [[12, 4, 'T'], floorGap(12, 21), ...arc(8), frags(2, 13, 21, 2)], { diff: 1 }),
  mk('c_ceil_gap', 30, [ceilGap(10, 19), frags(12, 10, 20, 2)], { diff: 1 }),

  // --- connective tissue ------------------------------------------------
  mk('c_rest', 12, [frags(12, 3, 9, 3)], { diff: 0 }),
  mk('c_restc', 12, [frags(2, 3, 9, 3)], { diff: 0 }),
  mk('c_cp', 14, [[12, 6, 'C']], { diff: 0 }),
  mk('c_cpc', 14, [[2, 6, 'C']], { diff: 0 }),
  mk('c_end', 24, [[7, 12, 'E']], { diff: 0 }),

  // --- world 1 vocabulary -----------------------------------------------
  mk('c_walls', 36, [
    ['rect', 9, 9, 12, 10, '#'],
    ['rect', 2, 22, 5, 23, '#'],
    frags(2, 7, 15, 2), frags(12, 19, 27, 2),
  ], { diff: 1 }),
  mk('c_alt', 38, [
    floorSpikes(5, 11), ceilSpikes(16, 22), floorSpikes(27, 33),
    frags(2, 6, 11, 2), frags(12, 16, 22, 2), frags(2, 27, 33, 2),
  ], { diff: 2 }),
  mk('c_gaps', 36, [
    floorGap(5, 12), ceilGap(18, 25),
    frags(2, 5, 12, 2), frags(12, 18, 25, 2),
  ], { diff: 2 }),
  // A star on the ceiling between two spike beds: a quick up-and-down.
  mk('c_star_nook', 32, [
    ceilSpikes(9, 12), ceilSpikes(16, 20), [2, 14, '*'],
    frags(12, 8, 22, 2),
  ], { diff: 2 }),
  // A star floating on the arc of a well-timed flip over a gap.
  mk('c_star_arc', 28, [floorGap(9, 17), [6, 11, '*'], frags(2, 13, 21, 2), [11, 7, 'o']], { diff: 2 }),
  // Stepped streets: floor terraces drop away like impossible stairs.
  mk('c_stairs', 40, [
    ['rect', 9, 6, 12, 11, '#'], ['rect', 10, 12, 12, 17, '#'], ['rect', 11, 18, 12, 23, '#'],
    ceilSpikes(10, 23),
    [8, 7, 'o o o'], [9, 13, 'o o o'], [10, 19, 'o o o'],
    ceilSpikes(30, 34), frags(12, 26, 34, 2),
  ], { diff: 2 }),
  // Floating islands over the void: land on their rooftops.
  mk('c_islands', 44, [
    floorGap(6, 37),
    ['rect', 8, 12, 8, 19, '='], ['rect', 8, 27, 8, 33, '='],
    ceilSpikes(14, 18), ceilSpikes(28, 32),
    frags(7, 13, 19, 2), frags(7, 28, 33, 2), frags(2, 6, 11, 2), [4, 22, '*'],
  ], { diff: 3 }),
  // A tunnel squeezes the street: short fast flips inside.
  mk('c_tunnel', 42, [
    ['rect', 10, 6, 12, 35, '#'], ['rect', 2, 12, 5, 35, '#'],
    [9, 17, '^^^'], [6, 23, 'vvv'], [9, 29, '^^^'],
    frags(2, 3, 9, 2), frags(9, 12, 16, 2), frags(6, 17, 21, 2), frags(9, 23, 27, 2), frags(6, 29, 33, 2),
  ], { diff: 3 }),
  // Split route: calm lower street, or a spiky upper route with a star.
  mk('c_split', 44, [
    ['rect', 7, 6, 8, 37, '='],
    ceilSpikes(12, 14), [6, 20, '^^^'], ceilSpikes(26, 28), [6, 32, '^^^'], [2, 18, '*'],
    floorSpikes(20, 22), [9, 30, 'vvv'],
    frags(6, 12, 16, 2), frags(2, 20, 24, 2), frags(6, 26, 30, 2),
    frags(12, 9, 17, 2), frags(9, 20, 26, 2), frags(12, 31, 36, 2),
  ], { diff: 3 }),
  mk('c_zigzag', 42, [
    floorSpikes(3, 8), ceilSpikes(11, 16), floorSpikes(19, 24), ceilSpikes(27, 32), floorSpikes(35, 39),
    frags(2, 3, 8, 2), frags(12, 11, 16, 2), frags(2, 19, 24, 2), frags(12, 27, 32, 2),
  ], { diff: 3 }),
  // Gap on both sides with a floating billboard in the middle.
  mk('c_billboard', 36, [
    floorGap(8, 25), ceilGap(8, 25),
    ['rect', 7, 6, 7, 24, '='],
    frags(6, 9, 23, 2), [8, 16, '*'],
  ], { diff: 3 }),
];
