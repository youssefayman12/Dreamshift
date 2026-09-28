// Top-level orchestration: menus ↔ runs, the main loop, progression hooks,
// audio and portal lifecycle calls.
import { SIM_DT, DEBUG, TILE } from '../config.js';
import { buildStage } from './level.js';
import { Run } from './run.js';
import { Bot } from './bot.js';
import { EndlessDirector } from './endless.js';
import { STAGES, STAGE_BY_ID, CHUNKS, WORLDS, WORLD_META } from '../levels/stages.js';
import { Renderer } from '../render/renderer.js';
import { Hud } from '../render/hud.js';
import { Progress } from './progression.js';
import { AudioEngine } from '../engine/audio.js';
import { Input } from '../engine/input.js';
import { UI } from '../ui/ui.js';
import { AdPolicy } from '../platform/ads.js';
import { hashStr } from '../engine/math.js';

const todayKey = () => new Date().toISOString().slice(0, 10);

export class Game {
  constructor({ canvas, uiRoot, platform, analytics }) {
    this.platform = platform;
    this.analytics = analytics;
    this.progress = new Progress();
    this.audio = new AudioEngine();
    this.renderer = new Renderer(canvas);
    this.hud = new Hud();
    this.input = new Input(document.getElementById('app'));
    this.ads = new AdPolicy(platform, analytics);
    this.ui = new UI(uiRoot, this);
    this.state = 'title';
    this.run = null;
    this.bot = null;
    this.params = new URLSearchParams(location.search);
    this.perf = { acc: 0, n: 0, t: 0, lowStrikes: 0 };
    this.respawnT = 1;
    this.applySettings();
    this.renderer.cosmetics = this.progress.equipped;
    this.renderer.onSfx = (name, e) => {
      if (this.run?.mode !== 'attract' || name === 'setpiece') this.audio.sfx(name, e);
    };

    platform.onAdStart = () => { this.audio.setMuted(true); };
    platform.onAdEnd = () => { this.audio.setMuted(this.progress.settings.muted ?? false); };

    this.input.on('any', () => this.audio.unlock());
    this.input.on('press', () => this.onPress());
    this.input.on('pause', () => {
      if (this.state === 'play') this.pause();
      else if (this.state === 'pause') this.resume();
    });
    this.input.on('restart', () => {
      if (this.state === 'play' || this.state === 'pause' || this.state === 'results' || this.state === 'over') this.restart();
    });
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.state === 'play') this.pause(); this.audio.ctx?.suspend(); }
      else if (!this.audio.muted) this.audio.ctx?.resume();
    });
    window.addEventListener('blur', () => { if (this.state === 'play') this.pause(); });
    this.onResize();
  }

  // ------------------------------------------------------------ settings

  applySettings() {
    const s = this.progress.settings;
    this.audio.setVolumes(s.music, s.sfx);
    this.audio.setMuted(!!s.muted);
    this.renderer.reducedMotion = !!s.reducedMotion;
    if (s.quality !== 'auto') this.renderer.setQuality(s.quality);
    else if (this.renderer.quality !== this.autoQuality) this.renderer.setQuality(this.autoQuality ?? 'high');
  }

  setSetting(k, v) {
    this.progress.settings[k] = v;
    this.progress.save();
    this.applySettings();
  }

  toggleMute() {
    this.audio.unlock();
    this.setSetting('muted', !this.progress.settings.muted);
  }

  cosmeticAction(kind, id) {
    const p = this.progress;
    if (p.owns(kind, id)) p.equip(kind, id);
    else if (p.buy(kind, id)) { this.audio.sfx('buy'); this.analytics.track('cosmetic_buy', { kind, id }); }
    this.renderer.cosmetics = p.equipped;
  }

  onResize() {
    this.renderer.resize();
    this.ui.setRotateHint(this.renderer.portrait && this.state === 'play');
  }

  // ------------------------------------------------------------ flow

  boot() {
    this.startAttract();
    this.ui.show('title');
    this.audio.playTrack('menu', 0.3);
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    if (this.params.has('stage')) this.startStage(this.params.get('stage'));
    if (this.params.has('endless')) this.startEndless();
  }

  startAttract() {
    // The menu dreams of the furthest world you've reached.
    const unlocked = WORLDS.filter((w) => this.progress.isUnlocked(w.stages[0]));
    const w = unlocked[unlocked.length - 1] ?? WORLDS[0];
    const st = STAGE_BY_ID[w.stages[1] ?? w.stages[0]];
    const level = buildStage(st, CHUNKS);
    this.run = new Run({ level, mode: 'attract', stage: st });
    this.bot = new Bot(this.run);
    this.renderer.attach(this.run);
    this.hud.reset();
    this.state = 'title';
  }

  beginRun(run, music) {
    document.activeElement?.blur?.();
    this.audio.unlock();
    this.run = run;
    this.bot = this.params.has('bot') ? new Bot(run) : null;
    this.renderer.cosmetics = this.progress.equipped;
    this.renderer.attach(run);
    this.hud.reset();
    this.state = 'play';
    this.ui.show('game');
    this.ui.setRotateHint(this.renderer.portrait);
    this.audio.duck(false);
    this.audio.playTrack(music, 1);
    this.platform.gameplayStart();
    this.runStart = performance.now();
  }

  startStage(id) {
    const st = STAGE_BY_ID[id];
    if (!st) return this.startEndless();
    if (!this.progress.isUnlocked(id)) return;
    const level = buildStage(st, CHUNKS);
    const run = new Run({ level, mode: 'stage', stage: st, tutorial: id === '1-1' && !this.progress.data.tutorialDone });
    this.beginRun(run, st.world);
    this.ui.stageCard(`${st.id} · ${WORLD_META[st.world].name.toUpperCase()}`, st.name.toUpperCase(), st.hint ?? '');
    this.analytics.track('stage_start', { id });
  }

  startEndless(daily = false) {
    if (!this.progress.endlessUnlocked && !this.params.has('endless')) return;
    let worlds = WORLDS.filter((w) => this.progress.isUnlocked(w.stages[0])).map((w) => w.id);
    let seed;
    if (daily) {
      // Everyone dreams the same dream today: fixed seed, every world.
      seed = hashStr('dreamshift-daily-' + todayKey());
      worlds = WORLDS.map((w) => w.id);
    }
    const dir = new EndlessDirector(worlds.length ? worlds : ['city'], seed, { worldLen: +this.params.get('worldlen') || undefined });
    const run = new Run({ level: dir.level, mode: 'endless' });
    run.director = dir;
    run.daily = daily ? todayKey() : null;
    run.worldName = dir.worldName;
    run.worldsSeen = 1;
    this.beginRun(run, dir.world);
    this.ui.stageCard(daily ? 'DAILY DREAM · ' + todayKey() : 'ENDLESS DREAM', dir.worldName.toUpperCase());
    this.analytics.track('endless_start', { daily });
  }

  restart() {
    this.bankRun();
    if (this.run?.mode === 'endless') this.startEndless(!!this.run.daily);
    else if (this.run?.stage) this.startStage(this.run.stage.id);
  }

  nextStage() {
    const i = STAGES.findIndex((s) => s.id === this.run?.stage?.id);
    const next = STAGES[i + 1];
    if (next) this.startStage(next.id); else this.toTitle();
  }

  async toTitle() {
    if (this.state === 'play' || this.state === 'pause') this.bankRun();
    this.platform.gameplayStop();
    this.startAttract();
    this.ui.show('title');
    this.audio.duck(false);
    this.audio.playTrack('menu', 0.3);
    await this.ads.naturalBreak('menu');
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause';
    this.platform.gameplayStop();
    this.audio.duck(true, 500);
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'pause') return;
    this.state = 'play';
    this.platform.gameplayStart();
    this.audio.duck(false);
    this.ui.show('game');
    this.last = performance.now();
  }

  onPress() {
    if (this.state === 'play' && this.run && !this.bot) this.run.press();
    else if (this.state === 'over' && this.overReady) this.startEndless(!!this.run?.daily);
  }

  /** Add the run's fragments to the wallet (on any exit). */
  bankRun() {
    const r = this.run;
    if (!r || r.mode === 'attract' || r.banked) return;
    r.banked = true;
    const dust = r.fragsTaken + r.starsTaken * 10;
    this.progress.addDust(dust);
    const st = this.progress.data.stats;
    st.flips += r.flips; st.deaths += r.deaths; st.near += r.nearMisses; st.runs++;
    st.bestStreak = Math.max(st.bestStreak, r.bestStreak);
    st.time += (performance.now() - (this.runStart ?? performance.now())) / 1000;
    this.progress.save();
    this.checkAchievements();
  }

  checkAchievements() {
    for (const a of this.progress.evaluate()) {
      this.ui.toast('★ ' + a.name, a.desc + (a.reward ? ` Unlocked: ${a.reward}!` : ''));
      this.audio.sfx('achievement');
      this.analytics.track('achievement', { id: a.id });
    }
  }

  async finishStage() {
    const r = this.run;
    this.state = 'results';
    this.platform.gameplayStop();
    this.platform.happyTime();
    let starMask = 0;
    r.level.pickups.filter((k) => k.type === 'star').forEach((k, i) => { if (k.taken) starMask |= 1 << i; });
    const res = this.progress.completeStage(r.stage.id, { score: r.score, deaths: r.deaths, starMask });
    this.bankRun();
    this.analytics.track('stage_complete', { id: r.stage.id, score: r.score, deaths: r.deaths });
    const i = STAGES.findIndex((s) => s.id === r.stage.id);
    const rec = this.progress.stage(r.stage.id);
    await this.ads.naturalBreak('stageComplete');
    this.audio.duck(true, 1200);
    if (!STAGES[i + 1]) {
      this.ui.show('ending', { score: r.score });
      this.state = 'ending';
      return;
    }
    this.ui.show('results', {
      id: r.stage.id, name: r.stage.name, score: r.score, starMask: rec.starMask, starTotal: r.level.starCount,
      newBest: res.newBest && !res.firstClear, flawless: r.deaths === 0, newStars: res.newStars,
      frags: r.fragsTaken, fragTotal: r.level.fragCount, near: r.nearMisses, deaths: r.deaths, streak: r.bestStreak,
      hasNext: !!STAGES[i + 1],
      canDouble: this.platform.hasRewarded && r.fragsTaken + r.starsTaken > 0,
      unlocked: res.unlocked.length ? res.unlocked[0] : (res.firstClear && r.stage.id === '1-1' ? 'ENDLESS' : ''),
    });
  }

  async endlessOver() {
    const r = this.run;
    this.state = 'over';
    this.overReady = false;
    this.platform.gameplayStop();
    const e = this.progress.data.endless;
    const dist = Math.floor(r.distance);
    let newBest = dist > e.bestDist;
    e.bestDist = Math.max(e.bestDist, dist);
    e.best = Math.max(e.best, r.score);
    let bestDist = e.bestDist;
    if (r.daily) {
      const d = this.progress.data.daily ?? {};
      if (d.date !== r.daily) { d.date = r.daily; d.best = 0; }
      newBest = dist > d.best;
      d.best = Math.max(d.best, dist);
      bestDist = d.best;
      this.progress.data.daily = d;
    }
    this.bankRun();
    this.analytics.track('endless_over', { dist, score: r.score });
    this.audio.duck(true, 900);
    this.ui.show('over', {
      dist, score: r.score, frags: r.fragsTaken, near: r.nearMisses, worlds: r.worldsSeen, newBest, bestDist, daily: r.daily,
      canContinue: !r.continued && this.platform.hasRewarded,
    });
    // Brief lockout so a panicked tap doesn't instantly restart.
    setTimeout(() => { this.overReady = true; }, 450);
  }

  /** Optional rewarded ad on the results screen: bank the run's fragments again. */
  async rewardedDouble() {
    const r = this.run;
    if (!r || r.doubled) return false;
    const ok = await this.ads.rewarded('double_fragments');
    if (!ok) { this.ui.toast('No ad available', 'Your fragments are safe either way.'); return false; }
    r.doubled = true;
    const bonus = r.fragsTaken + r.starsTaken * 10;
    this.progress.addDust(bonus);
    this.progress.save();
    this.ui.toast('✦ Fragments doubled', `+${bonus} dream fragments`);
    this.audio.sfx('buy');
    return true;
  }

  async rewardedContinue() {
    const r = this.run;
    if (!r || r.mode !== 'endless' || r.continued) return;
    const ok = await this.ads.rewarded('endless_continue');
    if (!ok) { this.ui.toast('No ad available', 'Try again later — or just dream again!'); return; }
    // Un-bank so the continued run's total is banked once at the end.
    r.banked = false;
    const st = this.progress.data.stats;
    st.runs--;
    this.progress.addDust(-(r.fragsTaken + r.starsTaken * 10));
    r.continueRun();
    this.renderer.handle(r.events.splice(0));
    this.state = 'play';
    this.ui.show('game');
    this.audio.duck(false);
    this.platform.gameplayStart();
  }

  // ------------------------------------------------------------ loop

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    this.monitorPerf(dt);
    const run = this.run;
    if (!run) return;

    const live = this.state === 'play' || this.state === 'title' || this.state === 'menu-wait';
    if (live) {
      if (run.director) this.feedEndless(run);
      this.respawnT += dt;
      run.slowmo = Math.min(1, 0.45 + (this.respawnT / 0.4) * 0.55) * (this.renderer.slowmoFx > 0 ? 0.7 : 1);
      run.update(dt);
      const events = run.events.splice(0);
      if (events.length) {
        this.renderer.handle(events);
        this.onRunEvents(events);
      }
      if (run.state === 'finished' && run.stateT > 1.05 && this.state === 'play') this.finishStage();
      if (run.state === 'dead' && run.mode === 'endless' && run.stateT > 0.75 && this.state === 'play') this.endlessOver();
      if (run.mode === 'attract' && run.state === 'finished') this.startAttract();
      this.renderer.update(dt);
    } else if (this.state === 'results' || this.state === 'over' || this.state === 'ending') {
      // keep the dream alive behind menus
      this.renderer.update(dt * 0.3);
    }
    const alpha = Math.min(1, (run.acc ?? 0) / SIM_DT);
    this.renderer.render(alpha, { tutorLabel: this.input.label });
    this.hud.visible = this.state === 'play' || this.state === 'pause';
    this.hud.update(dt, run);
    this.renderer.drawHud(this.hud);
    if (DEBUG) this.drawDebug(dt);
  }

  feedEndless(run) {
    const dir = run.director;
    dir.fill(run.runner.x);
    const R = this.renderer;
    const b = dir.boundaries.find((x) => !x.started && run.runner.x > x.x - 700);
    if (b) {
      b.started = true;
      R.transition = { from: b.from, to: b.to, x0: b.x - 200, x1: b.x + 700 };
      R.theme(b.to);
    }
    const d = dir.boundaries.find((x) => !x.done && run.runner.x > x.x);
    if (d) {
      d.done = true;
      run.level.theme = d.to;
      run.worldName = WORLD_META[d.to].name;
      run.worldsSeen++;
      this.audio.playTrack(d.to, 1);
      this.ui.stageCard('YOU DRIFT INTO', run.worldName.toUpperCase());
    }
  }

  onRunEvents(events) {
    const run = this.run;
    for (const e of events) {
      if (e.type === 'respawn') this.respawnT = 0;
      if (run.mode === 'attract') continue;
      if (e.type === 'flip' && !this.progress.data.ach.first_flip) {
        this.progress.data.stats.flips++;
        this.checkAchievements();
      }
      if (e.type === 'death') this.analytics.track('death', { cause: e.death.cause, x: Math.round(run.runner.x / TILE), stage: run.stage?.id });
      if (e.type === 'tutor' || e.type === 'tutorDone') {
        if (run.tutorIdx >= run.level.tutors.length && e.type === 'tutorDone') {
          this.progress.data.tutorialDone = true;
          this.progress.save();
        }
      }
      if (e.type === 'checkpoint' && run.tutorial && run.tutorIdx >= run.level.tutors.length) {
        this.progress.data.tutorialDone = true;
        this.progress.save();
      }
    }
  }

  monitorPerf(dt) {
    const p = this.perf;
    if (this.state !== 'play') return;
    p.acc += dt; p.n++;
    if (p.acc >= 3) {
      const avg = p.acc / p.n;
      p.acc = 0; p.n = 0;
      if (this.progress.settings.quality === 'auto' && avg > 0.024 && this.renderer.quality === 'high') {
        if (++p.lowStrikes >= 2) {
          this.autoQuality = 'low';
          this.renderer.setQuality('low');
          this.analytics.track('auto_quality_low', { avg });
        }
      } else p.lowStrikes = 0;
    }
  }

  drawDebug(dt) {
    const ctx = this.renderer.ctx;
    this._fps = (this._fps ?? 60) * 0.95 + (1 / dt) * 0.05;
    ctx.setTransform(this.renderer.dpr, 0, 0, this.renderer.dpr, 0, 0);
    ctx.fillStyle = '#0f0';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    const r = this.run.runner;
    ctx.fillText(`${this._fps.toFixed(0)} fps  x:${(r.x / TILE).toFixed(1)} g:${r.g} q:${this.renderer.quality}`, 10, this.renderer.cssH - 10);
  }
}
