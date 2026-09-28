// Entry point.
import { Game } from './game/game.js';
import { createPlatform } from './platform/platform.js';
import { Analytics } from './platform/analytics.js';

async function main() {
  const analytics = new Analytics();
  const platform = await createPlatform();
  platform.loadingStart();
  const game = new Game({
    canvas: document.getElementById('game'),
    uiRoot: document.getElementById('ui'),
    platform,
    analytics,
  });
  game.boot();
  platform.loadingStop();
  analytics.track('boot', { platform: platform.name });
  document.getElementById('boot').classList.add('hide');
  window.__dreamshift = game; // handy for debugging / automated tests
}

main().catch((e) => {
  console.error(e);
  const b = document.getElementById('boot');
  if (b) b.innerHTML = '<div style="padding:24px;text-align:center">Something went wrong waking the dream.<br>Please reload.</div>';
});
