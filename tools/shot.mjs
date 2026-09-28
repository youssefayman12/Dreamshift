// Visual smoke test: loads the game in headless Chromium, reports console
// errors and captures screenshots.
//   node tools/shot.mjs "<query>" <outPrefix> [w] [h] [times...]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const [query = '', out = 'shot', w = '1280', h = '720', ...times] = process.argv.slice(2);
const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.goto(`http://localhost:8080/${query}`);
const ts = times.length ? times.map(Number) : [1500];
let prev = 0;
for (const t of ts) {
  await page.waitForTimeout(t - prev);
  prev = t;
  await page.screenshot({ path: `${out}-${t}.png` });
}
const info = await page.evaluate(() => {
  const g = window.__dreamshift;
  if (!g) return null;
  const r = g.run;
  return { state: g.state, mode: r?.mode, x: r ? Math.round(r.runner.x / 36) : null, deaths: r?.deaths, score: r?.score, runState: r?.state };
});
console.log(JSON.stringify(info));
console.log(errors.join('\n') || 'no console errors');
await browser.close();
