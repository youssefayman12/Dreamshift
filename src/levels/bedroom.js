// World 3 — Endless Bedroom. New ideas: floating books that ride up and down
// (moving platforms), stacks of books that stretch out of the floor and
// ceiling (pillars), and a turning baby mobile of thorny stars (rotors).
import { mk, floorGap, ceilGap, floorSpikes, ceilSpikes, frags } from './chunk.js';

const book = (w, ay, period, phase, sync = 'peak') => ({ type: 'mover', w, h: 1, ay, period, phase, style: 'book', sync });
const stack = (side, phase, max = 6, period = 2.4, sync) => ({ type: 'pillar', side, min: 0.2, max, period, phase, sync });
const mobile = (len, speed, arms = 2, phase = 0) => ({ type: 'rotor', len, speed, arms, phase });

export const bedroomChunks = [
  // Ride a drifting book over the void — on top, or hanging underneath.
  mk('b_books', 40, [
    floorGap(8, 33), ['|', 10, 8, 'm'], ['|', 22, 8, 'n'],
    ceilSpikes(12, 17), ceilSpikes(24, 29),
    frags(7, 11, 16, 1), frags(9, 23, 28, 1), frags(2, 19, 21, 2),
  ], { diff: 1, ents: { m: book(7, 50, 2.6, 0), n: book(7, 50, 2.6, 0.5) } }),
  // Shelves drift in turn above and below: flip from one to the next.
  mk('b_shelves', 40, [
    floorGap(5, 34), ceilGap(5, 34),
    ['|', 5, 10, 'a'], ['|', 12, 4, 'b'], ['|', 19, 10, 'a'], ['|', 26, 4, 'b'],
    frags(9, 6, 11, 2), frags(5, 13, 18, 2), frags(9, 20, 25, 2), frags(5, 27, 32, 2),
  ], { diff: 2, ents: { a: book(8, 30, 2.2, 0), b: book(9, 30, 2.2, 0.5) } }),
  // Book stacks breathe in and out of floor and ceiling in turn.
  mk('b_stacks', 40, [
    [12, 10, 'p'], [2, 10, 'q'], [12, 20, 'r'], [2, 20, 's'], [12, 30, 'p'], [2, 30, 'q'],
    frags(7, 6, 36, 3),
  ], { diff: 2, ents: { p: stack('floor', 0, 6, 2.4, 'max'), q: stack('ceil', 0.5, 6, 2.4, 'min'), r: stack('floor', 0.25, 6, 2.4, 'min'), s: stack('ceil', 0.75, 6, 2.4, 'max') } }),
  // The night mobile: turning arms of thorny stars mid-corridor.
  mk('b_mobile', 42, [
    [7, 11, 'r'], floorSpikes(8, 13), [7, 26, 's'], ceilSpikes(23, 28),
    frags(2, 8, 13, 2), frags(12, 23, 28, 2), frags(7, 17, 20, 1),
  ], { diff: 2, ents: { r: mobile(118, 0.28), s: mobile(118, -0.28, 2, 0.25) } }),
  // A star at the heart of a three-armed mobile.
  mk('b_mobile_star', 34, [
    [7, 16, 'r'], [5, 16, '*'], floorSpikes(20, 25),
    frags(12, 4, 12, 2), frags(2, 20, 25, 2),
  ], { diff: 3, ents: { r: mobile(110, 0.22, 3) } }),
  // Split room: a calm shelf road above, a stack-and-mobile road below.
  mk('b_split', 46, [
    ['rect', 7, 6, 8, 39, '='],
    [12, 14, 'p'], [11, 26, 'r'], [12, 34, 'p'], [10, 30, '*'],
    ceilSpikes(16, 19), [6, 24, '^^^'],
    frags(2, 7, 15, 2), frags(6, 17, 22, 2), frags(2, 25, 38, 2), frags(12, 16, 24, 2),
  ], { diff: 3, ents: { p: stack('floor', 0, 3.0, 2, 'max'), r: mobile(40, 0.4, 2) } }),
  // Book lifts: bigger swings, closer thorns.
  mk('b_lift', 40, [
    floorGap(8, 31), ['|', 10, 9, 'm'], ['|', 21, 7, 'n'],
    ceilSpikes(12, 18), ceilSpikes(25, 30),
    frags(8, 11, 17, 1), frags(6, 22, 28, 2), frags(2, 19, 23, 2),
  ], { diff: 3, ents: { m: book(8, 60, 2.2, 0), n: book(8, 60, 2.2, 0.3) } }),
];
