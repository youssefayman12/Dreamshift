// Somni, the sleepwalker. All animation is procedural: springs for
// orientation / squash, a verlet chain for the nightcap tail, and a run cycle
// driven by forward speed.
import { Spring, clamp, lerp, easeOutBack, rgba } from '../engine/math.js';
import { PW, PH } from '../game/sim.js';

const CAP_SEG = 7;
const SEG_LEN = 5.2;

export class PlayerView {
  constructor() {
    this.orient = new Spring(1100, 52, 1);
    this.squash = new Spring(520, 17, 0);
    this.lean = new Spring(300, 20, 0);
    this.cap = [];
    for (let i = 0; i < CAP_SEG; i++) this.cap.push({ x: 0, y: 0, px: 0, py: 0 });
    this.runPhase = 0;
    this.eyes = 0;       // >0: eyes wide open (near miss / surprise)
    this.blink = 2;
    this.spawnT = 1;     // materialise animation 0..1
    this.visible = true;
    this.trail = [];
    this.airborne = false;
    this.flipT = 0;
  }

  reset(cx, cy, g) {
    this.orient.snap(g);
    this.squash.snap(0);
    this.lean.snap(0);
    for (const p of this.cap) { p.x = p.px = cx - 8; p.y = p.py = cy - 20 * g; }
    this.trail.length = 0;
    this.visible = true;
    this.spawnT = 0;
  }

  onFlip(g) {
    this.orient.target = g;
    this.squash.kick(-9);  // stretch along travel
    this.squash.value = 0.28;
    this.flipT = 0;
    this.airborne = true;
  }

  onLand(impact) {
    const k = clamp(impact / 900, 0.15, 1);
    this.squash.value = -0.34 * k;
    this.squash.vel = 0;
    this.airborne = false;
  }

  onNear() { this.eyes = 0.55; }

  update(dt, cx, cy, g, speed, grounded, vy) {
    this.orient.target = g;
    this.orient.update(dt);
    this.squash.update(dt);
    this.lean.target = grounded ? 0.07 : clamp(-vy * g * 0.00025, -0.25, 0.25) + 0.05;
    this.lean.update(dt);
    if (grounded) this.runPhase += (speed * dt) / 13.5;
    this.airborne = !grounded;
    this.flipT += dt;
    this.eyes = Math.max(0, this.eyes - dt);
    this.blink -= dt;
    if (this.blink < -0.12) this.blink = 1.5 + Math.random() * 3;
    if (!this.frozenSpawn) this.spawnT = Math.min(1, this.spawnT + dt / 0.28);

    // Nightcap tail: verlet chain whose "gravity" follows the dream's gravity.
    const o = this.orientSafe();
    const root = this.cap[0];
    root.x = cx - 9; root.y = cy - 27 * o;
    const gx = -260, gy = 520 * g;
    for (let i = 1; i < CAP_SEG; i++) {
      const p = this.cap[i];
      const vx = (p.x - p.px) * 0.9, vyy = (p.y - p.py) * 0.9;
      p.px = p.x; p.py = p.y;
      p.x += vx + gx * dt * dt;
      p.y += vyy + gy * dt * dt;
    }
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < CAP_SEG; i++) {
        const a = this.cap[i - 1], b = this.cap[i];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const diff = (d - SEG_LEN) / d;
        if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
        else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
      }
    }

    this.trail.unshift({ x: cx, y: cy });
    if (this.trail.length > 16) this.trail.pop();
  }

  orientSafe() {
    const o = this.orient.value;
    return Math.abs(o) < 0.06 ? (o < 0 ? -0.06 : 0.06) : clamp(o, -1.15, 1.15);
  }

  drawTrail(ctx, kind, skin, t) {
    if (kind === 'none' || this.trail.length < 3) return;
    const tr = this.trail;
    if (kind === 'wisp' || kind === 'aurora') {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < tr.length - 1; i++) {
        const k = 1 - i / tr.length;
        const w = 12 * k;
        const col = kind === 'aurora'
          ? `hsla(${(t * 120 + i * 22) % 360},90%,65%,${0.26 * k})`
          : rgba(skin.pom, 0.3 * k);
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tr[i].x, tr[i].y);
        ctx.lineTo(tr[i + 1].x, tr[i + 1].y);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  draw(ctx, cx, cy, g, skin, sprites, t, speed) {
    if (!this.visible) return;
    const o = this.orientSafe();
    const sq = this.squash.value;
    const spawn = Math.max(0.01, easeOutBack(clamp(this.spawnT, 0, 1)));
    const sx = (1 - sq * 0.55) * spawn;
    const sy = (1 + sq) * spawn;

    // Aura so the silhouette always reads against busy scenery.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.32;
    const gs = sprites.glow(rgba(skin.pom, 0.55));
    ctx.drawImage(gs.c, cx - 44, cy - 44, 88, 88);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Cap tail (world space, behind body).
    const cap = this.cap;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = skin.outline;
    ctx.lineWidth = 7.5 * spawn;
    ctx.beginPath();
    ctx.moveTo(cap[0].x, cap[0].y);
    for (let i = 1; i < CAP_SEG; i++) ctx.lineTo(cap[i].x, cap[i].y);
    ctx.stroke();
    for (let i = 1; i < CAP_SEG; i++) {
      ctx.strokeStyle = i % 2 ? skin.cap : skin.capDark;
      ctx.lineWidth = (5.2 - i * 0.45) * spawn;
      ctx.beginPath();
      ctx.moveTo(cap[i - 1].x, cap[i - 1].y);
      ctx.lineTo(cap[i].x, cap[i].y);
      ctx.stroke();
    }
    const tip = cap[CAP_SEG - 1];
    ctx.globalCompositeOperation = 'lighter';
    const pg = sprites.glow(rgba(skin.pom, 0.9));
    ctx.drawImage(pg.c, tip.x - 13, tip.y - 13, 26, 26);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = skin.pom;
    ctx.strokeStyle = skin.outline;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(tip.x, tip.y, 4.2 * spawn, 0, 6.29); ctx.fill(); ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.lean.value * Math.sign(o));
    ctx.scale(sx, sy * o);
    // Local space: +y toward feet. Hitbox is ~22x34; art is a little bigger.
    const air = this.airborne;
    const ph = this.runPhase;
    const outline = skin.outline;

    // Legs
    ctx.strokeStyle = outline;
    ctx.lineCap = 'round';
    for (let leg = 0; leg < 2; leg++) {
      const p = ph + leg * Math.PI;
      let fx, fy;
      if (air) { fx = leg ? -3 : 4; fy = 12; }
      else { fx = Math.sin(p) * 7; fy = 17 - Math.max(0, Math.cos(p)) * 5; }
      ctx.lineWidth = 5.5;
      ctx.beginPath(); ctx.moveTo(leg ? -3 : 3, 8); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.strokeStyle = leg ? skin.shade : skin.body;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(leg ? -3 : 3, 8); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.strokeStyle = outline;
    }

    // Body (a soft bean — pyjama'd sleepwalker)
    const bob = air ? 0 : Math.abs(Math.sin(ph)) * -1.6;
    ctx.translate(0, bob);
    ctx.fillStyle = skin.body;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-11, 9);
    ctx.bezierCurveTo(-13, -6, -12, -20, 0, -21);
    ctx.bezierCurveTo(12, -21, 13, -6, 11, 9);
    ctx.quadraticCurveTo(0, 14, -11, 9);
    ctx.closePath();
    ctx.fill();
    // belly shade
    ctx.save();
    ctx.clip();
    ctx.fillStyle = skin.shade;
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.ellipse(-8, 4, 9, 14, 0.2, 0, 6.29); ctx.fill();
    if (skin.pattern === 'stars') {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = skin.pom;
      for (const [sx2, sy2] of [[-4, 2], [5, 5], [1, -4]]) { ctx.fillRect(sx2 - 1, sy2 - 1, 2, 2); }
    }
    ctx.restore();
    ctx.stroke();

    // Arm (swinging nub)
    const arm = air ? -0.9 : Math.sin(ph + Math.PI) * 0.7;
    ctx.save();
    ctx.translate(1, -2);
    ctx.rotate(arm);
    ctx.fillStyle = skin.body;
    ctx.beginPath(); ctx.ellipse(0, 6, 3.4, 6, 0, 0, 6.29); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Face (looks forward/right)
    const eyeCol = skin.eye ?? outline;
    ctx.strokeStyle = eyeCol;
    ctx.fillStyle = eyeCol;
    ctx.lineWidth = 1.8;
    if (this.eyes > 0) {
      for (const ex of [3.5, 9.5]) {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ex, -9, 3.1, 0, 6.29); ctx.fill(); ctx.stroke();
        ctx.fillStyle = eyeCol === '#fff' ? '#000' : eyeCol;
        ctx.beginPath(); ctx.arc(ex + 0.8, -9, 1.4, 0, 6.29); ctx.fill();
      }
    } else if (this.blink < 0) {
      ctx.beginPath(); ctx.moveTo(1.5, -8.5); ctx.lineTo(5.5, -8.5); ctx.moveTo(7.5, -8.5); ctx.lineTo(11.5, -8.5); ctx.stroke();
    } else {
      // Sleepy closed eyes — Somni is dreaming.
      ctx.beginPath(); ctx.arc(3.5, -10, 2.4, 0.25, Math.PI - 0.25); ctx.stroke();
      ctx.beginPath(); ctx.arc(9.5, -10, 2.4, 0.25, Math.PI - 0.25); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,120,160,0.45)';
    ctx.beginPath(); ctx.ellipse(10, -4.5, 2.4, 1.4, 0, 0, 6.29); ctx.fill();

    // Nightcap
    ctx.fillStyle = skin.cap;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.moveTo(-12, -13);
    ctx.bezierCurveTo(-11, -24, 4, -27, 11, -16);
    ctx.quadraticCurveTo(0, -24, -9, -27);
    ctx.lineTo(-12, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = skin.capDark;
    ctx.beginPath();
    ctx.moveTo(-13, -12); ctx.quadraticCurveTo(0, -19, 12, -14); ctx.lineTo(12, -11); ctx.quadraticCurveTo(0, -15, -13, -9); ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.restore();
  }
}

export { PW, PH };
