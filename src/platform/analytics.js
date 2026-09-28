// Analytics sink. No data leaves the page by default; hook `sinks` up to a
// real backend or portal analytics later.
import { DEBUG } from '../config.js';

export class Analytics {
  constructor() { this.sinks = []; }
  addSink(fn) { this.sinks.push(fn); }
  track(event, props = {}) {
    if (DEBUG) console.log('[analytics]', event, props);
    for (const s of this.sinks) {
      try { s(event, props); } catch { /* never break the game */ }
    }
  }
}
