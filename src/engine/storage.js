// localStorage wrapper that never throws (private mode, sandboxed iframes,
// storage-blocked portals all degrade to in-memory saves).
const mem = {};

export const storage = {
  get(key, fallback) {
    try {
      const v = window.localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return key in mem ? mem[key] : fallback;
    }
  },
  set(key, value) {
    mem[key] = value;
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* in-memory only */ }
  },
  remove(key) {
    delete mem[key];
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
  },
};
