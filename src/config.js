// Core tuning. Everything that defines "game feel" lives here so it can be
// tweaked in one place and is shared by the runtime and the headless solver.

export const TILE = 36;
export const ROWS = 15;
export const WORLD_H = TILE * ROWS; // 540 world units tall playfield

export const SIM_HZ = 120;
export const SIM_DT = 1 / SIM_HZ;

export const PHYS = {
  gravity: 3900,     // units/s^2 — high so flips are snappy, never floaty
  flipKick: 420,     // initial velocity toward the new surface on flip
  maxFall: 1550,
  coyote: 0.075,     // seconds after leaving a surface where a flip still counts
  buffer: 0.14,      // seconds a press is remembered while airborne
  pw: 22,            // hitbox width  (visual is larger — forgiving)
  ph: 34,            // hitbox height
  cornerTol: 10,     // clipped corners up to this many units are nudged, not fatal
  crumbleTime: 0.5,  // seconds a crumbling block holds after being touched
  voidMargin: 70,    // how far outside the playfield before falling is fatal
};

// Framing: how many world units must always be visible.
export const VIEW = {
  minWidth: 820,
  minHeight: 600,
  anchor: 0.27, // player's horizontal screen position (fraction of width)
};

export const DEBUG = typeof location !== 'undefined' && /[?&]debug/.test(location.search);
