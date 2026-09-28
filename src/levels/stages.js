// Stage + world definitions. A stage is a list of chunk ids (append '~' to
// mirror a chunk floor<->ceiling) interleaved with set-piece events.
import { cityChunks } from './city.js';

export const CHUNKS = {};
function register(world, list) {
  for (const c of list) {
    if (CHUNKS[c.id]) throw new Error('Duplicate chunk ' + c.id);
    c.world = world;
    // Chunks with tutorial cues, checkpoints or exits never enter endless mode.
    if (c.rows.some((r) => /[TCE]/.test(r))) c.noEndless = true;
    CHUNKS[c.id] = c;
  }
}
register('city', cityChunks);

export const STAGES = [
  {
    id: '1-1', world: 'city', name: 'First Drift', speed: [320, 350],
    parts: [
      'c_start', { event: 'moonrise' }, 'c_tut_up', 'c_tut_down', 'c_rest', 'c_tut_gap', 'c_ceil_gap',
      'c_cp', 'c_walls', 'c_star_nook', 'c_alt', 'c_rest', 'c_gaps',
      'c_cp', 'c_star_arc', 'c_walls~', 'c_star_nook~', 'c_zigzag', 'c_end',
    ],
  },
  {
    id: '1-2', world: 'city', name: 'Upside Streets', speed: [340, 375],
    parts: [
      'c_start', 'c_stairs', 'c_alt~', 'c_cp', { event: 'cityspin' }, 'c_islands', 'c_split',
      'c_cp', 'c_tunnel', 'c_gaps~', 'c_cpc', 'c_billboard', 'c_stairs~', 'c_zigzag~', 'c_end',
    ],
  },
  {
    id: '1-3', world: 'city', name: 'The Inversion', speed: [360, 400],
    parts: [
      'c_start', 'c_zigzag', 'c_tunnel~', 'c_cp', { event: 'invert', on: true }, 'c_split~', 'c_islands~',
      'c_cp', { event: 'invert', on: false }, 'c_billboard~', 'c_zigzag~', 'c_cp', 'c_tunnel', 'c_split', 'c_end',
    ],
  },
];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));

export const WORLD_META = {
  city: { name: 'Drift City', blurb: 'A floating city that forgot which way is up.', color: '#8ff6ff' },
  garden: { name: 'Moonlit Garden', blurb: 'Giant blooms, upward waterfalls and a low moon.', color: '#9dffcf' },
  bedroom: { name: 'Endless Bedroom', blurb: 'The furniture grew while you slept.', color: '#ffd9a0' },
  clockwork: { name: 'Clockwork Nightmare', blurb: 'Time is broken. Keep moving.', color: '#ffb34d' },
};

export const WORLDS = Object.keys(WORLD_META)
  .map((id) => ({ id, ...WORLD_META[id], stages: STAGES.filter((s) => s.world === id).map((s) => s.id) }))
  .filter((w) => w.stages.length);
