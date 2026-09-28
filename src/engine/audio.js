// Procedural WebAudio: every sound effect and all music is synthesised at
// runtime, so the game ships with zero audio assets and loads instantly.
import { MusicPlayer } from './music.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.7;
    this.sfxVol = 0.85;
    this.muted = false;
    this.pausedDuck = false;
    this.music = null;
    this.pendingTrack = null;
  }

  /** Must be called from a user gesture (autoplay policies). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    this.master.connect(comp).connect(c.destination);

    this.musicGain = c.createGain();
    this.musicGain.gain.value = this.musicVol * 0.55;
    this.musicFilter = c.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 18000;
    this.musicFilter.Q.value = 0.8;
    this.musicGain.connect(this.musicFilter).connect(this.master);

    this.sfxGain = c.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.master);

    this.reverb = c.createConvolver();
    this.reverb.buffer = this.impulse(2.6, 2.4);
    this.revGain = c.createGain();
    this.revGain.gain.value = 0.35;
    this.reverb.connect(this.revGain).connect(this.master);

    this.noiseBuf = this.makeNoise(1.5);
    this.music = new MusicPlayer(this);
    if (this.pendingTrack) this.playTrack(this.pendingTrack);
  }

  impulse(sec, decay) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  makeNoise(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  get now() { return this.ctx.currentTime; }

  setVolumes(music, sfx) {
    this.musicVol = music; this.sfxVol = sfx;
    if (!this.ctx) return;
    this.musicGain.gain.setTargetAtTime(music * 0.55, this.now, 0.05);
    this.sfxGain.gain.setTargetAtTime(sfx, this.now, 0.05);
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.now, 0.03);
  }

  /** Muffle the music (pause menu, tutorial freeze). */
  duck(on, freq = 600) {
    this.pausedDuck = on;
    if (!this.ctx) return;
    this.musicFilter.frequency.cancelScheduledValues(this.now);
    this.musicFilter.frequency.setTargetAtTime(on ? freq : 18000, this.now, on ? 0.08 : 0.25);
  }

  /** The signature gravity-flip filter sweep on the music bus. */
  flipSweep(g) {
    if (!this.ctx || this.pausedDuck) return;
    const f = this.musicFilter.frequency, t = this.now;
    f.cancelScheduledValues(t);
    f.setValueAtTime(g === -1 ? 1400 : 900, t);
    f.exponentialRampToValueAtTime(18000, t + 0.38);
  }

  playTrack(id, intensity = 1) {
    this.pendingTrack = id;
    if (!this.ctx) return;
    this.music.play(id, intensity);
  }

  // ------------------------------------------------------------ primitives

  osc(type, freq, t0, dur, gain, dest = this.sfxGain, opts = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + (opts.glide ?? dur));
    if (opts.detune) o.detune.value = opts.detune;
    const g = c.createGain();
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest);
    if (opts.rev) { const s = c.createGain(); s.gain.value = opts.rev; g.connect(s).connect(this.reverb); }
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  }

  noise(t0, dur, gain, filter, f0, f1, q = 1, dest = this.sfxGain, rev = 0) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const bf = c.createBiquadFilter();
    bf.type = filter;
    bf.Q.value = q;
    bf.frequency.setValueAtTime(f0, t0);
    if (f1) bf.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(bf).connect(g).connect(dest);
    if (rev) { const r = c.createGain(); r.gain.value = rev; g.connect(r).connect(this.reverb); }
    s.start(t0, Math.random() * 0.5);
    s.stop(t0 + dur + 0.05);
  }

  // ------------------------------------------------------------ SFX

  sfx(name, e = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.now + 0.002;
    switch (name) {
      case 'flip': {
        const up = e.g === -1;
        this.noise(t, 0.2, 0.32, 'bandpass', up ? 500 : 2600, up ? 2600 : 500, 1.4, this.sfxGain, 0.3);
        this.osc('sine', up ? 480 : 820, t, 0.16, 0.18, this.sfxGain, { to: up ? 820 : 480, glide: 0.12, rev: 0.4 });
        this.osc('triangle', up ? 960 : 1640, t, 0.09, 0.05, this.sfxGain, { to: up ? 1640 : 960 });
        this.flipSweep(e.g);
        break;
      }
      case 'land': {
        const k = Math.min(1, (e.impact ?? 400) / 1100);
        this.osc('sine', 150, t, 0.13, 0.2 + k * 0.3, this.sfxGain, { to: 55, glide: 0.1 });
        this.noise(t, 0.05, 0.08 + k * 0.1, 'highpass', 3000, 0, 0.7);
        break;
      }
      case 'frag': {
        const s = (e.streak ?? 0) % 15;
        const m = 72 + PENTA[s % 5] + 12 * Math.floor(s / 5);
        this.osc('sine', mtof(m), t, 0.3, 0.14, this.sfxGain, { rev: 0.5 });
        this.osc('triangle', mtof(m + 12), t, 0.12, 0.04);
        break;
      }
      case 'star': {
        [72, 76, 79, 84, 88].forEach((m, i) => {
          this.osc('sine', mtof(m), t + i * 0.055, 0.7, 0.13, this.sfxGain, { rev: 0.8 });
          this.osc('triangle', mtof(m + 12), t + i * 0.055, 0.3, 0.04);
        });
        this.noise(t, 0.6, 0.06, 'highpass', 6000, 9000, 0.5, this.sfxGain, 0.6);
        break;
      }
      case 'near': {
        this.noise(t, 0.18, 0.18, 'highpass', 1800, 6000, 0.6, this.sfxGain, 0.3);
        this.osc('sine', 1760, t + 0.03, 0.2, 0.06, this.sfxGain, { to: 2640, glide: 0.1, rev: 0.5 });
        break;
      }
      case 'death': {
        [0, 5, 11].forEach((d, i) => this.osc('sawtooth', mtof(76 - d), t, 0.5, 0.06, this.sfxGain, { to: mtof(52 - d), glide: 0.45, detune: i * 7, rev: 0.4 }));
        this.noise(t, 0.35, 0.35, 'lowpass', 4000, 200, 0.8, this.sfxGain, 0.3);
        this.osc('sine', 90, t, 0.3, 0.35, this.sfxGain, { to: 40 });
        if (this.music) {
          const f = this.musicFilter.frequency;
          f.cancelScheduledValues(t);
          f.setValueAtTime(350, t);
          f.exponentialRampToValueAtTime(18000, t + 0.9);
        }
        break;
      }
      case 'respawn': {
        this.noise(t, 0.28, 0.14, 'bandpass', 300, 3000, 2, this.sfxGain, 0.4);
        this.osc('sine', 330, t, 0.3, 0.12, this.sfxGain, { to: 990, glide: 0.25, rev: 0.4 });
        break;
      }
      case 'checkpoint': {
        this.osc('sine', mtof(79), t, 0.9, 0.12, this.sfxGain, { rev: 0.8 });
        this.osc('sine', mtof(86), t + 0.08, 0.9, 0.1, this.sfxGain, { rev: 0.8 });
        this.osc('triangle', mtof(91), t + 0.16, 0.5, 0.04, this.sfxGain, { rev: 0.8 });
        break;
      }
      case 'crumble': {
        this.noise(t, 0.12, 0.14, 'bandpass', 900, 400, 1.5);
        break;
      }
      case 'finish': {
        [60, 64, 67, 71, 74, 79].forEach((m, i) => this.osc('sine', mtof(m), t + i * 0.07, 1.6, 0.1, this.sfxGain, { rev: 0.9, attack: 0.04 }));
        this.noise(t, 1.2, 0.12, 'bandpass', 400, 8000, 1, this.sfxGain, 0.8);
        break;
      }
      case 'setpiece': {
        this.osc('sine', 55, t, 2.0, 0.25, this.sfxGain, { attack: 0.3, to: 45, rev: 0.6 });
        this.noise(t, 1.6, 0.08, 'lowpass', 200, 1200, 1, this.sfxGain, 0.8);
        break;
      }
      case 'tutor': this.duck(true, 500); break;
      case 'tutorDone': this.duck(false); break;
      case 'ui': {
        this.osc('sine', 660, t, 0.08, 0.1, this.sfxGain, { to: 880, glide: 0.05 });
        break;
      }
      case 'uiBack': {
        this.osc('sine', 660, t, 0.08, 0.08, this.sfxGain, { to: 440, glide: 0.05 });
        break;
      }
      case 'buy': {
        [67, 71, 74, 79].forEach((m, i) => this.osc('triangle', mtof(m), t + i * 0.05, 0.3, 0.08, this.sfxGain, { rev: 0.5 }));
        break;
      }
      case 'achievement': {
        [72, 79, 84].forEach((m, i) => this.osc('sine', mtof(m), t + i * 0.09, 0.8, 0.1, this.sfxGain, { rev: 0.8 }));
        break;
      }
    }
  }
}

export { mtof };
