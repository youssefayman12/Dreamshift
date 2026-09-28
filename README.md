# Dreamshift

A surreal gravity-flipping runner for the browser. You are **Somni**, a sleepwalker
in a nightcap, running through a Dream World that reacts to every gravity shift.
One input — tap, click or Space — flips gravity. That's the whole control scheme.

- **4 Dream Worlds, 12 stages**: Drift City, Moonlit Garden, Endless Bedroom, Clockwork Nightmare
- **Endless Dream** mode that drifts seamlessly from one world into the next
- Checkpoints, dream fragments, lucid stars (risky routes), scoring with flow multiplier and near misses
- Cosmetics (skins, trails, shift effects), achievements, persistent progress
- Procedural art and procedural audio: **no asset files at all** (~55 KB zipped build)
- Keyboard, mouse and touch; responsive from phone portrait to ultrawide; reduced-motion option

## Running

```bash
npm run dev          # zero-dependency static server → http://localhost:8080
npm run build        # bundles/minifies into dist/ (+ dist/dreamshift.zip if `zip` exists)
npm run validate     # proves every stage is beatable and measures timing windows
```

No build step is needed for development: the game runs straight from `src/` as ES modules.

Useful URL parameters: `?stage=2-3` (jump to a stage), `?endless`, `?bot` (autopilot),
`?unlockall`, `?debug` (FPS/coords), `?portal=mock` (simulated ads), `?worldlen=60`
(short endless worlds, for testing transitions).

## Controls

| Action | Keys / input |
| --- | --- |
| Shift gravity | Space, ↑, ↓, W, S, Z, X, Enter, left click, tap anywhere |
| Pause | Esc, P, or the ❚❚ button |

Flips are allowed while touching a surface (plus a 75 ms coyote window), and a press
made just before landing is buffered for 140 ms, so inputs never feel dropped.

## Architecture

```
src/
  config.js            all game-feel tuning (gravity, flip kick, hitbox, coyote, buffer…)
  main.js              boot
  engine/              math, input, storage, procedural audio + generative music
  game/
    sim.js             deterministic runner physics (shared by game, bot and validator)
    level.js           chunk-assembled levels, tile queries, pendulum sync
    entities.js        hazards + moving solids as pure functions of time
    run.js             one play session: scoring, checkpoints, death/respawn, tutorial
    solver.js          BFS over flip decisions (validator + attract-mode bot)
    bot.js, endless.js, progression.js, cosmetics.js, game.js (orchestration)
  levels/              ASCII chunk libraries per world + stage list (stages.js)
  worlds/              one theme per Dream World: parallax, set pieces, tile decoration
  render/              renderer (camera, FX, ripple), player, level, particles, HUD
  ui/                  DOM menus
  platform/            portal adapters (CrazyGames, mock), ad pacing policy, analytics
tools/                 validator, dev server, build, screenshot + UI smoke tests
```

**Determinism.** The runner never stops, so level time is a pure function of x. Every
hazard position is a pure function of time. This lets the same physics code power the
game, the headless validator and the attract-mode bot, and lets pendulums be
phase-synced to reliably threaten the runner's surface (`sync` in `levels/clockwork.js`).

### Adding content

- **A chunk**: add `mk(id, width, ops, { diff })` to a world file in `src/levels/`.
  Ops sculpt a standard corridor (`floorGap`, `ceilSpikes`, `['rect', …]`, letters for
  custom entities). See the legend at the top of `src/game/level.js`.
  Print it with `node tools/validate.mjs --print <id>`.
- **A stage**: add an entry to `STAGES` in `src/levels/stages.js`. `id~` mirrors a chunk
  floor↔ceiling, `id!` turns its lucid stars into fragments, `{ event: 'name' }` fires a set piece.
- **A world**: create a theme class in `src/worlds/` (`drawBack`, `drawFront`, `tileDetail`,
  `ambient`, optional `kinDetail`/`onSetpiece`), register it in `src/worlds/index.js`,
  add `WORLD_META` and a music track in `src/engine/music.js`.
- **A hazard**: add a factory in `src/game/entities.js` (`hit`, `near`, `minX/maxX`), its
  drawing in `render/levelView.js`, and a mirror rule in `mirrorEntity`.

Always run `npm run validate` after editing levels: it fails if any stage or checkpoint
becomes unbeatable, reports the narrowest flip window a sensible player faces, and
checks every endless-eligible chunk at low/high speed, both gravities and several
phase offsets.

## Portals & monetization

`src/platform/platform.js` exposes one interface (`gameplayStart/Stop`, `happyTime`,
`midgameAd`, `rewardedAd`, loading events). The CrazyGames SDK v3 adapter loads when
`?portal=crazygames` is set or the game is embedded from crazygames.com; audio is muted
during ads. `src/platform/ads.js` only requests interstitials at natural breaks (stage
complete, endless game over, returning to menu), never in the first two minutes and at
most every three minutes. The only rewarded ad is an optional one-time "keep dreaming"
continue in Endless — the game is fully enjoyable without ads.

## Credits

Design, code, art and audio are all original and procedurally generated.
