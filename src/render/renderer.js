// Frame composition: background theme → gameplay → player → particles →
// post FX (flip ripple, tint, vignette) → HUD. Also turns gameplay events into
// juice (camera kicks, particles, popups).
import { VIEW, WORLD_H, TILE } from '../config.js';
import { Spring, clamp, lerp, damp, noise1, rgba, TAU, easeOutCubic } from '../engine/math.js';
import { SpriteBank, makeCanvas } from './sprites.js';
import { Particles } from './particles.js';
import { PlayerView, PW, PH } from './playerView.js';
import { LevelView } from './levelView.js';
import { createTheme } from '../worlds/index.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.buf = makeCanvas(2, 2);
    this.bctx = this.buf.getContext('2d', { alpha: false });
    this.sprites = new SpriteBank();
    this.particles = new Particles();
    this.player = new PlayerView();
    this.levelView = new LevelView();
    this.themes = new Map();
    this.quality = 'high';
    this.reducedMotion = false;
    this.dprCap = 2;
    this.popups = [];
    this.cam = { x: 0, y: 0 };
    this.kickY = new Spring(260, 18, 0);
    this.zoom = new Spring(300, 20, 1);
    this.gShift = new Spring(40, 9, 1);
    this.roll = { cur: 0, target: 0 };
    this.trauma = 0;
    this.pulse = 0;
    this.flash = { a: 0, color: '#fff' };
    this.tint = 0;
    this.time = 0;
    this.slowmoFx = 0;
    this.cosmetics = null;
    this.onSfx = null;
    this.transition = null; // endless world cross-fade
    this.resize();
  }

  // ------------------------------------------------------------ setup

  resize() {
    const cssW = Math.max(1, window.innerWidth), cssH = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    this.cssW = cssW; this.cssH = cssH; this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.buf.width = this.canvas.width; this.buf.height = this.canvas.height;
    // world units -> css px
    this.s = Math.min(cssH / VIEW.minHeight, cssW / VIEW.minWidth);
    this.px = this.s * dpr;
    this.vw = cssW / this.s;
    this.vh = cssH / this.s;
    this.sprites.build(this.px);
    for (const th of this.themes.values()) th.build(this.px, this.sprites);
    this.vignette = null;
    this.portrait = cssH > cssW * 1.1;
  }

  setQuality(q) {
    this.quality = q;
    this.dprCap = q === 'low' ? 1 : 2;
    this.particles.budget = q === 'low' ? 0.5 : 1;
    this.resize();
  }

  theme(id) {
    let th = this.themes.get(id);
    if (!th) {
      th = createTheme(id);
      th.build(this.px, this.sprites);
      this.themes.set(id, th);
    }
    return th;
  }

  /** Called when a run starts: reset camera and presentation state. */
  attach(run) {
    this.run = run;
    this.particles.clear();
    this.popups.length = 0;
    this.roll = { cur: 0, target: 0 };
    this.trauma = 0; this.pulse = 0; this.flash.a = 0;
    this.gShift.snap(1);
    this.kickY.snap(0);
    this.zoom.snap(1);
    this.transition = null;
    const th = this.theme(run.level.theme);
    th.reset?.();
    const p = run.runner;
    this.player.reset(p.x + PW / 2, p.y + PH / 2, p.g);
    this.player.spawnT = 1;
  }

  // ------------------------------------------------------------ events → juice

  handle(events) {
    const run = this.run;
    const P = this.particles;
    const skin = this.cosmetics.skin;
    const rm = this.reducedMotion;
    for (const e of events) {
      switch (e.type) {
        case 'flip': {
          this.pulse = 1;
          this.player.onFlip(e.g);
          if (!rm) {
            this.kickY.vel += -e.g * 160;
            this.zoom.value = 1.025;
          }
          this.tint = 1;
          this.flipBurst(e.x, e.y, e.g, e.gate);
          this.onSfx?.('flip', e);
          break;
        }
        case 'land': {
          const p = run.runner;
          this.player.onLand(e.impact);
          const fy = p.g === 1 ? p.y + PH : p.y;
          const k = clamp(e.impact / 1000, 0.2, 1);
          for (let i = 0; i < 8 * k + 3; i++) {
            const dir = i % 2 ? 1 : -1;
            P.spawn({
              x: p.x + PW / 2, y: fy, vx: dir * (40 + Math.random() * 140) + 120, vy: -p.g * (20 + Math.random() * 60),
              drag: 5, life: 0.35 + Math.random() * 0.2, size: 3 + Math.random() * 3, color: this.curTheme().pal.mote, alpha: 0.8, shape: 'circle', size1: 0.5,
            });
          }
          if (e.impact > 700 && !rm) this.trauma = Math.max(this.trauma, 0.12);
          this.onSfx?.('land', e);
          break;
        }
        case 'frag': {
          const k = e.pickup;
          P.burst(6, (i, n) => {
            const a = (i / n) * TAU;
            return { x: k.x, y: k.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, drag: 6, life: 0.35, size: 3, color: '#fff2c4', add: true, shape: 'star' };
          });
          this.onSfx?.('frag', e);
          break;
        }
        case 'star': {
          const k = e.pickup;
          P.burst(26, (i, n) => {
            const a = (i / n) * TAU;
            const sp = 150 + Math.random() * 200;
            return { x: k.x, y: k.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3, life: 0.8, size: 5, color: i % 2 ? '#ffd45c' : '#fff', add: true, shape: 'star', vr: 6 };
          });
          P.spawn({ x: k.x, y: k.y, life: 0.5, size: 10, shape: 'ring', vr: 90, color: '#ffe38a', add: true });
          this.flash = { a: 0.25, color: '#ffe8a0' };
          this.popup(k.x, k.y - 30, 'LUCID STAR', '#ffe38a', 1.3);
          this.onSfx?.('star', e);
          break;
        }
        case 'near': {
          this.player.onNear();
          this.popup(e.x + 10, e.y - 36 * run.runner.g, `CLOSE! +${e.pts}`, '#9ff8ff', 0.9);
          P.burst(8, () => ({
            x: e.x, y: e.y, vx: (Math.random() - 0.3) * 220, vy: (Math.random() - 0.5) * 220, drag: 5,
            life: 0.4, size: 3, color: '#bff8ff', add: true, shape: 'streak',
          }));
          this.slowmoFx = 0.12;
          this.onSfx?.('near', e);
          break;
        }
        case 'death': {
          const d = e.death;
          this.player.visible = false;
          const cx = run.runner.x + PW / 2, cy = run.runner.y + PH / 2;
          P.burst(26, (i, n) => {
            const a = (i / n) * TAU + Math.random() * 0.3;
            const sp = 120 + Math.random() * 320;
            return {
              x: cx, y: cy, vx: Math.cos(a) * sp + 80, vy: Math.sin(a) * sp, drag: 3.2, ay: 0,
              life: 0.7 + Math.random() * 0.4, size: 4 + Math.random() * 4,
              color: [skin.body, skin.cap, skin.pom][i % 3], shape: i % 3 === 2 ? 'star' : 'feather', vr: (Math.random() - 0.5) * 12, layer: 1,
            };
          });
          P.spawn({ x: cx, y: cy, life: 0.45, size: 12, shape: 'ring', vr: 110, color: '#ffffff', add: true, layer: 1 });
          if (d.cause === 'hazard' || d.cause === 'wall') {
            // Highlight exactly what killed you.
            P.spawn({ x: d.x, y: d.y, life: 0.6, size: 20, shape: 'ring', vr: 40, color: '#ff4f8b', add: true, layer: 1 });
          }
          this.trauma = rm ? 0 : 0.55;
          this.flash = { a: 0.35, color: '#ff9ac0' };
          this.onSfx?.('death', e);
          break;
        }
        case 'respawn': {
          const p = run.runner;
          this.player.reset(p.x + PW / 2, p.y + PH / 2, p.g);
          this.gShift.snap(p.g);
          this.roll.cur = this.roll.target;
          this.particles.clear();
          P.burst(18, (i, n) => {
            const a = (i / n) * TAU;
            return {
              x: p.x + PW / 2 + Math.cos(a) * 70, y: p.y + PH / 2 + Math.sin(a) * 70,
              vx: -Math.cos(a) * 280, vy: -Math.sin(a) * 280, life: 0.25, size: 4, color: skin.pom, add: true, shape: 'star',
            };
          });
          this.flash = { a: 0.3, color: '#d8c8ff' };
          this.onSfx?.('respawn', e);
          break;
        }
        case 'checkpoint': {
          const cp = e.cp;
          const ly = cp.g === 1 ? cp.y + 34 - 76 : cp.y + 76;
          P.burst(16, (i, n) => {
            const a = (i / n) * TAU;
            return { x: cp.x + 23, y: ly, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, drag: 4, life: 0.6, size: 4, color: '#ffd98a', add: true, shape: 'star' };
          });
          this.popup(cp.x + 23, ly - 30 * cp.g, 'CHECKPOINT', '#ffe4a8', 1.0);
          this.onSfx?.('checkpoint', e);
          break;
        }
        case 'crumble': {
          const y = e.r * TILE + TILE / 2;
          P.burst(Math.min(18, (e.b - e.a + 1) * 2), (i) => ({ x: (e.a + (i % (e.b - e.a + 1))) * TILE + Math.random() * TILE, y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, ay: 400, life: 0.5, size: 3, color: '#ffc07a', shape: 'shard', vr: 5 }));
          this.onSfx?.('crumble', e);
          break;
        }
        case 'setpiece': {
          const ev = e.ev;
          if (ev.type === 'invert') this.roll.target = ev.on ? Math.PI : 0;
          if (ev.type === 'flash') this.flash = { a: 0.5, color: '#fff' };
          this.curTheme().onSetpiece?.(ev, this.view);
          this.onSfx?.('setpiece', e);
          break;
        }
        case 'finish': {
          this.flash = { a: 0.6, color: '#ffffff' };
          this.onSfx?.('finish', e);
          break;
        }
        case 'tutor':
        case 'tutorDone':
          this.onSfx?.(e.type, e);
          break;
      }
    }
  }

  flipBurst(x, y, g, gate) {
    const P = this.particles;
    const kind = this.cosmetics.flipfx.id;
    const skin = this.cosmetics.skin;
    P.spawn({ x, y, life: 0.35, size: 8, shape: 'ring', vr: kind === 'shock' ? 110 : 70, color: gate ? '#d9c8ff' : '#ffffff', add: true, alpha: 0.8 });
    if (kind === 'shock') P.spawn({ x, y, life: 0.5, size: 4, shape: 'ring', vr: 160, color: skin.pom, add: true, alpha: 0.6 });
    const n = kind === 'feathers' ? 14 : 10;
    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * 1.6;
      const sp = 140 + Math.random() * 220;
      const base = g === 1 ? -Math.PI / 2 : Math.PI / 2; // away from travel
      const a = base + spread + Math.PI * 0.08;
      let color = skin.pom, shape = 'streak';
      if (kind === 'feathers') { color = i % 2 ? '#fff' : skin.body; shape = 'feather'; }
      if (kind === 'prism') { color = `hsl(${(i * 36 + this.time * 200) % 360},90%,70%)`; shape = 'star'; }
      P.spawn({
        x, y, vx: Math.cos(a) * sp - 60, vy: Math.sin(a) * sp, drag: 4, life: 0.35 + Math.random() * 0.25,
        size: kind === 'feathers' ? 5 : 3.5, color, add: kind !== 'feathers', shape, vr: (Math.random() - 0.5) * 10,
      });
    }
  }

  popup(x, y, text, color, life = 1) {
    this.popups.push({ x, y, text, color, life, max: life });
    if (this.popups.length > 8) this.popups.shift();
  }

  curTheme() { return this.theme(this.run.level.theme); }

  // ------------------------------------------------------------ per-frame

  update(dt) {
    this._dt = dt;
    this.time += dt;
    const run = this.run;
    if (!run) return;
    const p = run.runner;
    this.gShift.target = p.g;
    this.gShift.update(dt);
    this.kickY.update(dt);
    this.zoom.target = 1;
    this.zoom.update(dt);
    this.pulse = Math.max(0, this.pulse - dt * 3.2);
    this.tint = damp(this.tint, 0, 3, dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.flash.a = Math.max(0, this.flash.a - dt * 2.2);
    this.slowmoFx = Math.max(0, this.slowmoFx - dt);
    // camera roll (set piece): ease with a satisfying overshoot-free curve
    this.roll.cur = damp(this.roll.cur, this.roll.target, 2.6, dt);
    this.particles.update(dt, p.g);
    for (const q of this.popups) { q.life -= dt; q.y -= 30 * dt * (p.g === 1 ? 1 : -1); }
    this.popups = this.popups.filter((q) => q.life > 0);
  }

  render(alpha, ui) {
    const run = this.run;
    const ctx = this.ctx;
    const p = run.runner;
    const L = run.level;
    // Interpolated runner position.
    const rx = lerp(run.prevX, p.x, alpha);
    const ry = lerp(run.prevY, p.y, alpha);
    let cx = rx + PW / 2, cy = ry + PH / 2;
    const speed = L.speedAt(p.x);
    if (run.state === 'finished' && L.portal) {
      // Swallowed by the exit portal: spiral in and shrink.
      const k = clamp(run.stateT / 0.75, 0, 1);
      const e = k * k * (3 - 2 * k);
      const px2 = L.portal.x + 40, py2 = WORLD_H / 2;
      const a = e * 5;
      cx = lerp(cx, px2, e) + Math.cos(a) * 30 * (1 - e) * e;
      cy = lerp(cy, py2, e) + Math.sin(a) * 30 * (1 - e) * e;
      this.player.spawnT = 1 - e * 0.98;
      if (Math.random() < 0.6) this.particles.spawn({ x: cx, y: cy, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, life: 0.4, size: 3, color: this.cosmetics.skin.pom, add: true, shape: 'star' });
    }

    const vw = this.vw, vh = this.vh;
    // Camera: rigid horizontal lock (no jitter), gentle vertical follow.
    const anchor = VIEW.anchor - clamp((speed - 330) / 2000, 0, 0.05);
    this.cam.x = rx - vw * anchor;
    const follow = (cy - WORLD_H / 2) * 0.1;
    this.cam.y = WORLD_H / 2 - vh / 2 + follow + this.kickY.value;
    // Shake
    let shx = 0, shy = 0;
    if (this.trauma > 0) {
      const k = this.trauma * this.trauma * 14;
      shx = noise1(this.time * 30) * k;
      shy = noise1(this.time * 30 + 99) * k;
    }
    const camX = this.cam.x + shx, camY = this.cam.y + shy;

    const theme = this.theme(L.theme);
    const v = this.view = {
      w: vw, h: vh, camX, camY, t: this.time, lt: run.t, g: p.g,
      gShift: this.reducedMotion ? p.g * 0.3 : this.gShift.value, pulse: this.reducedMotion ? 0 : this.pulse,
      progress: isFinite(L.finishX) ? clamp(p.x / L.finishX, 0, 1) : 0,
    };
    this.player.frozenSpawn = run.state === 'finished';
    this.player.update(this._dt ?? 1 / 60, cx, cy, p.g, speed, p.grounded, p.vy);
    if (run.state === 'play') theme.ambient(v, this.particles, this._dt ?? 1 / 60);

    const ripple = this.quality === 'high' && !this.reducedMotion && this.pulse > 0.05;
    const c = ripple ? this.bctx : ctx;
    const px = this.px;

    // Roll requires overscan so the corners never show emptiness.
    const roll = this.roll.cur;
    const sr = Math.abs(Math.sin(roll)), cr = Math.abs(Math.cos(roll));
    const cover = Math.max((vw * cr + vh * sr) / vw, (vw * sr + vh * cr) / vh);
    const z = this.zoom.value * cover;

    const setView = (parallaxOnly) => {
      c.setTransform(px, 0, 0, px, 0, 0);
      c.translate(vw / 2, vh / 2);
      if (roll) c.rotate(roll);
      c.scale(z, z);
      c.translate(-vw / 2, -vh / 2);
      if (!parallaxOnly) c.translate(-camX, -camY);
    };

    // ---- background (screen-space world units)
    setView(true);
    if (this.transition) this.drawTransitionBack(c, v);
    else theme.drawBack(c, v);

    // ---- world
    setView(false);
    this.levelView.draw(c, run, v, (id) => this.theme(id), this.sprites);
    if (run.tutorial) this.levelView.drawTutor(c, run, v, this.time, ui.tutorLabel);
    if (run.deathMarks.length && run.mode === 'stage') this.levelView.drawDeathMarks(c, run, this.time);
    this.particles.draw(c, 0, camX - 100, camX + vw + 100);
    if (run.state !== 'dead' || run.stateT < 0.02) {
      this.player.drawTrail(c, this.cosmetics.trail.id, this.cosmetics.skin, this.time);
      if (this.cosmetics.trail.id === 'stardust' || this.cosmetics.trail.id === 'petals') this.trailParticles(cx, cy);
      if (run.state !== 'dead') this.player.draw(c, cx, cy, p.g, this.cosmetics.skin, this.sprites, this.time, speed);
    }
    this.particles.draw(c, 1, camX - 100, camX + vw + 100);
    this.drawPopups(c);

    // ---- foreground
    setView(true);
    theme.drawFront(c, v);

    // ---- post
    c.setTransform(px, 0, 0, px, 0, 0);
    if (this.tint > 0.01 || p.g === -1) {
      c.globalAlpha = (p.g === -1 ? 0.07 : 0) + this.tint * 0.06;
      c.fillStyle = p.g === -1 ? theme.pal.tintUp : '#ffffff';
      c.fillRect(0, 0, vw, vh);
      c.globalAlpha = 1;
    }
    if (ripple) {
      const W = this.canvas.width, H = this.canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const strip = Math.max(4, Math.round(6 * this.dpr));
      const amp = this.pulse * this.pulse * 9 * this.dpr;
      const ph = this.time * 28;
      // Ripple radiates from the player row.
      const py = ((cy - camY) * px);
      for (let y = 0; y < H; y += strip) {
        const d = Math.abs(y - py) / H;
        const off = Math.sin(y * 0.035 / this.dpr - ph + d * 8) * amp * (1 - d);
        ctx.drawImage(this.buf, 0, y, W, strip, off, y, W, strip);
      }
    }
    ctx.setTransform(px, 0, 0, px, 0, 0);
    this.drawVignette(ctx, vw, vh, theme.pal.vignette);
    if (this.flash.a > 0.001) {
      ctx.globalAlpha = this.flash.a;
      ctx.fillStyle = this.flash.color;
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = 1;
    }
  }

  trailParticles(cx, cy) {
    const kind = this.cosmetics.trail.id;
    if (Math.random() < 0.5) return;
    this.particles.spawn(kind === 'stardust'
      ? { x: cx - 8, y: cy + (Math.random() - 0.5) * 20, vx: -30, vy: 0, life: 0.6, size: 3, color: Math.random() < 0.5 ? '#fff' : this.cosmetics.skin.pom, add: true, shape: 'star' }
      : { x: cx - 8, y: cy, vx: -60, vy: (Math.random() - 0.5) * 40, gravFollow: 60, life: 0.9, size: 4, color: Math.random() < 0.5 ? '#ffb3cf' : '#ffe0ec', shape: 'feather', vr: 4 });
  }

  drawPopups(c) {
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const q of this.popups) {
      const k = q.life / q.max;
      const s = 1 + easeOutCubic(1 - Math.min(1, (q.max - q.life) / 0.15)) * 0.4;
      c.globalAlpha = Math.min(1, k * 3);
      c.font = `800 ${Math.round(15 * s)}px "Trebuchet MS", system-ui, sans-serif`;
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(10,5,30,0.7)';
      c.strokeText(q.text, q.x, q.y);
      c.fillStyle = q.color;
      c.fillText(q.text, q.x, q.y);
    }
    c.globalAlpha = 1;
  }

  drawVignette(ctx, w, h, color) {
    if (!this.vignette || this.vignette.color !== color) {
      const cv = makeCanvas(256, 256);
      const g = cv.getContext('2d');
      const gr = g.createRadialGradient(128, 128, 60, 128, 128, 182);
      gr.addColorStop(0, rgba(color, 0));
      gr.addColorStop(1, rgba(color, 0.75));
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 256);
      this.vignette = { c: cv, color };
    }
    ctx.drawImage(this.vignette.c, 0, 0, w, h);
  }

  /** Endless mode: blend the backgrounds of two worlds during a crossing. */
  drawTransitionBack(ctx, v) {
    const tr = this.transition;
    const a = this.theme(tr.from), b = this.theme(tr.to);
    const k = clamp((v.camX + v.w * 0.5 - tr.x0) / (tr.x1 - tr.x0), 0, 1);
    if (k < 1) a.drawBack(ctx, v);
    if (k > 0) {
      // Draw b into its own layer so its internal alpha use stays intact.
      if (!this.tbuf || this.tbuf.width !== this.canvas.width || this.tbuf.height !== this.canvas.height) {
        this.tbuf = makeCanvas(this.canvas.width, this.canvas.height);
      }
      const t = this.tbuf.getContext('2d');
      t.setTransform(this.px, 0, 0, this.px, 0, 0);
      b.drawBack(t, v);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = k;
      ctx.drawImage(this.tbuf, 0, 0);
      ctx.restore();
    }
    if (k >= 1) this.transition = null;
  }

  /** Screen-space HUD (css px). */
  drawHud(hud) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    hud.draw(ctx, this.cssW, this.cssH, this);
  }
}
