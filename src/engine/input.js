// One-button input: any of tap / click / Space / arrows / W / S flips gravity.
// We listen to pointerdown (not click) and keydown for minimum latency.
const FLIP_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'KeyZ', 'KeyX', 'KeyJ', 'Enter', 'NumpadEnter']);
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);

export class Input {
  constructor(surface) {
    this.surface = surface;
    this.device = matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'keyboard';
    this.handlers = { press: [], pause: [], any: [] };
    this.enabled = true;

    surface.addEventListener('pointerdown', (e) => {
      if (e.target.closest?.('[data-ui]')) return; // UI buttons handle themselves
      this.device = e.pointerType === 'touch' ? 'touch' : 'mouse';
      e.preventDefault();
      this.emit('any', e);
      if (e.button === 0 || e.pointerType !== 'mouse') this.emit('press', e);
    }, { passive: false });

    // Prevent long-press menus / double-tap zoom on mobile.
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
    surface.addEventListener('touchstart', (e) => { if (!e.target.closest?.('[data-ui]')) e.preventDefault(); }, { passive: false });

    window.addEventListener('keydown', (e) => {
      // Focused menu controls keep native keyboard behaviour.
      const inUi = e.target?.closest?.('[data-ui] button, [data-ui] input');
      if (inUi && !PAUSE_KEYS.has(e.code)) return;
      if (FLIP_KEYS.has(e.code) || PAUSE_KEYS.has(e.code)) {
        // keep the page from scrolling inside portal iframes
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
      }
      if (e.repeat) return;
      this.device = 'keyboard';
      this.emit('any', e);
      if (PAUSE_KEYS.has(e.code)) this.emit('pause', e);
      else if (FLIP_KEYS.has(e.code)) this.emit('press', e);
    });
  }

  on(type, fn) { this.handlers[type].push(fn); }
  emit(type, e) { if (this.enabled) for (const fn of this.handlers[type]) fn(e); }

  /** Word shown in tutorial prompts for the current device. */
  get label() {
    return this.device === 'touch' ? 'TAP' : this.device === 'mouse' ? 'CLICK' : 'SPACE';
  }
}
