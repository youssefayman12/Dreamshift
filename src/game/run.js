// A single play session on a level: owns the runner, time, scoring,
// checkpoints and the death/respawn loop. Pure logic — the presentation layer
// consumes `events` every frame.
import { TILE, SIM_DT, PHYS } from '../config.js';
import { createRunner, canFlip, flip, step, PW, PH } from './sim.js';

const NEAR_DIST = 15;
const NEAR_CONFIRM = 0.12;
const DEATH_TIME = 0.62;   // death anim → respawn. Short on purpose.
const HITSTOP = 0.07;

export const SCORE = {
  frag: 10, star: 250, near: 30, checkpoint: 100, finish: 1000, flawless: 1000, perTile: 1,
};

export class Run {
  /**
   * @param {object} o
   *  level, mode: 'stage'|'endless'|'attract', stage (def), tutorial (bool)
   */
  constructor(o) {
    this.level = o.level;
    this.mode = o.mode;
    this.stage = o.stage ?? null;
    this.tutorial = !!o.tutorial;
    this.events = [];
    this.t = 0;
    this.state = 'play';
    this.stateT = 0;
    this.timeScale = 1;
    this.slowmo = 1;           // presentation-driven slow motion (set pieces, respawn)
    this.freeze = null;        // tutorial freeze {tutor}
    this.hitstop = 0;
    this.buffer = 0;
    this.deaths = 0;
    this.flips = 0;
    this.nearMisses = 0;
    this.score = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.fragsTaken = 0;
    this.starsTaken = 0;
    this.distance = 0;
    this.nearPending = new Map();
    this.nearDone = new Set();
    this.lastDeath = null;
    this.deathMarks = [];
    this.tutorIdx = 0;
    this.eventIdx = 0;
    this.continued = false;
    this.steps = 0;
    this.finished = false;
    const startX = 3 * TILE;
    this.startCp = { id: -1, x: startX, y: 13 * TILE - PH, g: 1 };
    this.cp = this.startCp;
    this.cpSnap = null;
    this.spawn(this.startCp, 0, true);
    this.snapshot(0);
  }

  get multiplier() {
    return Math.min(4, 1 + Math.floor(this.streak / 12) * 0.5);
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  spawn(cp, t, first = false) {
    this.runner = createRunner(cp.x, cp.y, cp.g);
    this.prevX = this.runner.x;
    this.prevY = this.runner.y;
    this.t = t;
    this.buffer = 0;
    this.nearPending.clear();
    this.state = 'play';
    this.stateT = 0;
    if (!first) this.emit('respawn', { cp });
  }

  snapshot(t) {
    this.cpSnap = {
      t, score: this.score, frags: this.fragsTaken, stars: this.starsTaken,
      distance: this.distance, near: new Set(this.nearDone), eventIdx: this.eventIdx,
    };
  }

  press() {
    if (this.state !== 'play') return;
    if (this.freeze) {
      // Tutorial freeze: the press that resolves it flips immediately.
      this.freeze = null;
      this.emit('tutorDone');
    }
    this.buffer = PHYS.buffer;
    this.tryFlip();
  }

  tryFlip() {
    const p = this.runner;
    if (this.buffer > 0 && canFlip(p)) {
      flip(p);
      this.buffer = 0;
      this.flips++;
      this.emit('flip', { g: p.g, x: p.x + PW / 2, y: p.y + PH / 2 });
      return true;
    }
    return false;
  }

  /** Real-time update; runs fixed sim steps. Returns steps taken. */
  update(realDt) {
    if (this.hitstop > 0) { this.hitstop -= realDt; return 0; }
    this.stateT += realDt;
    if (this.state === 'dead') {
      if (this.stateT >= DEATH_TIME && this.mode !== 'endless') this.respawn();
      return 0;
    }
    if (this.state === 'finished') return 0;
    const scale = this.freeze ? 0.0 : this.slowmo;
    this.acc = (this.acc ?? 0) + realDt * scale;
    let steps = 0;
    while (this.acc >= SIM_DT && steps < 12) {
      this.acc -= SIM_DT;
      this.fixedStep();
      steps++;
      if (this.state !== 'play' || this.freeze) { this.acc = 0; break; }
    }
    return steps;
  }

  fixedStep() {
    const p = this.runner;
    const L = this.level;
    this.onStep?.(this.steps);
    this.steps++;
    this.prevX = p.x; this.prevY = p.y;
    this.t += SIM_DT;
    if (this.buffer > 0) {
      this.tryFlip();
      this.buffer -= SIM_DT;
    }
    const ev = [];
    const x0 = p.x;
    step(p, L, this.t, SIM_DT, ev);
    for (const e of ev) {
      if (e.type === 'gate') { this.flips++; this.emit('flip', { g: p.g, x: p.x + PW / 2, y: p.y + PH / 2, gate: true }); }
      else this.emit(e.type, e);
    }
    // A press remembered in the air fires the instant we touch down.
    if (p.grounded && this.buffer > 0) this.tryFlip();

    if (!p.alive) { this.die(); return; }

    // Distance points.
    const tiles0 = Math.floor(x0 / TILE), tiles1 = Math.floor(p.x / TILE);
    if (tiles1 > tiles0) { this.distance += tiles1 - tiles0; this.score += (tiles1 - tiles0) * SCORE.perTile; }

    this.collect(p);
    this.checkNear(p);
    this.checkProgress(p);
  }

  collect(p) {
    const cx = p.x + PW / 2, cy = p.y + PH / 2;
    for (const k of this.level.pickups) {
      if (k.taken) continue;
      if (k.x > cx + 60) break;
      if (k.x < cx - 60) continue;
      const r = k.type === 'star' ? 30 : 22;
      const dx = k.x - cx, dy = k.y - cy;
      if (dx * dx + dy * dy < r * r) {
        k.taken = true;
        k.takenT = this.t;
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        const pts = Math.round((k.type === 'star' ? SCORE.star : SCORE.frag) * this.multiplier);
        this.score += pts;
        if (k.type === 'star') this.starsTaken++; else this.fragsTaken++;
        this.emit(k.type === 'star' ? 'star' : 'frag', { pickup: k, pts, streak: this.streak });
      }
    }
  }

  checkNear(p) {
    const L = this.level;
    L.hazardsAround(p.x, (h) => {
      if (this.nearDone.has(h.group) || this.nearPending.has(h.group)) return;
      const d = h.near(p.x, p.y, PW, PH, this.t);
      if (d < NEAR_DIST) this.nearPending.set(h.group, { t: this.t, h });
    });
    for (const [g, n] of this.nearPending) {
      if (this.t - n.t >= NEAR_CONFIRM) {
        this.nearPending.delete(g);
        this.nearDone.add(g);
        this.nearMisses++;
        this.streak += 2;
        const pts = Math.round(SCORE.near * this.multiplier);
        this.score += pts;
        this.emit('near', { pts, x: p.x + PW / 2, y: p.y + PH / 2, h: n.h });
      }
    }
  }

  checkProgress(p) {
    const L = this.level;
    // Checkpoints
    for (const cp of L.checkpoints) {
      if (cp.id > this.cp.id && p.x >= cp.x) {
        this.cp = { ...cp, t: this.t };
        this.score += SCORE.checkpoint;
        this.snapshot(this.t);
        this.emit('checkpoint', { cp });
      }
    }
    // Tutorial cues
    while (this.tutorIdx < L.tutors.length && L.tutors[this.tutorIdx].x <= p.x) {
      const tu = L.tutors[this.tutorIdx++];
      if (this.tutorial && p.grounded) {
        this.freeze = { tutor: tu };
        this.emit('tutor', { tutor: tu });
      }
    }
    // Set-piece events
    while (this.eventIdx < L.events.length && L.events[this.eventIdx].x <= p.x) {
      this.emit('setpiece', { ev: L.events[this.eventIdx++] });
    }
    // Finish
    if (!this.finished && p.x >= L.finishX) {
      this.finished = true;
      this.state = 'finished';
      this.stateT = 0;
      this.score += SCORE.finish;
      if (this.deaths === 0) this.score += SCORE.flawless;
      this.emit('finish');
    }
  }

  die() {
    const p = this.runner;
    this.state = 'dead';
    this.stateT = 0;
    this.hitstop = HITSTOP;
    this.deaths++;
    this.streak = 0;
    this.freeze = null;
    this.lastDeath = { ...p.death, g: p.g, t: this.t };
    this.deathMarks.push({ x: p.x + PW / 2, y: p.y + PH / 2, g: p.g });
    if (this.deathMarks.length > 3) this.deathMarks.shift();
    this.emit('death', { death: p.death, g: p.g });
  }

  respawn() {
    const s = this.cpSnap;
    // Failure isn't free: progress since the checkpoint is rolled back.
    this.score = s.score;
    this.fragsTaken = s.frags;
    this.starsTaken = s.stars;
    this.distance = s.distance;
    this.nearDone = new Set(s.near);
    for (const k of this.level.pickups) if (k.taken && k.takenT > s.t) k.taken = false;
    this.tutorIdx = this.level.tutors.findIndex((tu) => tu.x > this.cp.x);
    if (this.tutorIdx < 0) this.tutorIdx = this.level.tutors.length;
    this.eventIdx = s.eventIdx;
    this.spawn(this.cp, s.t);
  }

  /** Endless: one rewarded continue — resume at the next safe chunk start. */
  continueRun() {
    if (this.continued) return false;
    this.continued = true;
    const L = this.level;
    const x = this.runner.x;
    const mark = L.chunkMarks.find((m) => m.x > x + TILE * 2 && m.safe);
    const cx = mark ? mark.x + TILE : x + TILE * 20;
    this.spawn({ x: cx, y: 13 * TILE - PH, g: 1 }, this.t + (cx - x) / L.speedAt(x));
    return true;
  }
}
