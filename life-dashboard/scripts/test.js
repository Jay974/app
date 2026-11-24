// Test d'intégration de l'API : node scripts/test.js
const { spawn } = require('node:child_process'), path = require('node:path'), os = require('node:os'), fs = require('node:fs');
const assert = require('node:assert/strict');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'life-')), port = 3100 + Math.floor(Math.random() * 500);
const srv = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: port, DATA_DIR: dir }, stdio: 'inherit' });
const base = `http://localhost:${port}`;
const call = async (p, o = {}, t) => { const r = await fetch(base + p, { ...o, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) } }); return { s: r.status, j: await r.json() }; };
(async () => {
  await new Promise(r => setTimeout(r, 600));
  assert.equal((await call('/api/sync')).s, 401);
  assert.equal((await call('/api/status')).j.initialized, false);
  const a = await call('/api/login', { method: 'POST', body: JSON.stringify({ password: 'secret123' }) }); assert.equal(a.s, 200);
  assert.equal((await call('/api/login', { method: 'POST', body: JSON.stringify({ password: 'wrongpass' }) })).s, 401);
  const b = await call('/api/login', { method: 'POST', body: JSON.stringify({ password: 'secret123' }) });
  // appareil A écrit, appareil B lit
  await call('/api/sync', { method: 'POST', body: JSON.stringify({ docs: { 'day:2026-01-01': { weight: { v: 80, t: 100 } } } }) }, a.j.token);
  let g = await call('/api/sync?since=0', {}, b.j.token); assert.equal(g.j.docs['day:2026-01-01'].weight.v, 80);
  // champ plus ancien ignoré, plus récent accepté, autres champs conservés
  await call('/api/sync', { method: 'POST', body: JSON.stringify({ docs: { 'day:2026-01-01': { weight: { v: 70, t: 50 }, sport: { v: 'done', t: 60 } } } }) }, b.j.token);
  g = await call('/api/sync?since=0', {}, a.j.token);
  assert.equal(g.j.docs['day:2026-01-01'].weight.v, 80); assert.equal(g.j.docs['day:2026-01-01'].sport.v, 'done');
  await call('/api/sync', { method: 'POST', body: JSON.stringify({ docs: { 'day:2026-01-01': { weight: { v: 79, t: 200 } } } }) }, b.j.token);
  const seq = g.j.seq; g = await call('/api/sync?since=' + seq, {}, a.j.token); assert.equal(g.j.docs['day:2026-01-01'].weight.v, 79);
  assert.equal((await call('/api/sync', { method: 'POST', body: JSON.stringify({ docs: { '../etc': { x: { v: 1, t: 1 } } } }) }, a.j.token)).s, 200);
  g = await call('/api/sync?since=0', {}, a.j.token); assert.ok(!g.j.docs['../etc']);
  console.log('✔ API OK'); srv.kill(); process.exit(0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
