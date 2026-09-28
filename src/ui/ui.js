// DOM menus. Kept deliberately light: one big PLAY button gets players into
// a run immediately; everything else is one tap away but never in the way.
import { STAGES, STAGE_BY_ID, WORLDS } from '../levels/stages.js';
import { CATALOG } from '../game/cosmetics.js';
import { ACHIEVEMENTS } from '../game/progression.js';
import { PlayerView } from '../render/playerView.js';
import { SpriteBank } from '../render/sprites.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor(root, game) {
    this.root = root;
    this.g = game;
    this.current = null;
    this.tab = 'skin';
    root.innerHTML = `
      <div class="screen" id="s-title" data-ui></div>
      <div class="screen dim" id="s-stages" data-ui></div>
      <div class="screen dim" id="s-wardrobe" data-ui></div>
      <div class="screen dim" id="s-settings" data-ui></div>
      <div class="screen dim" id="s-pause" data-ui></div>
      <div class="screen dim" id="s-results" data-ui></div>
      <div class="screen dim" id="s-over" data-ui></div>
      <div class="screen dim" id="s-ending" data-ui></div>
      <button id="hud-pause" class="icon" data-ui data-act="pause" aria-label="Pause">❚❚</button>
      <div class="stage-card" id="stage-card"><div class="n"></div><div class="t"></div><div class="h"></div></div>
      <div class="rotate" id="rotate">↻ Rotate your device for a wider view</div>
      <div class="toasts" id="toasts"></div>`;
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      e.stopPropagation();
      this.g.audio.unlock();
      const act = b.dataset.act;
      if (act !== 'pause') this.g.audio.sfx(act === 'back' || act === 'menu' ? 'uiBack' : 'ui');
      this.act(act, b.dataset);
    });
    root.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.set) this.g.setSetting(t.dataset.set, parseFloat(t.value));
    });
    this.previewView = new PlayerView();
    this.previewSprites = new SpriteBank();
  }

  act(a, d) {
    const g = this.g;
    switch (a) {
      case 'play': g.startStage(g.progress.nextStage() ?? 'endless'); break;
      case 'stage': g.startStage(d.id); break;
      case 'endless': g.startEndless(d.daily === '1'); break;
      case 'double': g.rewardedDouble().then((ok) => { if (ok) this.root.querySelector('[data-act=double]')?.remove(); }); break;
      case 'stages': this.show('stages'); break;
      case 'wardrobe': this.show('wardrobe'); break;
      case 'settings': this.settingsFrom = this.current; this.show('settings'); break;
      case 'back': this.show(this.settingsFrom && this.current === 'settings' ? this.settingsFrom : 'title'); this.settingsFrom = null; break;
      case 'pause': g.pause(); break;
      case 'resume': g.resume(); break;
      case 'restart': g.restart(); break;
      case 'menu': g.toTitle(); break;
      case 'next': g.nextStage(); break;
      case 'continue': g.rewardedContinue(); break;
      case 'mute': g.toggleMute(); this.refresh(); break;
      case 'tab': this.tab = d.tab; this.renderWardrobe(); break;
      case 'item': g.cosmeticAction(d.kind, d.id); this.renderWardrobe(); break;
      case 'toggle': g.setSetting(d.key, !g.progress.settings[d.key]); this.renderSettings(); break;
      case 'quality': g.setSetting('quality', d.q); this.renderSettings(); break;
      case 'reset':
        if (this.confirmReset) { g.progress.reset(); this.confirmReset = false; this.toast('Progress reset', 'A fresh dream begins.'); this.show('title'); }
        else { this.confirmReset = true; this.renderSettings(); }
        break;
    }
  }

  show(name, data) {
    this.current = name;
    for (const s of this.root.querySelectorAll('.screen')) s.classList.toggle('on', s.id === 's-' + name);
    const r = this['render' + name[0].toUpperCase() + name.slice(1)];
    if (r) r.call(this, data);
    this.setHudPause(name === 'game');
    if (name !== 'wardrobe') cancelAnimationFrame(this.previewRaf);
    // Focus the primary action for keyboard players.
    requestAnimationFrame(() => {
      const el = this.root.querySelector(`#s-${name} [data-focus]`);
      if (el && this.g.input.device === 'keyboard') el.focus({ preventScroll: true });
    });
  }

  hideAll() { this.show('game'); }
  refresh() { if (this.current) this.show(this.current); }
  setHudPause(on) { $('#hud-pause', this.root).classList.toggle('on', on); }
  setRotateHint(on) { $('#rotate', this.root).classList.toggle('on', on); }

  stageCard(num, title, hint = '') {
    const c = $('#stage-card', this.root);
    c.querySelector('.n').textContent = num;
    c.querySelector('.t').textContent = title;
    c.querySelector('.h').textContent = hint;
    c.classList.remove('show');
    void c.offsetWidth;
    c.classList.add('show');
  }

  toast(title, text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<b>${esc(title)}</b>${esc(text)}`;
    $('#toasts', this.root).appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  // ------------------------------------------------------------ screens

  renderTitle() {
    const g = this.g, p = g.progress;
    const next = p.nextStage();
    const st = next ? STAGE_BY_ID[next] : null;
    const logo = (w, cls) => `<span class="${cls}">${[...w].map((ch, i) => `<span class="l" style="animation-delay:${i * 0.12}s">${ch}</span>`).join('')}</span>`;
    $('#s-title').innerHTML = `
      <div class="corner-l"><span class="dust" title="Dream fragments">✦ ${p.data.dust}</span></div>
      <div class="corner">
        <button class="icon ghost" data-act="mute" aria-label="Toggle sound">${g.audio.muted ? '🔇' : '🔊'}</button>
        <button class="icon ghost" data-act="settings" aria-label="Settings">⚙</button>
      </div>
      <div class="logo">${logo('DREAM', 'dream')}${logo('SHIFT', 'shift')}</div>
      <div class="tagline">${g.input.label === 'TAP' ? 'Tap' : g.input.label === 'CLICK' ? 'Click' : 'Press Space'} to shift gravity. Keep dreaming.</div>
      <button class="primary big" data-act="play" data-focus>▶ PLAY<small>${st ? `${st.id} · ${esc(st.name)}` : 'Endless Dream'}</small></button>
      <div class="row">
        <button data-act="stages">☾ Dreams</button>
        <button data-act="endless" ${p.endlessUnlocked ? '' : 'disabled title="Finish 1-1 to unlock"'}>∞ Endless${p.endlessUnlocked ? '' : ' 🔒'}</button>
        ${p.endlessUnlocked ? '<button data-act="endless" data-daily="1" title="Same dream for everyone today">☀ Daily</button>' : ''}
        <button data-act="wardrobe">✧ Wardrobe</button>
      </div>`;
  }

  renderStages() {
    const p = this.g.progress;
    const worlds = WORLDS.map((w) => {
      const locked = !p.isUnlocked(w.stages[0]);
      const stars = p.worldStars(w.id);
      const btns = w.stages.map((id) => {
        const s = STAGE_BY_ID[id], rec = p.stage(id), un = p.isUnlocked(id);
        const st = [0, 1, 2].map((i) => `<i class="${rec.starMask >> i & 1 ? 'got' : ''}">★</i>`).join('');
        return `<button class="stage-btn ghost" data-act="stage" data-id="${id}" ${un ? '' : 'disabled'}>
          <span>${id} ${esc(s.name)}${rec.flawless ? ' ✧' : ''}</span><span class="st">${un ? st : '🔒'}</span></button>`;
      }).join('');
      return `<div class="world ${locked ? 'locked' : ''}" style="--wc:${w.color}">
        <h3>${esc(w.name)}</h3><p>${esc(w.blurb)}</p>
        <div class="stars">★ ${stars} / ${w.stages.length * 3}</div>${btns}</div>`;
    }).join('');
    $('#s-stages').innerHTML = `
      <div class="panel" style="max-width:min(1120px,96vw)">
        <h2>DREAMS</h2><p class="sub">Collect lucid stars on the risky routes. Finish a world to unlock the next.</p>
        <div class="worlds">${worlds}</div>
        <div class="row"><button data-act="back" data-focus>← Back</button>
        <button data-act="endless" ${p.endlessUnlocked ? '' : 'disabled'}>∞ Endless Dream</button></div>
      </div>`;
  }

  renderWardrobe() {
    const g = this.g, p = g.progress;
    const tabs = [['skin', 'Dreamer'], ['trail', 'Trail'], ['flipfx', 'Shift FX'], ['ach', 'Achievements']];
    let body;
    if (this.tab === 'ach') {
      body = `<div class="items" style="display:block">${ACHIEVEMENTS.map((a) => `
        <div class="ach ${p.data.ach[a.id] ? 'got' : ''}"><span class="ic">${p.data.ach[a.id] ? '★' : '☆'}</span>
        <span><b>${esc(a.name)}</b><small>${esc(a.desc)}${a.reward ? ` — unlocks ${esc(a.reward)}` : ''}</small></span></div>`).join('')}</div>`;
    } else {
      const eq = p.data.equip[this.tab];
      body = `<div class="items">${CATALOG[this.tab].map((c) => {
        const own = p.owns(this.tab, c.id);
        const ach = c.unlock ? ACHIEVEMENTS.find((a) => a.id === c.unlock) : null;
        const price = own ? (eq === c.id ? 'Equipped' : 'Owned') : ach ? `🔒 ${esc(ach.name)}` : `✦ ${c.cost}`;
        const sw = this.tab === 'skin'
          ? `<span class="sw" style="background:linear-gradient(135deg,${c.body} 50%,${c.cap} 50%);box-shadow:0 0 12px ${c.pom}"></span>`
          : `<span class="sw" style="background:${swatch(this.tab, c.id)}"></span>`;
        const can = own || (!c.unlock && p.data.dust >= c.cost);
        return `<button class="item ghost ${eq === c.id ? 'eq' : ''} ${own ? '' : 'lock'}" data-act="item" data-kind="${this.tab}" data-id="${c.id}" ${can ? '' : 'disabled'}>
          ${sw}<span>${esc(c.name)}</span><span class="price">${price}</span></button>`;
      }).join('')}</div>`;
    }
    $('#s-wardrobe').innerHTML = `
      <div class="panel" style="max-width:min(720px,96vw)">
        <h2>WARDROBE</h2><p class="sub">Spend dream fragments ✦ <b style="color:var(--gold)">${p.data.dust}</b> on looks. Purely cosmetic.</p>
        <div class="tabs">${tabs.map(([k, n]) => `<button class="${this.tab === k ? 'sel' : ''}" data-act="tab" data-tab="${k}">${n}</button>`).join('')}</div>
        <div class="wardrobe"><div class="preview"><canvas id="pv" width="300" height="380"></canvas></div>${body}</div>
        <div class="row"><button data-act="back" data-focus>← Back</button></div>
      </div>`;
    this.startPreview();
  }

  startPreview() {
    cancelAnimationFrame(this.previewRaf);
    const cv = $('#pv');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const pv = this.previewView;
    const sprites = this.previewSprites;
    sprites.build(2);
    pv.reset(75, 110, 1);
    let last = performance.now(), t = 0, g = 1, nextFlip = 1.2;
    const loop = (now) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; t += dt;
      nextFlip -= dt;
      if (nextFlip < 0) { g = -g; pv.onFlip(g); nextFlip = 1.6; setTimeout(() => pv.onLand(700), 180); }
      const eq = this.g.progress.equipped;
      const cy = 95 + (g === 1 ? 20 : -20) * Math.min(1, (1.6 - nextFlip) / 0.18);
      pv.update(dt, 75, cy, g, 300, (1.6 - nextFlip) > 0.2, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.fillStyle = 'rgba(143,246,255,.35)';
      ctx.fillRect(20, 132, 110, 2); ctx.fillRect(20, 56, 110, 2);
      pv.trail.length = 0;
      pv.draw(ctx, 75, cy, g, eq.skin, sprites, t, 300);
      this.previewRaf = requestAnimationFrame(loop);
    };
    this.previewRaf = requestAnimationFrame(loop);
  }

  renderSettings() {
    const s = this.g.progress.settings;
    const tg = (k, label, sub) => `<div class="set-row"><label>${label}<small>${sub}</small></label>
      <button class="toggle ${s[k] ? 'on' : ''}" data-act="toggle" data-key="${k}">${s[k] ? 'ON' : 'OFF'}</button></div>`;
    $('#s-settings').innerHTML = `
      <div class="panel">
        <h2>SETTINGS</h2><p class="sub">&nbsp;</p>
        <div class="set-row"><label>Music</label><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-set="music" aria-label="Music volume"></div>
        <div class="set-row"><label>Sound effects</label><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-set="sfx" aria-label="Sound volume"></div>
        ${tg('reducedMotion', 'Reduced motion', 'No screen shake, ripples or camera kicks')}
        <div class="set-row"><label>Quality<small>Auto adapts to your device</small></label>
          <span>${['auto', 'high', 'low'].map((q) => `<button class="toggle ${s.quality === q ? 'on' : ''}" data-act="quality" data-q="${q}" style="min-width:0;padding:8px 10px">${q}</button>`).join(' ')}</span></div>
        <div class="set-row"><label>Controls<small>Space / ↑ / ↓ / W / S / click / tap = shift gravity · P / Esc = pause · R = restart</small></label></div>
        <div class="set-row"><label>Progress<small>${this.confirmReset ? 'Tap again to erase everything' : 'Erase stars, unlocks and fragments'}</small></label>
          <button class="ghost" data-act="reset" style="${this.confirmReset ? 'color:var(--danger)' : ''}">${this.confirmReset ? 'Confirm' : 'Reset'}</button></div>
        <div class="row"><button data-act="back" data-focus>← Back</button></div>
      </div>`;
  }

  renderPause() {
    const r = this.g.run;
    $('#s-pause').innerHTML = `
      <div class="panel" style="max-width:360px">
        <h2>PAUSED</h2><p class="sub">${r?.stage ? `${r.stage.id} · ${esc(r.stage.name)}` : 'Endless Dream'}</p>
        <div class="col">
          <button class="primary" data-act="resume" data-focus>▶ Resume</button>
          <button data-act="restart">↺ Restart</button>
          <button data-act="settings">⚙ Settings</button>
          <button class="ghost" data-act="menu">⌂ Main menu</button>
        </div>
      </div>`;
  }

  renderResults(d) {
    if (!d) return;
    const stars = [0, 1, 2].slice(0, Math.max(3, d.starTotal)).map((i) => `<i class="${d.starMask >> i & 1 ? 'got' : ''}" style="transition-delay:${0.25 + i * 0.18}s">★</i>`).join('');
    const badges = [
      d.newBest ? '<span class="badge">NEW BEST</span>' : '',
      d.flawless ? '<span class="badge cyan">FLAWLESS</span>' : '',
      d.newStars > 0 ? `<span class="badge">+${d.newStars} STAR${d.newStars > 1 ? 'S' : ''}</span>` : '',
      d.unlocked ? `<span class="badge cyan">UNLOCKED ${esc(d.unlocked)}</span>` : '',
    ].join('');
    $('#s-results').innerHTML = `
      <div class="panel" style="max-width:440px">
        <p class="sub" style="margin:0">${esc(d.id)} · ${esc(d.name)}</p>
        <h2>DREAM COMPLETE</h2>
        <div class="res-stars" id="res-stars">${stars.replace(/class="got"/g, 'class="got-pending"')}</div>
        <div class="res-score" id="res-score">0</div>
        <div class="badges">${badges}</div>
        <div class="stats">
          <div>Fragments <b>${d.frags} / ${d.fragTotal}</b></div>
          <div>Near misses <b>${d.near}</b></div>
          <div>Falls <b>${d.deaths}</b></div>
          <div>Best streak <b>${d.streak}</b></div>
        </div>
        <div class="row">
          ${d.hasNext ? '<button class="primary big" data-act="next" data-focus>NEXT ▶</button>' : '<button class="primary big" data-act="menu" data-focus>MENU</button>'}
        </div>
        <div class="row"><button data-act="restart">↺ Replay</button>${d.canDouble ? '<button data-act="double">✦ ×2 fragments (ad)</button>' : ''}<button class="ghost" data-act="menu">⌂ Menu</button></div>
      </div>`;
    // Animate stars + score count-up.
    setTimeout(() => $('#res-stars')?.querySelectorAll('.got-pending').forEach((el) => { el.className = 'got'; }), 50);
    this.countUp($('#res-score'), d.score);
  }

  renderOver(d) {
    if (!d) return;
    const g = this.g;
    $('#s-over').innerHTML = `
      <div class="panel" style="max-width:420px">
        <p class="sub" style="margin:0">${d.daily ? 'DAILY DREAM · ' + esc(d.daily) : 'ENDLESS DREAM'}</p>
        <h2>YOU WOKE UP</h2>
        <div class="res-score" id="over-dist">0 m</div>
        <div class="badges">${d.newBest ? `<span class="badge">NEW ${d.daily ? 'DAILY ' : ''}BEST</span>` : `<span class="badge cyan">${d.daily ? 'TODAY\'S ' : ''}BEST ${d.bestDist} m</span>`}</div>
        <div class="stats">
          <div>Score <b>${d.score.toLocaleString('en-US')}</b></div>
          <div>Fragments <b>${d.frags}</b></div>
          <div>Near misses <b>${d.near}</b></div>
          <div>Worlds <b>${d.worlds}</b></div>
        </div>
        <div class="row"><button class="primary big" data-act="endless" data-daily="${d.daily ? 1 : 0}" data-focus>AGAIN ↺</button></div>
        <div class="row">
          ${d.canContinue ? '<button data-act="continue">▶ Keep dreaming (ad)</button>' : ''}
          <button class="ghost" data-act="menu">⌂ Menu</button>
        </div>
        <div class="hint">${g.input.label === 'TAP' ? 'Tap the button' : 'Press Space'} to dream again</div>
      </div>`;
    this.countUp($('#over-dist'), d.dist, ' m');
  }

  renderEnding(d) {
    $('#s-ending').innerHTML = `
      <div class="panel ending" style="max-width:520px">
        <p class="sub" style="margin:0">4-3 · WAKE UP</p>
        <div class="big">YOU WOKE UP…</div>
        <p>…or did you? The clocks have stopped ticking, the moon has gone quiet,<br>and your bed is exactly where you left it.</p>
        <p>Thank you for dreaming. <b style="color:var(--gold)">Endless Dream</b> is waiting — and the
        <b style="color:var(--accent2)">Lucid</b> look is yours.</p>
        <div class="res-score" id="end-score">0</div>
        <div class="row"><button class="primary big" data-act="endless" data-focus>∞ ENDLESS</button></div>
        <div class="row"><button class="ghost" data-act="menu">⌂ Menu</button></div>
      </div>`;
    this.countUp($('#end-score'), d?.score ?? 0);
  }

  countUp(el, target, suffix = '') {
    if (!el) return;
    const t0 = performance.now(), dur = 900;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * e).toLocaleString('en-US') + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

function swatch(kind, id) {
  const m = {
    wisp: 'radial-gradient(#ffe38a,#6a4bff)', none: '#222', stardust: 'radial-gradient(#fff,#ffe38a 40%,#1a1040)',
    petals: 'radial-gradient(#ffe0ec,#ff8fb8)', aurora: 'conic-gradient(#8ff6ff,#ff9ad5,#ffe38a,#9dffcf,#8ff6ff)',
    ripple: 'radial-gradient(transparent 40%,#8ff6ff 45%,transparent 60%)', shock: 'radial-gradient(#fff 20%,transparent 30%,#ffe38a 50%,transparent 60%)',
    feathers: 'radial-gradient(#fff,#f4efff 50%,#c9bff0)', prism: 'conic-gradient(red,orange,yellow,lime,cyan,blue,violet,red)',
  };
  return m[id] ?? '#444';
}

export { STAGES };
