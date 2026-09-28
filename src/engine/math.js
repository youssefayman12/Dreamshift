export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const TAU = Math.PI * 2;

/** Frame-rate independent exponential smoothing. */
export function damp(a, b, lambda, dt) {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

/** Deterministic PRNG so procedural scenery is identical every load. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a0, b0) => a0 + (b0 - a0) * r();
  r.int = (a0, b0) => Math.floor(a0 + (b0 - a0 + 1) * r());
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  return r;
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Critically-damped-ish spring used for camera kicks and UI juice. */
export class Spring {
  constructor(stiffness = 180, damping = 16, value = 0) {
    this.k = stiffness;
    this.d = damping;
    this.value = value;
    this.target = value;
    this.vel = 0;
  }
  update(dt) {
    const f = (this.target - this.value) * this.k - this.vel * this.d;
    this.vel += f * dt;
    this.value += this.vel * dt;
    return this.value;
  }
  kick(v) { this.vel += v; }
  snap(v) { this.value = this.target = v; this.vel = 0; }
}

/** Cheap 1D value noise for camera shake and organic motion. */
export function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const h = (n) => {
    n = (n << 13) ^ n;
    return 1 - ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 1073741824;
  };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u);
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], t)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function circleRectDist(cx, cy, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  return Math.sqrt(dx * dx + dy * dy);
}

export function rectRectDist(ax, ay, aw, ah, bx, by, bw, bh) {
  const dx = Math.max(bx - (ax + aw), ax - (bx + bw), 0);
  const dy = Math.max(by - (ay + ah), ay - (by + bh), 0);
  return Math.sqrt(dx * dx + dy * dy);
}
