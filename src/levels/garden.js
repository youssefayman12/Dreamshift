// World 2 — Moonlit Garden. New ideas: petal bridges that collapse under
// you (X), blooms that open and close on the beat (A/B), thorn seeds (x) and
// drifting seeds that bob through the flight paths.
import { mk, floorGap, ceilGap, floorSpikes, ceilSpikes, frags } from './chunk.js';

const drift = (phase = 0, ay = 105, period = 1.8) => ({ type: 'drifter', ay, period, phase, r: 13 });

export const gardenChunks = [
  // A petal bridge over the void: it falls a moment after you touch it.
  mk('g_petals', 34, [
    floorGap(6, 25), ['rect', 13, 6, 13, 25, 'X'],
    frags(12, 6, 9, 1), frags(2, 11, 25, 2),
  ], { diff: 1 }),
  // Crumbling ceiling segments over thorn beds: hop up, then hop off in time.
  mk('g_petal_hops', 36, [
    ceilGap(9, 31), ['rect', 1, 9, 1, 14, 'X'], ['rect', 1, 21, 1, 26, 'X'],
    floorSpikes(10, 14), floorSpikes(22, 26),
    frags(2, 9, 13, 2), frags(2, 21, 25, 2), frags(12, 16, 19, 3), [7, 17, '*'],
  ], { diff: 2 }),
  // Blooms open on the beat: floor and ceiling take turns existing.
  mk('g_bloom', 38, [
    floorGap(5, 34), ceilGap(5, 34),
    ['rect', 13, 5, 13, 34, 'A'], ['rect', 1, 5, 1, 34, 'B'],
    frags(7, 6, 34, 4),
  ], { diff: 2 }),
  // Split doors: glowing halves block one side at a time.
  mk('g_doors', 40, [
    ['rect', 2, 9, 7, 10, 'B'], ['rect', 8, 9, 12, 10, 'A'],
    ['rect', 2, 21, 7, 22, 'B'], ['rect', 8, 21, 12, 22, 'A'],
    ['rect', 2, 33, 7, 34, 'B'], ['rect', 8, 33, 12, 34, 'A'],
    frags(7, 3, 38, 3), [7, 27, '*'],
  ], { diff: 3 }),
  // Thorn seeds hang exactly where lazy flips would go.
  mk('g_orbs', 38, [
    floorSpikes(4, 9), [7, 12, 'x'], ceilSpikes(15, 20), [6, 23, 'x'], floorSpikes(26, 31), [8, 34, 'x'],
    frags(2, 4, 9, 2), frags(12, 15, 20, 2), frags(2, 26, 31, 2), [10, 12, '*'],
  ], { diff: 2 }),
  // Drifting seeds bob up and down through the corridor.
  mk('g_drifters', 40, [
    [7, 10, 'd'], [7, 20, 'e'], [7, 30, 'd'],
    floorSpikes(12, 17), ceilSpikes(22, 27), floorSpikes(32, 37),
    frags(2, 12, 17, 2), frags(12, 22, 27, 2), frags(2, 32, 37, 2),
  ], { diff: 3, ents: { d: drift(0), e: drift(0.5) } }),
  // A star perched on a crumbling ledge floating mid-air.
  mk('g_star_petal', 32, [
    ['rect', 8, 11, 8, 16, 'X'], [7, 15, '*'],
    ceilSpikes(17, 22),
    frags(2, 4, 10, 2), frags(12, 12, 24, 3),
  ], { diff: 2 }),
  // Split garden: calm moss path below, seeds and a star above.
  mk('g_split', 44, [
    ['rect', 7, 6, 8, 37, '='],
    [4, 13, 'x'], ceilSpikes(18, 20), [4, 26, 'x'], [2, 30, '*'], [6, 33, '^^'],
    floorSpikes(20, 23), [9, 29, 'vvv'],
    frags(2, 7, 12, 2), frags(6, 15, 19, 2), frags(2, 22, 28, 2),
    frags(12, 8, 18, 2), frags(9, 20, 25, 2), frags(12, 31, 36, 2),
  ], { diff: 3 }),
  // Blooms with a star on a narrow B-bloom island.
  mk('g_bloom_star', 36, [
    floorGap(5, 30), ceilGap(5, 30),
    ['rect', 13, 5, 13, 16, 'A'], ['rect', 1, 12, 1, 22, 'B'], ['rect', 13, 19, 13, 30, 'A'],
    [2, 17, '*'], frags(12, 6, 15, 3), frags(12, 21, 30, 3),
  ], { diff: 3, noEndless: true }),
];
