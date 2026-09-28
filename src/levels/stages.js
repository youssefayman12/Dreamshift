// Stage + world definitions. A stage is a list of chunk ids (append '~' to
// mirror a chunk floor<->ceiling) interleaved with set-piece events.
import { cityChunks } from './city.js';
import { gardenChunks } from './garden.js';
import { bedroomChunks } from './bedroom.js';
import { clockChunks } from './clockwork.js';

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
register('garden', gardenChunks);
register('bedroom', bedroomChunks);
register('clockwork', clockChunks);

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
    id: '1-2', world: 'city', name: 'Upside Streets', hint: 'Land on floating rooftops — any surface works', speed: [340, 375],
    parts: [
      'c_start', 'c_stairs', 'c_alt~', 'c_cp', { event: 'cityspin' }, 'c_islands', 'c_split',
      'c_cp', 'c_tunnel', 'c_gaps~', 'c_cpc', 'c_billboard', 'c_stairs~', 'c_zigzag~', 'c_end',
    ],
  },
  {
    id: '1-3', world: 'city', name: 'The Inversion', hint: 'The city is about to turn over', speed: [360, 400],
    parts: [
      'c_start', 'c_zigzag', 'c_tunnel~', 'c_cp', { event: 'invert', on: true }, 'c_split~', 'c_islands~!',
      'c_cp', { event: 'invert', on: false }, 'c_billboard~', 'c_zigzag~', 'c_cp', 'c_tunnel', 'c_split', 'c_end',
    ],
  },
  {
    id: '2-1', world: 'garden', name: 'Petal Fall', hint: 'Petal bridges fall a moment after you touch them', speed: [350, 380],
    parts: [
      'c_start', 'g_petals', 'c_alt', 'c_cp', 'g_orbs!', 'g_petal_hops', 'c_rest', 'g_star_petal',
      'c_cp', 'g_petals~', 'c_zigzag', 'g_orbs~!', 'g_star_petal~', 'c_gaps', 'c_end',
    ],
  },
  {
    id: '2-2', world: 'garden', name: 'Blooming Hours', hint: 'Blooms open on the beat — a glowing outline means solid soon', speed: [360, 390],
    parts: [
      'c_start', 'g_bloom', 'c_rest', 'g_orbs!', 'c_cp', 'g_doors', 'c_rest', 'g_bloom_star',
      'c_cp', 'g_bloom~', 'g_petal_hops~!', 'g_doors~!', 'c_cp', 'g_split', 'c_end',
    ],
  },
  {
    id: '2-3', world: 'garden', name: 'Upward Falls', hint: 'Seeds drift through the air — time your flips', speed: [375, 410],
    parts: [
      'c_start', { event: 'bloom' }, 'g_drifters', 'g_petal_hops~!', 'c_cp', 'g_split~', 'g_doors!',
      'g_drifters~', 'c_cp', { event: 'lunar' }, 'g_bloom', 'g_star_petal', 'g_orbs~!', 'c_cp', 'g_split', 'g_petals', 'c_end',
    ],
  },
  {
    id: '3-1', world: 'bedroom', name: 'Shelf Walk', hint: 'Ride the drifting books', speed: [370, 400],
    parts: [
      'c_start', 'b_books', 'c_alt', 'c_cp', 'b_shelves', 'c_star_nook', 'b_books~', 'c_cp',
      'b_lift', 'c_star_arc', 'b_shelves~', 'c_star_nook~', 'c_end',
    ],
  },
  {
    id: '3-2', world: 'bedroom', name: 'Book Towers', hint: 'Book stacks stretch out of floor and ceiling', speed: [380, 410],
    parts: [
      'c_start', 'b_stacks', 'c_rest', 'b_books', 'c_cp', 'b_stacks~', 'b_split', 'c_cp',
      'b_lift~', 'b_stacks', 'g_orbs', 'c_star_arc', 'c_end',
    ],
  },
  {
    id: '3-3', world: 'bedroom', name: 'Night Mobile', hint: 'Mind the turning mobile', speed: [390, 425],
    parts: [
      'c_start', 'b_mobile', 'c_cp', { event: 'creature' }, 'b_mobile_star', 'b_shelves', 'b_stacks~', 'c_cp',
      { event: 'shatter' }, 'b_mobile~', 'b_split~', 'b_lift', 'c_cp', 'c_star_nook', 'b_mobile', 'c_end',
    ],
  },
  {
    id: '4-1', world: 'clockwork', name: 'Tick', hint: 'Pendulums sweep your path — go around them', speed: [395, 425],
    parts: [
      'c_start', 'k_pendulums', 'c_rest', 'k_gears', 'c_cp', 'c_tunnel', 'k_pendulums~!', 'c_star_nook',
      'c_cp', 'k_gears~', 'b_mobile~', 'k_split', 'c_end',
    ],
  },
  {
    id: '4-2', world: 'clockwork', name: 'Tock', hint: 'Gates flip gravity for you', speed: [405, 435],
    parts: [
      'c_start', { event: 'rapid' }, 'k_gates', 'c_rest', 'k_tock', 'c_cp', 'k_rapid', 'k_gears!',
      'c_star_arc', 'c_cp', 'k_tock~', 'k_gates~!', 'k_pendulums', 'c_end',
    ],
  },
  {
    id: '4-3', world: 'clockwork', name: 'Wake Up', hint: 'Everything, all at once. Wake up.', speed: [415, 450],
    parts: [
      'c_start', 'k_gears', 'k_pendulums!', 'c_cp', 'k_rapid', 'k_split~', 'b_mobile', 'c_cp',
      { event: 'fracture' }, 'k_fracture', 'g_doors!', 'k_fracture~', 'c_cp', 'k_tock', 'c_star_nook~', 'k_gates', { event: 'wake' }, 'c_end',
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
