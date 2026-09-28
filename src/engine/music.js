// Generative, per-world music. Each track is a small description (tempo,
// chords, patterns, instrument flavours); the player schedules notes ahead of
// time with a lookahead clock so timing is sample-accurate.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export const TRACKS = {
  menu: {
    bpm: 68, swing: 0,
    chords: [[50, 57, 61, 64, 69], [47, 54, 57, 62, 66], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64]],
    pad: { type: 'sine', gain: 0.07, cutoff: 1600 }, arp: { every: 4, pattern: [4, 2, 3, 1], oct: 12, type: 'sine', gain: 0.05, len: 1.2 },
    bass: null, drums: null,
  },
  city: {
    bpm: 100, swing: 0,
    chords: [[57, 60, 64, 67, 71], [53, 57, 60, 64, 67], [48, 55, 59, 62, 64], [52, 55, 59, 62, 66]],
    pad: { type: 'sawtooth', gain: 0.035, cutoff: 1200 },
    arp: { every: 1, pattern: [0, 2, 4, 2, 1, 3, 4, 3, 0, 2, 4, 2, 1, 4, 3, 2], oct: 12, type: 'triangle', gain: 0.05, len: 0.18 },
    bass: { pattern: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], gain: 0.16 },
    drums: { kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1] },
  },
  garden: {
    bpm: 86, swing: 0.1,
    chords: [[53, 57, 60, 64, 71], [55, 59, 62, 66, 69], [52, 55, 59, 64, 67], [50, 57, 60, 64, 69]],
    pad: { type: 'triangle', gain: 0.06, cutoff: 1800 },
    arp: { every: 2, pattern: [0, 4, 2, 4, 1, 4, 3, 4], oct: 24, type: 'sine', gain: 0.06, len: 0.6, bell: true },
    bass: { pattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], gain: 0.14 },
    drums: { kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], snare: null, hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1], shaker: true },
  },
  bedroom: {
    bpm: 94, swing: 0.18,
    chords: [[48, 55, 59, 64, 67], [45, 52, 55, 60, 64], [50, 57, 60, 65, 69], [43, 50, 55, 59, 65]],
    pad: { type: 'sine', gain: 0.07, cutoff: 1400 },
    arp: { every: 1, pattern: [4, 3, 2, 3, 4, 1, 2, 0, 4, 3, 2, 3, 1, 2, 3, 4], oct: 24, type: 'triangle', gain: 0.045, len: 0.35, box: true },
    bass: { pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0], gain: 0.15 },
    drums: { kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0] },
  },
  clockwork: {
    bpm: 122, swing: 0,
    chords: [[50, 53, 57, 62, 65], [46, 50, 53, 58, 62], [43, 46, 50, 55, 58], [45, 49, 52, 57, 61]],
    pad: { type: 'sawtooth', gain: 0.03, cutoff: 900 },
    arp: { every: 1, pattern: [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 2, 0, 3, 1, 4], oct: 12, type: 'square', gain: 0.025, len: 0.1 },
    bass: { pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1], gain: 0.15 },
    drums: { kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], tick: true },
  },
};

export class MusicPlayer {
  constructor(engine) {
    this.e = engine;
    this.track = null;
    this.step = 0;
    this.nextT = 0;
    this.timer = null;
    this.intensity = 1;
    this.bus = null;
  }

  play(id, intensity = 1) {
    this.intensity = intensity;
    if (this.track && this.trackId === id) return;
    const c = this.e.ctx;
    // Cross-fade: fade the old bus, start a fresh one.
    if (this.bus) {
      const old = this.bus;
      old.gain.setTargetAtTime(0, c.currentTime, 0.4);
      setTimeout(() => old.disconnect(), 2500);
    }
    this.bus = c.createGain();
    this.bus.gain.setValueAtTime(0, c.currentTime);
    this.bus.gain.setTargetAtTime(1, c.currentTime, 0.6);
    this.bus.connect(this.e.musicGain);
    this.trackId = id;
    this.track = TRACKS[id] ?? TRACKS.menu;
    this.step = 0;
    this.nextT = c.currentTime + 0.1;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 25);
  }

  setIntensity(v) { this.intensity = v; }

  stop() {
    if (this.bus) this.bus.gain.setTargetAtTime(0, this.e.ctx.currentTime, 0.3);
    this.track = null;
    this.trackId = null;
  }

  tick() {
    const c = this.e.ctx;
    if (!this.track || !c || c.state !== 'running') return;
    // If the tab was backgrounded, don't try to catch up a pile of notes.
    if (this.nextT < c.currentTime - 0.2) this.nextT = c.currentTime + 0.05;
    const spb = 60 / this.track.bpm / 4; // seconds per 16th
    while (this.nextT < c.currentTime + 0.14) {
      const swing = this.step % 2 ? this.track.swing * spb : 0;
      this.playStep(this.step, this.nextT + swing, spb);
      this.nextT += spb;
      this.step++;
    }
  }

  playStep(step, t, spb) {
    const T = this.track, e = this.e, bus = this.bus;
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    const chord = T.chords[bar % T.chords.length];
    const I = this.intensity;

    if (s16 === 0) this.pad(chord, t, spb * 16, T.pad);
    if (T.arp && I > 0.25 && step % T.arp.every === 0) {
      const idx = T.arp.pattern[(step / T.arp.every) % T.arp.pattern.length];
      const m = chord[idx % chord.length] + T.arp.oct;
      this.pluck(m, t, T.arp);
    }
    if (T.bass && I > 0.5 && T.bass.pattern[s16]) {
      e.osc('sine', mtof(chord[0] - 12), t, spb * 2.5, T.bass.gain, bus, { attack: 0.01 });
      e.osc('triangle', mtof(chord[0] - 12), t, spb * 1.2, T.bass.gain * 0.3, bus);
    }
    const D = T.drums;
    if (D && I > 0.7) {
      if (D.kick?.[s16]) {
        e.osc('sine', 130, t, 0.28, 0.5, bus, { to: 42, glide: 0.12 });
      }
      if (D.snare?.[s16]) {
        e.noise(t, 0.16, 0.16, 'bandpass', 1800, 900, 0.8, bus, 0.25);
        e.osc('triangle', 220, t, 0.08, 0.08, bus, { to: 150 });
      }
      if (D.hat?.[s16]) {
        if (D.tick) {
          // clockwork tick-tock
          e.osc('square', s16 % 4 === 0 ? 2400 : 1800, t, 0.03, 0.025, bus);
        } else {
          e.noise(t, D.shaker ? 0.07 : 0.04, D.shaker ? 0.05 : 0.06, 'highpass', 7000, 0, 0.7, bus);
        }
      }
    }
  }

  pad(chord, t, dur, P) {
    const e = this.e, c = e.ctx;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(P.cutoff * 0.6, t);
    f.frequency.linearRampToValueAtTime(P.cutoff, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(P.cutoff * 0.6, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(P.gain, t + Math.min(0.8, dur * 0.3));
    g.gain.setValueAtTime(P.gain, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
    f.connect(g).connect(this.bus);
    const rv = c.createGain(); rv.gain.value = 0.5; g.connect(rv).connect(e.reverb);
    for (const m of chord) {
      for (const det of [-7, 7]) {
        const o = c.createOscillator();
        o.type = P.type;
        o.frequency.value = mtof(m);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur * 1.1);
      }
    }
  }

  pluck(m, t, A) {
    const e = this.e;
    const f = mtof(m);
    e.osc(A.type, f, t, A.len, A.gain, this.bus, { rev: 0.45 });
    if (A.bell) e.osc('sine', f * 2.76, t, A.len * 0.4, A.gain * 0.3, this.bus, { rev: 0.6 });
    if (A.box) e.osc('sine', f * 2, t, A.len * 0.6, A.gain * 0.5, this.bus, { rev: 0.5 });
  }
}
