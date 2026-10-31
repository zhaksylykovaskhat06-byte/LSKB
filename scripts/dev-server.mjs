// Runs the site on your own computer: static files from public/ and the same /api routes as on Vercel.
// Data is kept in ./.data (or LOCAL_DATA_DIR). Settings are read from .env.local (see .env.example).
//   npm run dev   →   http://localhost:3000   (admin: http://localhost:3000/admin)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

for (const f of ['.env.local', '.env']) {
  let text = '';
  try {
    text = fs.readFileSync(path.join(ROOT, f), 'utf8');
  } catch {
    continue;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const routes = {};
for (const name of ['data', 'session', 'photo', 'aukcion']) {
  routes['/api/' + name] = (await import(pathToFileURL(path.join(ROOT, 'api', name + '.js')).href)).default;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon' };
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const api = routes[url.pathname];
    if (api) return api(req, res);
    const rel = url.pathname === '/' || url.pathname === '/admin' || url.pathname === '/admin/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(PUBLIC, rel);
    if (!file.startsWith(PUBLIC + path.sep)) {
      res.statusCode = 403;
      return res.end();
    }
    fs.readFile(file, (err, buf) => {
      if (err) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.end('Not found');
      }
      res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(buf);
    });
  })
  .listen(PORT, () => {
    console.log(`JUZ40 Мат-Гео: http://localhost:${PORT}   әкімші: http://localhost:${PORT}/admin`);
    if (!process.env.ADMIN_PASSWORD) console.log('  ADMIN_PASSWORD орнатылмаған — .env.local файлына жазыңыз (.env.example қараңыз).');
  });
