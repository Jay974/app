'use strict';
/**
 * Serveur de synchronisation — zéro dépendance (Node >= 18).
 *  - sert la PWA (dossier public/)
 *  - stocke les données dans DATA_DIR/data.json
 *  - /api/sync : fusion champ par champ (le plus récent gagne)
 *  - /api/events : Server-Sent Events => le téléphone/PC se met à jour en direct
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const PUBLIC = path.join(__dirname, 'public');
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- stockage ----------
let db = { seq: 0, docs: {}, auth: null, tokens: {} };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); } catch { /* premier lancement */ }

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 150);
}
function saveNow() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DATA_FILE);
}
process.on('SIGTERM', () => { saveNow(); process.exit(0); });
process.on('SIGINT', () => { saveNow(); process.exit(0); });

// ---------- auth ----------
function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return { salt, hash };
}
function checkPassword(pw) {
  if (!db.auth) return false;
  const { hash } = hashPassword(pw, db.auth.salt);
  const a = Buffer.from(hash, 'hex'), b = Buffer.from(db.auth.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function newToken() {
  const t = crypto.randomBytes(32).toString('hex');
  db.tokens[t] = Date.now();
  save();
  return t;
}
function authed(req, url) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token');
  return !!(t && db.tokens[t]);
}
const fails = new Map(); // anti brute-force simple par IP
function throttled(ip) {
  const f = fails.get(ip);
  return f && f.n >= 8 && Date.now() - f.t < 60_000;
}
function noteFail(ip) {
  const f = fails.get(ip) || { n: 0, t: 0 };
  fails.set(ip, { n: f.n + 1, t: Date.now() });
}

// ---------- fusion ----------
// doc = { f: { champ: { v, t } }, seq }
function merge(id, fields) {
  if (!/^[a-z]{2,10}:?[\w.-]{0,60}$/i.test(id) || id.length > 80) return false;
  const doc = db.docs[id] || (db.docs[id] = { f: {}, seq: 0 });
  let changed = false;
  for (const [k, cell] of Object.entries(fields || {})) {
    if (!cell || typeof cell.t !== 'number' || k.length > 40) continue;
    const cur = doc.f[k];
    if (!cur || cell.t > cur.t) {
      if (JSON.stringify(cell.v ?? null).length > 20000) continue;
      doc.f[k] = { v: cell.v ?? null, t: cell.t };
      changed = true;
    }
  }
  if (changed) doc.seq = ++db.seq;
  return changed;
}

// ---------- temps réel ----------
const clients = new Set();
function broadcast() {
  for (const res of clients) res.write(`event: seq\ndata: ${db.seq}\n\n`);
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 25_000).unref();

// ---------- http ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function body(req, limit = 2_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function api(req, res, url) {
  const ip = req.socket.remoteAddress;
  const route = url.pathname;

  if (route === '/api/status' && req.method === 'GET') return json(res, 200, { initialized: !!db.auth });

  if (route === '/api/login' && req.method === 'POST') {
    if (throttled(ip)) return json(res, 429, { error: 'Trop d’essais, réessaie dans une minute.' });
    const { password } = await body(req, 5000);
    if (typeof password !== 'string' || password.length < 6) return json(res, 400, { error: 'Mot de passe : 6 caractères minimum.' });
    if (!db.auth) { // première utilisation : on crée le mot de passe
      db.auth = hashPassword(password);
      return json(res, 200, { token: newToken(), created: true });
    }
    if (!checkPassword(password)) { noteFail(ip); return json(res, 401, { error: 'Mot de passe incorrect.' }); }
    return json(res, 200, { token: newToken() });
  }

  if (!authed(req, url)) return json(res, 401, { error: 'unauthorized' });

  if (route === '/api/logout' && req.method === 'POST') {
    const t = (req.headers.authorization || '').slice(7);
    delete db.tokens[t]; save();
    return json(res, 200, { ok: true });
  }

  if (route === '/api/sync' && req.method === 'GET') {
    const since = Number(url.searchParams.get('since') || 0);
    const docs = {};
    for (const [id, d] of Object.entries(db.docs)) if (d.seq > since) docs[id] = d.f;
    return json(res, 200, { seq: db.seq, now: Date.now(), docs });
  }

  if (route === '/api/sync' && req.method === 'POST') {
    const { docs } = await body(req);
    let changed = false;
    for (const [id, fields] of Object.entries(docs || {})) if (merge(id, fields)) changed = true;
    if (changed) { save(); broadcast(); }
    return json(res, 200, { seq: db.seq, now: Date.now() });
  }

  if (route === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive', 'X-Accel-Buffering': 'no'
    });
    res.write(`retry: 3000\nevent: seq\ndata: ${db.seq}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  json(res, 404, { error: 'not found' });
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep) && file !== PUBLIC) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    const target = !err && st.isFile() ? file : path.join(PUBLIC, 'index.html'); // fallback SPA
    fs.readFile(target, (e, buf) => {
      if (e) { res.writeHead(404); return res.end('Not found'); }
      const ext = path.extname(target);
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': target.endsWith('sw.js') || ext === '.html' ? 'no-cache' : 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(buf);
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) json(res, 400, { error: 'bad request' }); else res.end();
  }
});
if (require.main === module) {
  server.listen(PORT, () => console.log(`Life Dashboard → http://localhost:${PORT}  (données : ${DATA_FILE})`));
}
module.exports = { server, merge, db };
