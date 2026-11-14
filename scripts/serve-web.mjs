// Serves dist-web/ locally the way Netlify will: same files, same security headers.
//
//   npm run build:web
//   npm run serve:web        then open http://localhost:5175
//
// Use it to check the real content policy before publishing. Not a production server.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist-web');
const PORT = Number(process.env.PORT || 5175);

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('dist-web/ is missing. Run: npm run build:web');
  process.exit(2);
}

// Netlify's _headers format: a path pattern, then indented "Name: value" lines.
const rules = [];
for (const line of fs.readFileSync(path.join(root, '_headers'), 'utf8').split(/\r?\n/)) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  if (/^\S/.test(line)) rules.push({ pattern: line.trim(), headers: {} });
  else {
    const at = line.indexOf(':');
    if (at > 0 && rules.length) rules[rules.length - 1].headers[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
}
const matches = (pattern, url) => (pattern.endsWith('*') ? url.startsWith(pattern.slice(0, -1)) : url === pattern);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.join(root, url === '/' ? 'index.html' : url);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' };
    for (const rule of rules) if (matches(rule.pattern, url)) Object.assign(headers, rule.headers);
    // A plain-HTTP localhost cannot honour these two; browsers ignore them there.
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, '127.0.0.1', () => console.log(`Serving dist-web/ at http://localhost:${PORT} with the _headers rules`));
