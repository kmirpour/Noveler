// Builds the copy of the desktop app that `npm run test:e2e` drives.
// It goes into its own target folder so it can be rebuilt while `tauri dev` is running.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync('npx', ['tauri', 'build', '--debug', '--no-bundle'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, CARGO_TARGET_DIR: path.join(root, 'src-tauri', 'target', 'e2e') },
});
process.exit(result.status ?? 1);
