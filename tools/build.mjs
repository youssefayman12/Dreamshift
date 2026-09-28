// Production build: bundles + minifies all modules into one script so the
// game ships as three small files (index.html, game.js, styles.css) that
// any portal can host. Optionally zips dist/ if the `zip` CLI exists.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const out = 'dist';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020', 'safari14'],
  outfile: path.join(out, 'game.js'),
  legalComments: 'none',
});

const html = fs.readFileSync('index.html', 'utf8')
  .replace('<script type="module" src="src/main.js"></script>', '<script src="game.js" defer></script>');
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync('styles.css', path.join(out, 'styles.css'));

const size = (f) => (fs.statSync(path.join(out, f)).size / 1024).toFixed(1) + ' KB';
console.log(`dist/index.html ${size('index.html')}, game.js ${size('game.js')}, styles.css ${size('styles.css')}`);
try {
  execSync('zip -qr ../dreamshift.zip .', { cwd: out, stdio: 'ignore' });
  fs.renameSync('dreamshift.zip', path.join(out, 'dreamshift.zip'));
  console.log('dist/dreamshift.zip ready for portal upload');
} catch { /* zip not installed — upload dist/ contents instead */ }
