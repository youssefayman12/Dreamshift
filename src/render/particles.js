// Pooled particle system. Particles live in world space; `grav` lets ambient
// motes follow the current gravity direction so the dream reacts to flips.
const MAX = 900;

export class Particles {
  constructor() {
    this.p = [];
    for (let i = 0; i < MAX; i++) this.p.push({ on: false });
    this.cursor = 0;
    this.budget = 1; // scaled down on low quality
  }

  spawn(o) {
    if (this.budget < 1 && Math.random() > this.budget) return null;
    for (let k = 0; k < MAX; k++) {
      const i = (this.cursor + k) % MAX;
      const q = this.p[i];
      if (!q.on) {
        this.cursor = (i + 1) % MAX;
        q.on = true;
        q.x = o.x; q.y = o.y;
        q.vx = o.vx ?? 0; q.vy = o.vy ?? 0;
        q.ax = o.ax ?? 0; q.ay = o.ay ?? 0;
        q.drag = o.drag ?? 0;
        q.life = q.max = o.life ?? 0.6;
        q.size = o.size ?? 3;
        q.size1 = o.size1 ?? 0;
        q.color = o.color ?? '#fff';
        q.shape = o.shape ?? 'dot';
        q.rot = o.rot ?? Math.random() * 6.28;
        q.vr = o.vr ?? 0;
        q.alpha = o.alpha ?? 1;
        q.add = o.add ?? false;
        q.gravFollow = o.gravFollow ?? 0;
        q.layer = o.layer ?? 0; // 0 world, 1 above player
        return q;
      }
    }
    return null;
  }

  burst(n, fn) {
    for (let i = 0; i < n; i++) this.spawn(fn(i, n));
  }

  update(dt, g) {
    for (const q of this.p) {
      if (!q.on) continue;
      q.life -= dt;
      if (q.life <= 0) { q.on = false; continue; }
      q.vx += q.ax * dt;
      q.vy += (q.ay + q.gravFollow * g) * dt;
      if (q.drag) { const d = Math.exp(-q.drag * dt); q.vx *= d; q.vy *= d; }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
    }
  }

  clear() { for (const q of this.p) q.on = false; }

  draw(ctx, layer, x0, x1) {
    let add = false;
    ctx.globalCompositeOperation = 'source-over';
    for (const q of this.p) {
      if (!q.on || q.layer !== layer || q.x < x0 || q.x > x1) continue;
      const k = q.life / q.max;
      const s = q.size1 + (q.size - q.size1) * k;
      if (s <= 0.05) continue;
      if (q.add !== add) {
        add = q.add;
        ctx.globalCompositeOperation = add ? 'lighter' : 'source-over';
      }
      ctx.globalAlpha = q.alpha * Math.min(1, k * 2.2);
      ctx.fillStyle = q.color;
      switch (q.shape) {
        case 'dot':
          ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
          break;
        case 'circle':
          ctx.beginPath(); ctx.arc(q.x, q.y, s, 0, 6.2832); ctx.fill();
          break;
        case 'ring':
          ctx.strokeStyle = q.color;
          ctx.lineWidth = Math.max(0.5, s * 0.12);
          ctx.beginPath(); ctx.arc(q.x, q.y, (1 - k) * q.vr + s, 0, 6.2832); ctx.stroke();
          break;
        case 'streak': {
          const len = Math.hypot(q.vx, q.vy) * 0.035 + s;
          const a = Math.atan2(q.vy, q.vx);
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(a);
          ctx.fillRect(-len, -s * 0.35, len, s * 0.7);
          ctx.restore();
          break;
        }
        case 'feather': {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
          ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.38, 0, 0, 6.2832); ctx.fill();
          ctx.restore();
          break;
        }
        case 'star': {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const r = i % 2 ? s * 0.35 : s;
            const a = (i / 8) * 6.2832;
            if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(r, 0);
          }
          ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        }
        case 'shard': {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
          ctx.beginPath(); ctx.moveTo(-s, -s * 0.6); ctx.lineTo(s, -s * 0.2); ctx.lineTo(-s * 0.3, s * 0.8); ctx.closePath(); ctx.fill();
          ctx.restore();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
