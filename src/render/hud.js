// Minimal in-run HUD drawn on the canvas: progress, score, multiplier,
// fragments and stars. Only what's genuinely useful mid-run.
import { clamp, damp, TAU } from '../engine/math.js';

const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export class Hud {
  constructor() {
    this.shownScore = 0;
    this.bump = 0;
    this.fragBump = 0;
    this.lastScore = 0;
    this.lastFrags = 0;
    this.visible = true;
  }

  reset() { this.shownScore = 0; this.lastScore = 0; this.lastFrags = 0; }

  update(dt, run) {
    if (run.score > this.lastScore) this.bump = 1;
    if (run.fragsTaken + run.starsTaken !== this.lastFrags) this.fragBump = 1;
    this.lastScore = run.score;
    this.lastFrags = run.fragsTaken + run.starsTaken;
    this.shownScore = run.score < this.shownScore ? run.score : damp(this.shownScore, run.score, 12, dt);
    this.bump = Math.max(0, this.bump - dt * 4);
    this.fragBump = Math.max(0, this.fragBump - dt * 5);
    this.run = run;
  }

  draw(ctx, W, H) {
    const run = this.run;
    if (!run || !this.visible) return;
    const u = clamp(Math.min(W, H) / 540, 0.72, 1.35);
    const pad = 14 * u;
    ctx.textBaseline = 'middle';

    // ---- progress (stage) / distance (endless)
    const L = run.level;
    ctx.textAlign = 'left';
    if (run.mode === 'stage') {
      const bw = Math.min(200 * u, W * 0.32), bh = 5 * u;
      const x = pad, y = pad + 22 * u;
      ctx.font = `700 ${12 * u}px ${FONT}`;
      ctx.fillStyle = 'rgba(235,225,255,0.75)';
      ctx.fillText(`${run.stage.id}  ${run.stage.name.toUpperCase()}`, x, pad + 6 * u);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      roundRect(ctx, x, y, bw, bh, bh / 2); ctx.fill();
      const k = clamp(run.runner.x / L.finishX, 0, 1);
      const grad = ctx.createLinearGradient(x, 0, x + bw, 0);
      grad.addColorStop(0, '#8ff6ff'); grad.addColorStop(1, '#ff9ad5');
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, Math.max(bh, bw * k), bh, bh / 2); ctx.fill();
      for (const cp of L.checkpoints) {
        const cx = x + bw * (cp.x / L.finishX);
        ctx.fillStyle = run.cp.id >= cp.id ? '#ffd98a' : 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.arc(cx, y + bh / 2, 3.2 * u, 0, TAU); ctx.fill();
      }
      // stars
      for (let i = 0; i < L.starCount; i++) {
        drawStar(ctx, x + 8 * u + i * 20 * u, y + 20 * u, 7 * u, i < run.starsTaken ? '#ffd45c' : 'rgba(255,255,255,0.18)');
      }
    } else if (run.mode === 'endless') {
      ctx.font = `800 ${22 * u}px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.fillText(`${Math.floor(run.distance)} m`, pad, pad + 12 * u);
      ctx.font = `700 ${11 * u}px ${FONT}`;
      ctx.fillStyle = 'rgba(235,225,255,0.6)';
      ctx.fillText(run.worldName?.toUpperCase() ?? '', pad, pad + 32 * u);
    }

    if (run.mode === 'attract') return;

    // ---- score (top centre)
    ctx.textAlign = 'center';
    const s = 1 + this.bump * 0.08;
    ctx.font = `800 ${26 * u * s}px ${FONT}`;
    ctx.lineWidth = 5 * u;
    ctx.strokeStyle = 'rgba(8,4,24,0.45)';
    const sc = Math.round(this.shownScore).toLocaleString('en-US');
    ctx.strokeText(sc, W / 2, pad + 14 * u);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(sc, W / 2, pad + 14 * u);
    const m = run.multiplier;
    if (m > 1) {
      ctx.font = `800 ${13 * u}px ${FONT}`;
      const pulse = 0.75 + Math.sin(performance.now() / 120) * 0.25;
      ctx.fillStyle = `rgba(143,246,255,${pulse})`;
      ctx.fillText(`×${m} FLOW`, W / 2, pad + 38 * u);
    }
    // fragments
    ctx.font = `700 ${14 * u * (1 + this.fragBump * 0.15)}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText(`✦ ${run.fragsTaken}`, W - pad - 52 * u, pad + 14 * u);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStar(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * TAU - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}
