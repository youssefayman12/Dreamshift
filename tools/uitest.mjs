// Interactive smoke test: drives menus and a real (non-bot) run with the
// keyboard and mouse, capturing screenshots and any console errors.
//   node tools/uitest.mjs <outDir>
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const out = process.argv[2] || '.';
const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.goto('http://localhost:8080/?portal=mock');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(800);
const shot = (n) => page.screenshot({ path: `${out}/ui-${n}.png` });
const state = () => page.evaluate(() => ({ s: window.__dreamshift.state, x: Math.round(window.__dreamshift.run.runner.x / 36), freeze: !!window.__dreamshift.run.freeze, deaths: window.__dreamshift.run.deaths, audio: window.__dreamshift.audio.ctx?.state }));

await page.click('[data-act=play]');
await page.waitForTimeout(3600);
console.log('after play', await state());
await shot('tutorial');
await page.keyboard.press('Space');
await page.waitForTimeout(1500);
console.log('after first flip', await state());
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await shot('pause');
console.log('paused', await state());
await page.click('[data-act=resume]');
await page.waitForTimeout(300);
console.log('resumed', await state());
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.click('#s-pause [data-act=menu]');
await page.waitForTimeout(800);
console.log('menu', await state());
await page.click('[data-act=wardrobe]');
await page.waitForTimeout(600);
await shot('wardrobe');
await page.click('[data-act=tab][data-tab=ach]');
await page.waitForTimeout(300);
await shot('achievements');
await page.click('#s-wardrobe [data-act=back]');
await page.click('[data-act=settings]');
await page.waitForTimeout(400);
await shot('settings');
await page.click('#s-settings [data-act=back]');
await page.click('[data-act=stages]');
await page.waitForTimeout(400);
await shot('stages');
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
