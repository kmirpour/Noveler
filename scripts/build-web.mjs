// Builds the hosted web version into dist-web/.
//
//   npm run build:web
//
// The desktop app's own build output (dist/) is left alone. dist-web/ is what gets published:
// drag the folder onto Netlify, or let Netlify run this script (see netlify.toml).
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-web');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// A label that tells the writer (and you) exactly which build they are using.
let commit = (process.env.COMMIT_REF || '').slice(0, 7);
if (!commit) {
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    commit = 'unknown';
  }
}
const version = `${pkg.version} (${commit}, ${new Date().toISOString().slice(0, 10)})`;

const build = spawnSync('npx', ['vite', 'build', '--outDir', 'dist-web', '--emptyOutDir'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_APP_VERSION: version },
});
if (build.status !== 0) process.exit(build.status ?? 1);

// Netlify applies the security headers from this file.
fs.copyFileSync(path.join(root, 'deploy', 'netlify', '_headers'), path.join(out, '_headers'));

const files = fs.readdirSync(out, { recursive: true, withFileTypes: true }).filter((e) => e.isFile());
const bytes = files.reduce((n, e) => n + fs.statSync(path.join(e.parentPath, e.name)).size, 0);
console.log(`\nWeb build ${version}: ${files.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB, in dist-web/`);
