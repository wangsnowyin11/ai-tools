#!/usr/bin/env node
// DeckGen local server: HTML deck previewer/editor with live file sync. No API key needed.
//
// Decks live as .html files in ./decks. The browser tool lists, opens, and autosaves them.
// When a deck file changes on disk (for example, Claude writes a new version), open tools reload it live.
// Requires Node 18+. No npm dependencies.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 5173;
const HOST = '127.0.0.1'; // local only
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DECKS_DIR = path.join(ROOT, 'decks');
const MAX_BODY = 5 * 1024 * 1024;

fs.mkdirSync(DECKS_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

// ---------------------------------------------------------------------------
// Live sync: watch decks/ and push change events to browsers over Server-Sent Events

const clients = new Set();
const pending = new Map();

function broadcast(obj) {
  const msg = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of clients) res.write(msg);
}

fs.watch(DECKS_DIR, (_evt, filename) => {
  if (filename && filename.startsWith('.')) return; // temp files from atomic writes
  if (!filename || !isValidName(filename)) { broadcast({ type: 'list' }); return; }
  clearTimeout(pending.get(filename));
  pending.set(filename, setTimeout(() => {
    pending.delete(filename);
    const exists = fs.existsSync(path.join(DECKS_DIR, filename));
    broadcast({ type: 'change', name: filename, exists });
  }, 150));
});

setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 25000);

// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname;

    if (p === '/api/events' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (p === '/api/decks' && req.method === 'GET') {
      return sendJson(res, 200, listDecks());
    }
    if (p === '/api/decks' && req.method === 'POST') {
      // create a new deck: { name, content }; fails if it exists
      const body = JSON.parse((await readBody(req)) || '{}');
      const name = normalizeName(body.name);
      if (!name) return sendJson(res, 400, { error: 'Invalid file name. Use letters, numbers, spaces, - _ . and end with .html' });
      const file = path.join(DECKS_DIR, name);
      if (fs.existsSync(file)) return sendJson(res, 409, { error: `${name} already exists` });
      writeAtomic(file, String(body.content || ''));
      return sendJson(res, 201, { name });
    }
    const m = p.match(/^\/api\/decks\/([^/]+)$/);
    if (m) {
      const name = decodeURIComponent(m[1]);
      if (!isValidName(name)) return sendJson(res, 400, { error: 'Invalid file name' });
      const file = path.join(DECKS_DIR, name);
      if (req.method === 'GET') {
        if (!fs.existsSync(file)) return sendJson(res, 404, { error: 'Not found' });
        return send(res, 200, fs.readFileSync(file, 'utf8'), 'text/html; charset=utf-8');
      }
      if (req.method === 'PUT') {
        writeAtomic(file, await readBody(req));
        return sendJson(res, 200, { ok: true, mtime: fs.statSync(file).mtimeMs });
      }
    }
    if (req.method === 'GET') return serveStatic(p, res);
    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[deckgen]', err.message);
    if (!res.headersSent) sendJson(res, 500, { error: err.message });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  DeckGen running at  http://localhost:${PORT}`);
  console.log(`  Watching decks in   ${DECKS_DIR}\n`);
});

// ---------------------------------------------------------------------------

function isValidName(name) {
  return typeof name === 'string' && path.basename(name) === name && /^[A-Za-z0-9][\w .-]{0,120}\.html?$/.test(name);
}
function normalizeName(raw) {
  let n = String(raw || '').trim().replace(/[\/\\]/g, '-');
  if (!n) return null;
  if (!/\.html?$/i.test(n)) n += '.html';
  return isValidName(n) ? n : null;
}
function listDecks() {
  return fs.readdirSync(DECKS_DIR)
    .filter(isValidName)
    .map((name) => { const s = fs.statSync(path.join(DECKS_DIR, name)); return { name, mtime: s.mtimeMs, size: s.size }; })
    .sort((a, b) => b.mtime - a.mtime);
}
function writeAtomic(file, content) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}
function serveStatic(pathname, res) {
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, decodeURIComponent(pathname)));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) return sendJson(res, 403, { error: 'Forbidden' });
  fs.readFile(filePath, (err, data) => {
    if (err) return sendJson(res, 404, { error: 'Not found' });
    send(res, 200, data, MIME[path.extname(filePath)] || 'application/octet-stream');
  });
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('Request too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function send(res, status, body, type) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-cache' });
  res.end(body);
}
function sendJson(res, status, obj) { send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8'); }
