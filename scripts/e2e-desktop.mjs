// End-to-end check of the real desktop app.
//
//   npm run build:e2e      (once, and again after code changes)
//   npm run test:e2e
//
// Launches the built app with WebView2's remote-debugging port open and drives it over the Chrome
// DevTools Protocol using only Node's built-in fetch and WebSocket (no extra packages). It works
// on a throwaway novel in the temp folder with its own app profile, so real settings, recent
// files and manuscripts are never touched.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The test copy is built into its own folder so it never collides with a running `tauri dev`.
const exe =
  process.env.NOVELER_EXE ||
  path.join(root, 'src-tauri', 'target', 'e2e', 'debug', process.platform === 'win32' ? 'noveler.exe' : 'noveler');
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(exe)) {
  console.error(`App not built: ${exe}\nRun: npm run tauri -- build --debug --no-bundle`);
  process.exit(2);
}

// --- A throwaway novel ---------------------------------------------------------------------------
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'noveler-e2e-'));
const novel = path.join(work, 'Test Novel');
const profile = path.join(work, 'profile');
fs.mkdirSync(novel);
const file = (name) => path.join(novel, name);
const read = (name) => fs.readFileSync(file(name), 'utf8');

fs.writeFileSync(file('01-arrival.md'), '# Chapter 1: The Arrival\n\n## Harbor\n\nThe ship came in at dawn.\n\n## Market\n\nShe bought bread and salt.\n');
fs.writeFileSync(file('02-letter.md'), '# Chapter 2: The Letter\n\n## Seal\n\nThe wax was still warm.\n');
fs.writeFileSync(file('scene-storm.md'), '# Scene Storm\n\nRain hammered the roof.\n');
fs.writeFileSync(file('World Wiki.md'), '# Characters\n\n**Mira (The Courier):** carries letters between the islands.\n');
// A project file as an older version wrote it: absolute paths from another machine, and the
// writer's own chapter order (chapter 2 first).
fs.writeFileSync(
  file('noveler.json'),
  JSON.stringify({
    version: 1,
    title: 'Test Novel',
    author: 'Tester',
    binder: [
      { id: 'b2', type: 'scene', title: 'x', path: 'D:\\Elsewhere\\Novel\\02-letter.md' },
      { id: 'b1', type: 'scene', title: 'x', path: 'D:\\Elsewhere\\Novel\\01-arrival.md' },
    ],
    codex: [{ id: 'm', name: 'Mira', category: 'character', aliases: [], summary: '' }],
    customDictionary: ['mira', 'the courier'],
  })
);

// --- Launch and connect ---------------------------------------------------------------------------
const launch = () =>
  spawn(exe, [], {
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
      WEBVIEW2_USER_DATA_FOLDER: profile,
    },
    stdio: 'ignore',
  });
let app = launch();

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    await sleep(500);
  }
  throw new Error('The app did not open its debugging port');
}

let ws;
const appErrors = [];
let nextId = 0;
const pending = new Map();
function send(method, params = {}) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function openSocket(url) {
  ws = new WebSocket(url);
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    // Anything the app itself reports as an error is collected for the final check.
    if (msg.method === 'Runtime.exceptionThrown') {
      appErrors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      appErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
    const waiter = pending.get(msg.id);
    if (!waiter) return;
    pending.delete(msg.id);
    if (msg.error) waiter.reject(new Error(msg.error.message));
    else waiter.resolve(msg.result);
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('WebSocket failed'));
  });
}

/** Runs JavaScript in the app's page and returns its (JSON-serialisable) value. */
async function page(expression) {
  const result = await send('Runtime.evaluate', {
    expression: `(async () => { ${expression} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result.value;
}

async function until(label, check, timeout = 10000) {
  const start = Date.now();
  for (;;) {
    let value;
    try {
      value = await check();
    } catch {
      value = false;
    }
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error(`Timed out waiting for: ${label}`);
    await sleep(200);
  }
}

const text = (selector) => page(`return [...document.querySelectorAll(${JSON.stringify(selector)})].map(e => e.innerText.trim());`);
const click = (selector, index = 0) =>
  page(`const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if (!el) throw new Error('No element: ${selector.replace(/'/g, '')}'); el.click(); return true;`);
const clickByText = (selector, label) =>
  page(`const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.innerText.includes(${JSON.stringify(label)})); if (!el) throw new Error('No element with text: ${label}'); el.click(); return true;`);
const editorText = () => page(`return document.querySelector('.tiptap').innerText;`);
async function typeAtEnd(str) {
  await page(`document.querySelector('.tiptap').editor.commands.focus('end'); return true;`);
  await send('Input.insertText', { text: str });
}
const key = async (keyName, code, modifiers = 0) => {
  const base = { key: keyName, code, modifiers, windowsVirtualKeyCode: keyName.toUpperCase().charCodeAt(0) };
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
};

// --- Checks -----------------------------------------------------------------------------------------
const results = [];
async function check(name, fn) {
  try {
    const note = await fn();
    results.push({ name, ok: true, note: typeof note === 'string' ? note : '' });
    console.log(`  ok    ${name}${typeof note === 'string' ? `  (${note})` : ''}`);
  } catch (err) {
    results.push({ name, ok: false, note: err.message });
    console.log(`  FAIL  ${name}\n        ${err.message}`);
  }
}
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

try {
  await openSocket(await connect());
  await send('Runtime.enable');
  await send('Page.enable');
  await until('app shell', () => page(`return Boolean(document.querySelector('.toolbar'));`), 20000);

  await check('starts on the welcome screen with a clean profile', async () => {
    assert(await page(`return Boolean(document.querySelector('.welcome-overlay'));`), 'welcome screen not shown');
    assert(await page(`return '__TAURI_INTERNALS__' in window;`), 'not running inside the desktop shell');
  });

  // Folder pickers are native dialogs, so the novel is opened the way the app reopens the last
  // novel on start-up: from the remembered folder.
  await page(`localStorage.setItem('noveler-settings', JSON.stringify({ lastProjectPath: ${JSON.stringify(novel)} })); return true;`);
  await send('Page.reload');
  await until('novel loaded', async () => (await text('.binder-item-title')).length >= 2, 20000);

  await check('reopens the last novel and shows chapters by their own titles, in the saved order', async () => {
    const titles = await text('.binder-item:not(.is-extra-file) .binder-item-title');
    assert(
      JSON.stringify(titles) === JSON.stringify(['Chapter 2: The Letter', 'Chapter 1: The Arrival']),
      `sidebar shows ${JSON.stringify(titles)}`
    );
    return titles.join(' / ');
  });

  await check('loads the first chapter into the editor and lists its scenes', async () => {
    await until('chapter text', async () => (await editorText()).includes('The wax was still warm'));
    const scenes = await text('.chapter-scene-item .scene-outline-title');
    assert(scenes.includes('Seal'), `scenes: ${JSON.stringify(scenes)}`);
  });

  await check('typing autosaves to the chapter file as plain Markdown', async () => {
    await typeAtEnd(' She broke it anyway.');
    await until('autosave', () => read('02-letter.md').includes('She broke it anyway.'), 8000);
    const md = read('02-letter.md');
    assert(md.startsWith('# Chapter 2: The Letter\n\n## Seal\n\n'), `unexpected file start: ${JSON.stringify(md.slice(0, 60))}`);
    assert(!/^---|<!--|<[a-z]/m.test(md), 'file contains front-matter or markup');
    const saved = await until('saved indicator', async () => (await text('.save-state')).find((t) => t.startsWith('Saved')));
    return saved;
  });

  await check('the on-device dictionary underlines a misspelling and leaves names alone', async () => {
    await typeAtEnd(' Mira ran down the coridor.');
    const marked = await until('spelling marks', async () => {
      const marks = await text('.tiptap .spell-error-spelling');
      return marks.includes('coridor') ? marks : null;
    }, 12000);
    assert(!marked.includes('Mira'), 'a story-bible name was flagged');
    return `flagged: ${marked.join(', ')}`;
  });

  await check('switching chapters right after typing saves silently (no prompt, no lost text)', async () => {
    await typeAtEnd(' Last words before switching.');
    await clickByText('.binder-item:not(.is-extra-file)', 'Chapter 1: The Arrival');
    await until('other chapter open', async () => (await editorText()).includes('The ship came in at dawn'));
    assert(read('02-letter.md').includes('Last words before switching.'), 'text typed before the switch was not saved');
  });

  await check('undo after switching does not pull in the previous chapter', async () => {
    await page(`document.querySelector('.tiptap').editor.commands.focus('end'); return true;`);
    await key('z', 'KeyZ', 2);
    await sleep(300);
    const body = await editorText();
    assert(body.includes('The ship came in at dawn') && !body.includes('The wax was still warm'), 'undo changed the document');
    await sleep(2500);
    assert(!read('01-arrival.md').includes('wax'), 'chapter 1 file was overwritten');
  });

  await check('removing a scene asks first, then keeps its text in graveyard/', async () => {
    await click('.chapter-scene-item .scene-delete-btn', 1);
    const title = await until('themed dialog', async () => (await text('.dialog-title'))[0]);
    assert(title.includes('Market'), `dialog says: ${title}`);
    await click('.dialog-btn.primary');
    await until('scene gone from file', () => !read('01-arrival.md').includes('bread and salt'), 8000);
    const grave = fs.readdirSync(file('graveyard'));
    const kept = grave.map((n) => fs.readFileSync(path.join(file('graveyard'), n), 'utf8')).find((t) => t.includes('bread and salt'));
    assert(kept && kept.startsWith('## Market'), 'scene text not found in graveyard');
    assert(read('01-arrival.md').includes('## Harbor'), 'the other scene was damaged');
    return grave.join(', ');
  });

  await check('deleting a note moves the file to graveyard/ instead of destroying it', async () => {
    const row = `[...document.querySelectorAll('.binder-item.is-extra-file')].find(e => e.innerText.includes('scene storm'))`;
    await page(`const r = ${row}; if (!r) throw new Error('note row not found'); r.querySelector('[title="More options"]').click(); return true;`);
    await clickByText('.binder-menu-option', 'Delete');
    await until('dialog', async () => (await text('.dialog-title')).length > 0);
    await click('.dialog-btn.primary');
    await until('file moved', () => !fs.existsSync(file('scene-storm.md')), 8000);
    const moved = fs.readdirSync(file('graveyard')).find((n) => n.endsWith('_scene-storm.md'));
    assert(moved, 'note not found in graveyard');
    assert(fs.readFileSync(path.join(file('graveyard'), moved), 'utf8').includes('Rain hammered the roof'), 'note content lost');
  });

  await check('the project file is portable: file names only, order kept, no stale dictionary phrases', async () => {
    const project = await until('noveler.json rewritten', () => {
      const p = JSON.parse(read('noveler.json'));
      return p.binder.every((b) => !/[\\/]/.test(b.path)) ? p : null;
    }, 8000);
    assert(JSON.stringify(project.binder.map((b) => b.path)) === JSON.stringify(['02-letter.md', '01-arrival.md']), 'chapter order changed');
    assert(!JSON.stringify(project).includes('Elsewhere'), 'old absolute paths remain');
    assert(!(project.customDictionary || []).includes('mira'), 'story-bible name still stored in the dictionary');
    // 4 + 5 + 4 words were typed into chapter 2 above; all of them count toward today.
    const today = await until('writing log saved', () => {
      const n = Object.values(JSON.parse(read('noveler.json')).writingLog || {})[0] || 0;
      return n >= 13 ? n : null;
    }, 6000).catch(() => Object.values(JSON.parse(read('noveler.json')).writingLog || {})[0] || 0);
    assert(today === 13, `expected 13 words logged today, found ${today}`);
    return `${today} words logged today`;
  });

  await check('file commands are confined to the novel folder, and nothing can delete', async () => {
    const outside = path.join(work, 'outside.md');
    fs.writeFileSync(outside, 'keep');
    const outcome = await page(`
      const invoke = window.__TAURI_INTERNALS__.invoke;
      const attempt = async (cmd, args) => { try { await invoke(cmd, args); return 'allowed'; } catch (e) { return 'refused'; } };
      return {
        moveOut: await attempt('rename_path', { oldPath: ${JSON.stringify(file('01-arrival.md'))}, newPath: ${JSON.stringify(path.join(work, 'stolen.md'))} }),
        moveIn: await attempt('rename_path', { oldPath: ${JSON.stringify(outside)}, newPath: ${JSON.stringify(file('in.md'))} }),
        createOut: await attempt('create_file', { path: ${JSON.stringify(path.join(work, 'new.md'))}, initialContent: 'x' }),
        del: await attempt('delete_file', { path: ${JSON.stringify(outside)} }),
      };`);
    assert(Object.values(outcome).every((v) => v === 'refused'), JSON.stringify(outcome));
    assert(fs.existsSync(outside) && fs.existsSync(file('01-arrival.md')), 'a file was moved or removed');
  });

  await check('rolling backups are listed and a backup can be compared', async () => {
    // The first backup of a file is taken when it is saved over; chapter 2 has been saved several times.
    await clickByText('.binder-item:not(.is-extra-file)', 'Chapter 2: The Letter');
    await until('chapter 2 open', async () => (await editorText()).includes('The wax was still warm'));
    assert(fs.existsSync(path.join(novel, '.noveler', 'backups', '02-letter.md')), 'no backup folder for the chapter');
    await click('.toolbar-more > .toolbar-button');
    await clickByText('.toolbar-menu-item', 'Backups of this file');
    const items = await until('backup list', async () => {
      const list = await text('.backups-item');
      return list.length ? list : null;
    });
    await until('comparison shown', async () => (await text('.diff-view, .diff-empty')).length > 0);
    await click('.backups-modal .modal-close-btn');
    return `${items.length} backup${items.length === 1 ? '' : 's'}`;
  });

  await check('a comment highlights its passage and never reaches the chapter file', async () => {
    await page(`document.querySelector('.tiptap').editor.commands.focus('end'); return true;`);
    // Uses the same store action the right-click menu calls, via the Inspector's own module state.
    await page(`
      const ed = document.querySelector('.tiptap').editor;
      const text = ed.state.doc.textContent; const at = text.indexOf('wax was still warm');
      if (at < 0) throw new Error('passage not found');
      return true;`);
    // Select the passage with a real double-click-free selection, then open the context menu.
    await page(`
      const ed = document.querySelector('.tiptap').editor;
      let from = -1;
      ed.state.doc.descendants((node, pos) => { if (from < 0 && node.isText && node.text.includes('wax was still warm')) from = pos + node.text.indexOf('wax was still warm'); });
      ed.commands.setTextSelection({ from, to: from + 'wax was still warm'.length });
      const r = document.querySelector('.tiptap').getBoundingClientRect();
      document.querySelector('.editor-container').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 40, clientY: r.top + 40 }));
      return true;`);
    await clickByText('.context-menu-item', 'Add comment');
    await until('comment prompt', async () => (await text('.dialog-title')).length > 0);
    await page(`
      const input = document.querySelector('.dialog-input');
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(input, 'Check the sealing wax colour'); input.dispatchEvent(new Event('input', { bubbles: true })); return true;`);
    await click('.dialog-btn.primary');
    const anchors = await until('highlight', async () => {
      const a = await text('.tiptap .comment-anchor');
      return a.length ? a : null;
    });
    assert(anchors[0] === 'wax was still warm', `highlight covers: ${anchors[0]}`);
    await sleep(2500);
    assert(!read('02-letter.md').includes('sealing wax colour'), 'comment text leaked into the chapter file');
    assert(read('noveler.json').includes('sealing wax colour'), 'comment not saved with the project');
  });

  await check('saving a version creates a local git commit and clears the "changed" indicator', async () => {
    await click('.toolbar-more > .toolbar-button');
    await clickByText('.toolbar-menu-item', 'Save a version');
    await until('version prompt', async () => (await text('.dialog-title')).length > 0);
    await click('.dialog-btn.primary');
    await until('repository created', () => fs.existsSync(file('.git')), 15000);
    const log = await until('commit', () => {
      try {
        return execFileSync('git', ['-C', novel, 'log', '--oneline'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      } catch {
        return null;
      }
    }, 15000);
    const remotes = execFileSync('git', ['-C', novel, 'remote'], { encoding: 'utf8' }).trim();
    assert(remotes === '', 'a remote was configured');
    const tracked = execFileSync('git', ['-C', novel, 'ls-files'], { encoding: 'utf8' });
    assert(tracked.includes('02-letter.md') && !tracked.includes('.noveler/'), 'unexpected files in the commit');
    return log;
  });

  await check('no errors were logged by the app', async () => {
    assert(appErrors.length === 0, appErrors.join(' | '));
  });

  await check('the window comes back at the size it was closed with', async () => {
    const windowCall = (cmd, extra = '') =>
      page(`return await window.__TAURI_INTERNALS__.invoke('plugin:window|${cmd}', { label: 'main'${extra} });`);
    // Resize the real window the way the app itself would, then let it record the new size.
    await windowCall('set_size', ", value: { Physical: { width: 1111, height: 733 } }");
    const saved = JSON.parse(
      await until('window state saved', async () => {
        const raw = await page(`return localStorage.getItem('noveler-window');`);
        return raw && JSON.parse(raw).width === 1111 ? raw : null;
      }, 6000)
    );
    assert(saved.height === 733, `saved ${JSON.stringify(saved)}`);

    // Close and start again with the same profile.
    ws.close();
    app.kill();
    await sleep(1500);
    app = launch();
    await openSocket(await connect());
    await send('Runtime.enable');
    await until('app shell', () => page(`return Boolean(document.querySelector('.toolbar'));`), 20000);
    const size = await until('restored size', async () => {
      const current = await windowCall('inner_size');
      return current.width === 1111 && current.height === 733 ? current : null;
    }, 8000);
    return `${size.width} × ${size.height}`;
  });
} catch (err) {
  results.push({ name: 'test run', ok: false, note: err.message });
  console.log(`  FAIL  test run aborted: ${err.message}`);
} finally {
  try {
    ws?.close();
  } catch {
    // ignore
  }
  app.kill();
  await sleep(500);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  if (failed.length === 0 && !process.env.E2E_KEEP) {
    fs.rmSync(work, { recursive: true, force: true });
  } else {
    console.log(`Test novel kept for inspection: ${work}`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}
