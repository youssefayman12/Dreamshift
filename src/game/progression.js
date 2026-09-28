// Save data, unlocks, cosmetics wallet and achievements.
import { storage } from '../engine/storage.js';
import { STAGES, WORLDS } from '../levels/stages.js';
import { CATALOG, findCosmetic } from './cosmetics.js';

const KEY = 'dreamshift_save_v1';

const DEFAULT = () => ({
  v: 1,
  settings: { music: 0.7, sfx: 0.85, reducedMotion: false, quality: 'auto' },
  tutorialDone: false,
  stages: {},
  dust: 0,
  owned: { skin: ['dreamer'], trail: ['wisp', 'none'], flipfx: ['ripple'] },
  equip: { skin: 'dreamer', trail: 'wisp', flipfx: 'ripple' },
  ach: {},
  stats: { flips: 0, deaths: 0, near: 0, frags: 0, runs: 0, time: 0, bestStreak: 0 },
  endless: { best: 0, bestDist: 0 },
});

export const ACHIEVEMENTS = [
  { id: 'first_flip', name: 'First Shift', desc: 'Flip gravity for the first time.' },
  { id: 'clear_city', name: 'Night Owl', desc: 'Wake from Drift City.' },
  { id: 'clear_garden', name: 'Moon Gardener', desc: 'Wake from the Moonlit Garden.' },
  { id: 'clear_bedroom', name: 'Sleepwalker', desc: 'Wake from the Endless Bedroom.' },
  { id: 'wake_up', name: 'Wide Awake?', desc: 'Escape the Clockwork Nightmare.', reward: 'Lucid skin' },
  { id: 'stars_city', name: 'Starlit', desc: 'Collect every lucid star in Drift City.', reward: 'Starlit skin' },
  { id: 'flawless', name: 'Untroubled Sleep', desc: 'Finish a stage without falling once.' },
  { id: 'near_25', name: 'Close Call', desc: 'Pull off 25 near misses.' },
  { id: 'near_100', name: 'Daredreamer', desc: 'Pull off 100 near misses.', reward: 'Prism shift effect' },
  { id: 'streak_40', name: 'Flow State', desc: 'Reach a 40 streak in one run.' },
  { id: 'endless_1000', name: 'Deep Sleeper', desc: 'Drift 1000 m in Endless Dream.' },
  { id: 'frags_1000', name: 'Dream Hoarder', desc: 'Collect 1000 dream fragments.' },
];

export class Progress {
  constructor() {
    const d = DEFAULT();
    const s = storage.get(KEY, null);
    this.data = s && s.v === 1 ? deepMerge(d, s) : d;
  }

  save() { storage.set(KEY, this.data); }
  get settings() { return this.data.settings; }

  stage(id) {
    return this.data.stages[id] ?? { done: false, best: 0, stars: 0, flawless: false, starMask: 0 };
  }

  isUnlocked(id) {
    if (new URLSearchParams(location.search).has('unlockall')) return true;
    const i = STAGES.findIndex((s) => s.id === id);
    if (i <= 0) return true;
    return this.stage(STAGES[i - 1].id).done;
  }

  get endlessUnlocked() { return this.stage('1-1').done || this.isUnlocked('1-2'); }

  /** The stage the big PLAY button should launch. */
  nextStage() {
    for (const s of STAGES) if (!this.stage(s.id).done) return s.id;
    return null; // everything cleared → endless
  }

  worldStars(worldId) {
    const w = WORLDS.find((x) => x.id === worldId);
    return w.stages.reduce((n, id) => n + this.stage(id).stars, 0);
  }

  /** Record a finished stage. Returns what changed for the results screen. */
  completeStage(id, r) {
    const prev = this.stage(id);
    const rec = { ...prev };
    const res = { newBest: r.score > prev.best, firstClear: !prev.done, unlocked: [] };
    rec.done = true;
    rec.best = Math.max(prev.best, r.score);
    rec.starMask = (prev.starMask ?? 0) | r.starMask;
    rec.stars = popcount(rec.starMask);
    rec.flawless = prev.flawless || r.deaths === 0;
    res.newStars = rec.stars - prev.stars;
    this.data.stages[id] = rec;
    const i = STAGES.findIndex((s) => s.id === id);
    if (res.firstClear && STAGES[i + 1]) res.unlocked.push(STAGES[i + 1].id);
    this.save();
    return res;
  }

  addDust(n) { this.data.dust += n; this.data.stats.frags += n; }

  // ---- cosmetics
  owns(kind, id) {
    const c = findCosmetic(kind, id);
    if (c.unlock) return !!this.data.ach[c.unlock];
    return this.data.owned[kind].includes(id) || c.cost === 0;
  }
  buy(kind, id) {
    const c = findCosmetic(kind, id);
    if (this.owns(kind, id) || c.unlock || this.data.dust < c.cost) return false;
    this.data.dust -= c.cost;
    this.data.owned[kind].push(id);
    this.data.equip[kind] = id;
    this.save();
    return true;
  }
  equip(kind, id) {
    if (!this.owns(kind, id)) return false;
    this.data.equip[kind] = id;
    this.save();
    return true;
  }
  get equipped() {
    const e = this.data.equip;
    return {
      skin: findCosmetic('skin', e.skin),
      trail: findCosmetic('trail', e.trail),
      flipfx: findCosmetic('flipfx', e.flipfx),
    };
  }

  // ---- achievements
  unlock(id) {
    if (this.data.ach[id]) return null;
    this.data.ach[id] = Date.now();
    this.save();
    return ACHIEVEMENTS.find((a) => a.id === id);
  }

  /** Evaluate achievements after a run. Returns newly unlocked ones. */
  evaluate(ctx = {}) {
    const d = this.data, st = d.stats, out = [];
    const u = (id, cond) => { if (cond) { const a = this.unlock(id); if (a) out.push(a); } };
    u('first_flip', st.flips > 0);
    for (const w of WORLDS) {
      const last = w.stages[w.stages.length - 1];
      u(w.id === 'clockwork' ? 'wake_up' : 'clear_' + w.id, this.stage(last).done);
    }
    const city = WORLDS.find((w) => w.id === 'city');
    u('stars_city', this.worldStars('city') >= city.stages.length * 3);
    u('flawless', Object.values(d.stages).some((s) => s.flawless));
    u('near_25', st.near >= 25);
    u('near_100', st.near >= 100);
    u('streak_40', st.bestStreak >= 40);
    u('endless_1000', d.endless.bestDist >= 1000);
    u('frags_1000', st.frags >= 1000);
    return out;
  }

  reset() {
    const settings = this.data.settings;
    this.data = DEFAULT();
    this.data.settings = settings;
    this.save();
  }
}

function popcount(n) { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; }

function deepMerge(base, over) {
  for (const k of Object.keys(over)) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') {
      base[k] = deepMerge(base[k], over[k]);
    } else base[k] = over[k];
  }
  return base;
}

export { CATALOG };
