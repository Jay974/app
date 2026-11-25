/* Ma Vie — dashboard personnel (PWA, offline-first, synchro temps réel). Aucune dépendance. */
(() => {
'use strict';

/* ============================== helpers ============================== */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const weekStart = s => { const d = parse(s); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return ymd(d); };
const fmt = (n, dec = 1) => (n == null || isNaN(n)) ? '–' : Number(n).toLocaleString('fr-FR', { maximumFractionDigits: dec });
const eur = n => Number(n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const longDate = s => parse(s).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = s => parse(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const monthName = m => parse(m + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota / mode privé */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* */ } }
};

const ICONS = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  today: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  weight: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  sport: '<path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/>',
  food: '<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 3c-2 2-3 5-3 8h3v10"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  credit: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  l: '<path d="M15 6l-6 6 6 6"/>', r: '<path d="M9 6l6 6-6 6"/>', logo: '<circle cx="12" cy="12" r="7"/><path d="M12 5a7 7 0 0 1 7 7"/>'
};
const ic = (n, c = 'ic') => `<svg class="${c}" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;
const TABS = [['home', 'Dashboard'], ['today', 'Aujourd’hui'], ['weight', 'Poids'], ['sport', 'Sport'], ['food', 'Repas'], ['work', 'Travail'], ['credit', 'Crédit'], ['settings', 'Réglages']];
const ACCENTS = { Jade: '0,168,150', Corail: '255,90,79', Violet: '139,92,246', Océan: '56,189,248', Menthe: '45,212,160', Ambre: '245,158,11', Rose: '244,114,182' };
const SPORTS = ['Muscu', 'Cardio', 'Course', 'Marche', 'Vélo', 'Natation', 'Yoga', 'Autre'];
const SLOTS = ['Petit-déj', 'Déjeuner', 'Dîner', 'Collation'];
const MOODS = ['😞', '😕', '😐', '🙂', '😄'];

/* ============================== store + sync ============================== */
// Chaque document est { champ: {v, t} } : la fusion se fait champ par champ, le plus récent gagne.
const S = { docs: LS.get('ld_docs', {}), pending: LS.get('ld_pending', {}), seq: LS.get('ld_seq', 0), token: LS.get('ld_token', null), offset: LS.get('ld_off', 0) };
let status = 'off'; // ok | off | busy
const persist = () => { LS.set('ld_docs', S.docs); LS.set('ld_pending', S.pending); LS.set('ld_seq', S.seq); LS.set('ld_off', S.offset); };
const nowT = () => Date.now();

function val(id) {
  const d = S.docs[id], o = {};
  if (d) for (const k in d) if (d[k].v !== null && d[k].v !== undefined) o[k] = d[k].v;
  return o;
}
function put(id, patch) {
  const t = nowT();
  S.docs[id] = S.docs[id] || {}; S.pending[id] = S.pending[id] || {};
  for (const k in patch) {
    const cell = { v: patch[k] === undefined ? null : patch[k], t };
    S.docs[id][k] = cell; S.pending[id][k] = cell;
  }
  persist(); render(true); flushSoon();
}
const ids = prefix => Object.keys(S.docs).filter(k => k.startsWith(prefix));

const CFG = window.LIFE_CONFIG || {};
const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
let flushT = null, flushing = false, chan = null;
function flushSoon() { clearTimeout(flushT); flushT = setTimeout(flush, 250); }
async function flush() {
  if (flushing || !S.token || !Object.keys(S.pending).length) return;
  flushing = true;
  const snap = JSON.parse(JSON.stringify(S.pending)), rows = [];
  for (const doc in snap) for (const field in snap[doc]) rows.push({ doc, field, v: snap[doc][field].v, t: snap[doc][field].t });
  try {
    const { error } = await sb.rpc('push_fields', { rows });
    if (error) throw error;
    for (const id in snap) for (const k in snap[id]) if (S.pending[id]?.[k]?.t === snap[id][k].t) delete S.pending[id][k];
    for (const id in S.pending) if (!Object.keys(S.pending[id]).length) delete S.pending[id];
    persist(); setStatus('ok');
  } catch (e) { setStatus('off'); }
  flushing = false;
  if (Object.keys(S.pending).length && status === 'ok') flushSoon();
}
async function pull() {
  if (!S.token) return;
  try {
    let changed = false, since = S.seq, more = true;
    while (more) {
      const { data, error } = await sb.from('fields').select('doc,field,v,t,seq').gt('seq', since).order('seq').limit(1000);
      if (error) throw error;
      for (const r of data) {
        const loc = S.docs[r.doc] = S.docs[r.doc] || {};
        if (!loc[r.field] || r.t > loc[r.field].t) { loc[r.field] = { v: r.v, t: r.t }; changed = true; }
        since = r.seq;
      }
      more = data.length === 1000;
    }
    S.seq = since; persist(); setStatus('ok');
    if (changed) render(false);
  } catch (e) { setStatus('off'); }
}
function connect() {
  if (!S.token) return;
  if (chan) sb.removeChannel(chan);
  chan = sb.channel('fields-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'fields' }, () => pull())
    .subscribe(st => { if (st === 'SUBSCRIBED') { setStatus('ok'); flush(); pull(); } else if (st === 'CLOSED' || st === 'CHANNEL_ERROR') setStatus('off'); });
}
function setStatus(s) {
  if (status === s) return;
  status = s;
  $$('[data-sync]').forEach(el => { el.innerHTML = syncHtml(); });
}
const syncHtml = () => `<i class="dot ${status === 'ok' ? 'ok' : 'off'}"></i>${status === 'ok' ? (Object.keys(S.pending).length ? 'Envoi…' : 'Synchronisé') : 'Hors-ligne — sera synchronisé'}`;
window.addEventListener('online', () => { flush(); pull(); connect(); });
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && S.token) localLogout(); });
window.addEventListener('offline', () => setStatus('off'));
document.addEventListener('visibilitychange', () => { if (!document.hidden) { pull(); flush(); } });

function localLogout() {
  if (chan) sb.removeChannel(chan);
  S.token = null; LS.del('ld_token');
  render();
}

/* ============================== domaine ============================== */
const DEF = { goalWeight: null, startWeight: null, height: null, kcalGoal: 2200, waterGoal: 8, sportTarget: 3, workTarget: 20, dayRate: 0, name: '', accent: 'Jade' };
const cfg = () => ({ ...DEF, ...val('cfg') });
const credit = () => ({ name: 'Mon crédit', total: 0, monthly: 0, start: null, ...val('credit') });
const day = d => val('day:' + d);
const payments = () => ids('pay:').map(id => ({ id: id.slice(4), ...val(id) })).filter(p => !p.del && p.amount != null).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const dayIds = () => ids('day:').map(k => k.slice(4)).sort();

function weights() { // [{date, w}] triés
  return dayIds().map(d => ({ date: d, w: day(d).weight })).filter(x => typeof x.w === 'number');
}
function score(d) {
  const x = day(d), c = cfg();
  const items = [x.weight != null, !!x.sport, !!x.work, (x.water || 0) >= c.waterGoal, (x.meals || []).length > 0, x.sleep != null, x.mood != null];
  return items.filter(Boolean).length / items.length;
}
function weekStats(d0) {
  const ws = weekStart(d0); let n = 0, min = 0;
  for (let i = 0; i < 7; i++) { const x = day(addDays(ws, i)); if (x.sport === 'done') { n++; min += x.sportMin || 0; } }
  return { n, min };
}
function monthDays(m) { // m = 'YYYY-MM'
  const first = parse(m + '-01'), out = [];
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  for (let i = 1; i <= last; i++) out.push(`${m}-${pad(i)}`);
  return out;
}
const kcalOf = d => (day(d).meals || []).reduce((s, m) => s + (Number(m.kcal) || 0), 0);
function creditStats() {
  const c = credit(), pays = payments();
  const paid = pays.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(c.total - paid, 0);
  const pct = c.total > 0 ? Math.min(paid / c.total, 1) : 0;
  const monthsLeft = c.monthly > 0 ? Math.ceil(remaining / c.monthly) : null;
  let end = null;
  if (monthsLeft != null) { const d = new Date(); d.setMonth(d.getMonth() + monthsLeft); end = d; }
  return { c, pays, paid, remaining, pct, monthsLeft, end };
}

/* ============================== graphiques ============================== */
const charts = {}, chartMem = {}, ringMem = {};
function pathD(xs, ys) {
  const n = xs.length; if (n === 1) return `M${xs[0]} ${ys[0]}`;
  let d = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = i ? i - 1 : i, p3 = i + 2 < n ? i + 2 : i + 1;
    d += `C${(xs[i] + (xs[i + 1] - xs[p0]) / 6).toFixed(1)} ${(ys[i] + (ys[i + 1] - ys[p0]) / 6).toFixed(1)} ${(xs[i + 1] - (xs[p3] - xs[i]) / 6).toFixed(1)} ${(ys[i + 1] - (ys[p3] - ys[i]) / 6).toFixed(1)} ${xs[i + 1].toFixed(1)} ${ys[i + 1].toFixed(1)}`;
  }
  return d;
}
function resample(a, n) {
  if (a.length === n) return a.slice();
  if (a.length === 1) return Array(n).fill(a[0]);
  return Array.from({ length: n }, (_, i) => { const p = n === 1 ? 0 : i * (a.length - 1) / (n - 1), j = Math.floor(p), f = p - j; return a[j] + ((a[Math.min(j + 1, a.length - 1)] - a[j]) * f); });
}
function lineChart(id, ys, labels, o = {}) {
  const known = ys.map((v, i) => v == null ? -1 : i).filter(i => i >= 0);
  if (!known.length) return `<div class="empty">${o.empty || 'Pas encore de données'}</div>`;
  const W = o.w || 640, H = o.h || (o.spark ? 50 : 230), pl = o.spark ? 3 : 40, pr = o.spark ? 3 : 10, pt = o.spark ? 5 : 14, pb = o.spark ? 5 : 26;
  const f = ys.slice(), a = known[0], z = known[known.length - 1];
  for (let i = 0; i < a; i++) f[i] = ys[a];
  for (let i = z + 1; i < f.length; i++) f[i] = ys[z];
  for (let k = 0; k < known.length - 1; k++) for (let i = known[k] + 1; i < known[k + 1]; i++) f[i] = ys[known[k]] + (ys[known[k + 1]] - ys[known[k]]) * (i - known[k]) / (known[k + 1] - known[k]);
  const kv = known.map(i => ys[i]);
  let lo = Math.min(...kv), hi = Math.max(...kv);
  if (o.goal != null) { lo = Math.min(lo, o.goal); hi = Math.max(hi, o.goal); }
  if (o.zero) lo = Math.min(lo, 0);
  const padv = (hi - lo) * .15 || 1; if (!o.zero) lo -= padv; else if (lo < 0) lo -= padv; hi += padv;
  const X = i => pl + (f.length === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (f.length - 1));
  const Y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const xs = f.map((_, i) => X(i)), pts = f.map(Y);
  charts[id] = { xs, pts, f, labels, unit: o.unit || '', dec: o.dec ?? 1, known, H, pb, W, spark: !!o.spark, base: H - pb };
  let grid = '';
  if (!o.spark) {
    for (let k = 0; k <= 3; k++) { const v = lo + (hi - lo) * k / 3, y = Y(v); grid += `<line class="grid-l" x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/><text class="ax" x="${pl - 8}" y="${y + 4}" text-anchor="end">${fmt(v, o.dec ?? 1)}</text>`; }
    const nl = labels.length, idx = [0, Math.floor((nl - 1) / 2), nl - 1];
    grid += [...new Set(idx)].map((i, k, arr) => `<text class="ax" x="${xs[i]}" y="${H - 6}" text-anchor="${k === 0 ? 'start' : k === arr.length - 1 ? 'end' : 'middle'}">${esc(labels[i])}</text>`).join('');
    if (o.goal != null) grid += `<line class="goal" x1="${pl}" x2="${W - pr}" y1="${Y(o.goal)}" y2="${Y(o.goal)}"/><text class="ax" x="${W - pr}" y="${Y(o.goal) - 5}" text-anchor="end" style="fill:var(--ok)">objectif ${fmt(o.goal, o.dec ?? 1)}</text>`;
  }
  const marks = (o.spark ? [z] : known).map(i => `<circle data-i="${i}" cx="${xs[i]}" cy="${pts[i]}" r="${o.spark ? 3 : known.length > 45 ? 0 : 4}" fill="var(--bg)" stroke="var(--acc)" stroke-width="2.5"/>`).join('');
  const d = pathD(xs, pts);
  return `<div class="cw" style="position:relative"><svg class="chart${o.spark ? ' spark' : ''}" viewBox="0 0 ${W} ${H}" data-id="${id}"${o.spark ? ' preserveAspectRatio="none"' : ''}>
  <defs><linearGradient id="g-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--acc)" stop-opacity=".38"/><stop offset="1" stop-color="var(--acc)" stop-opacity="0"/></linearGradient></defs>
  ${grid}<path class="area" fill="url(#g-${id})" d="${d}L${xs[xs.length - 1]} ${H - pb}L${xs[0]} ${H - pb}Z"/><path class="line" d="${d}"${o.spark ? ' style="stroke-width:2.2"' : ''}/>${marks}</svg></div>`;
}
function hydrate() {
  for (const svg of $$('svg.chart[data-id]')) {
    const id = svg.dataset.id, c = charts[id]; if (!c) continue;
    const prev = chartMem[id], target = c.pts;
    const from = prev ? resample(prev, target.length) : target.map(() => c.base);
    chartMem[id] = target;
    if (from.every((v, i) => Math.abs(v - target[i]) < .3)) continue;
    const line = $('.line', svg), area = $('.area', svg), dots = $$('circle[data-i]', svg), t0 = performance.now(), dur = 750;
    const step = now => {
      if (!svg.isConnected) return;
      const k = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - k, 3);
      const ys = target.map((v, i) => from[i] + (v - from[i]) * e), d = pathD(c.xs, ys);
      line.setAttribute('d', d); area.setAttribute('d', `${d}L${c.xs[c.xs.length - 1]} ${c.base}L${c.xs[0]} ${c.base}Z`);
      dots.forEach(dt => dt.setAttribute('cy', ys[dt.dataset.i]));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  for (const el of $$('circle[data-ring]')) {
    const id = el.dataset.ring, pct = Number(el.dataset.pct), c = Number(el.dataset.c);
    ringMem[id] = pct;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.strokeDashoffset = c * (1 - pct); }));
  }
}
function ring(id, pct, label, { size = 130, sw = 12, plain = false, sub = '' } = {}) {
  pct = Math.max(0, Math.min(1, pct || 0));
  const r = (size - sw) / 2, c = 2 * Math.PI * r, prev = ringMem[id] ?? 0, m = size / 2;
  return `<svg class="ring ${plain ? 'plain' : ''}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle class="tr" cx="${m}" cy="${m}" r="${r}" fill="none" stroke-width="${sw}"/>
  <circle class="pg" data-ring="${id}" data-pct="${pct}" data-c="${c}" cx="${m}" cy="${m}" r="${r}" fill="none" stroke="${plain ? 'var(--acc)' : '#fff'}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - prev)}" transform="rotate(-90 ${m} ${m})"/>
  <text x="${m}" y="${m + (sub ? 2 : 7)}" text-anchor="middle" font-size="${size / 4.6}" font-weight="800" fill="${plain ? 'var(--text)' : '#fff'}">${label}</text>${sub ? `<text x="${m}" y="${m + size / 6.5}" text-anchor="middle" font-size="${size / 11}" fill="${plain ? 'var(--muted)' : 'rgba(255,255,255,.8)'}">${sub}</text>` : ''}</svg>`;
}
function bars(id, items, { goal, h = 150, unit = '' } = {}) { // items: [{label, v}]
  const max = Math.max(...items.map(i => i.v), goal || 0, 1) * 1.1, W = 640, bw = W / items.length;
  return `<svg class="chart" viewBox="0 0 ${W} ${h + 22}">${goal ? `<line class="goal" x1="0" x2="${W}" y1="${h - goal / max * h}" y2="${h - goal / max * h}"/>` : ''}
  ${items.map((it, i) => { const bh = it.v / max * h; return `<g><rect x="${i * bw + bw * .18}" y="${h - bh}" width="${bw * .64}" height="${Math.max(bh, 0)}" rx="5" fill="${goal && it.v > goal ? 'var(--warn)' : 'var(--acc)'}" opacity="${it.v ? 1 : .15}" style="transform-box:fill-box;transform-origin:bottom;animation:grow .7s ${i * 25}ms cubic-bezier(.2,.8,.2,1) both"><title>${esc(it.label)} : ${fmt(it.v, 0)}${unit}</title></rect>
  <text class="ax" x="${i * bw + bw / 2}" y="${h + 16}" text-anchor="middle">${esc(it.label)}</text></g>`; }).join('')}</svg>`;
}

/* ============================== UI state ============================== */
const ui = { tab: (location.hash.slice(2) || 'home'), date: today(), range: 30, month: today().slice(0, 7), dirty: false, anim: true };
if (!TABS.some(t => t[0] === ui.tab)) ui.tab = 'home';
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
const theme = () => LS.get('ld_theme', 'auto');
function applyTheme() {
  const c = cfg(), t = theme();
  const light = t === 'light' || (t === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  const rgb = ACCENTS[c.accent] || ACCENTS.Jade;
  document.documentElement.style.setProperty('--acc-rgb', rgb);
  document.documentElement.style.setProperty('--acc', `rgb(${rgb})`);
  const tc = light ? '#eef6f4' : '#0a1514';
  $('meta[name=theme-color]').content = tc;
}
function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), 2200);
}
function go(tab) { ui.anim = true; ui.tab = tab; history.replaceState(null, '', '#/' + tab); render(true); window.scrollTo(0, 0); }

/* ============================== vues ============================== */
const head = (title, sub, right = '') => `<div class="top"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="row">${right}<span class="chip" data-sync>${syncHtml()}</span></div></div>`;
const dateBar = () => `<div class="datebar"><button data-act="dday" data-n="-1" aria-label="Jour précédent">${ic('l')}</button><span class="d">${ui.date === today() ? 'Aujourd’hui' : longDate(ui.date)}</span><button data-act="dday" data-n="1" aria-label="Jour suivant">${ic('r')}</button>${ui.date !== today() ? '<button data-act="dtoday" style="width:auto;padding:0 12px;font-weight:600">Auj.</button>' : ''}</div>`;
const greet = () => { const h = new Date().getHours(), n = cfg().name; return `${h < 5 || h >= 18 ? 'Bonsoir' : h < 12 ? 'Bonjour' : 'Bon après-midi'}${n ? ', ' + esc(n) : ''}`; };

function mealsCard(d) {
  const x = day(d), meals = x.meals || [], c = cfg(), tot = kcalOf(d);
  const freq = {}; dayIds().forEach(k => (day(k).meals || []).forEach(m => { const f = freq[m.name.toLowerCase()] = freq[m.name.toLowerCase()] || { n: 0, name: m.name, kcal: m.kcal, slot: m.slot }; f.n++; f.kcal = m.kcal; }));
  const top = Object.values(freq).sort((a, b) => b.n - a.n).slice(0, 6);
  return `<div class="card c6"><h3>${ic('food')}Repas · ${fmt(tot, 0)} / ${fmt(c.kcalGoal, 0)} kcal</h3>
  <div class="bar" style="margin-bottom:12px"><i style="width:${Math.min(tot / c.kcalGoal * 100, 100)}%"></i></div>
  <div class="list">${meals.length ? meals.map(m => `<div class="item"><div class="grow"><div class="t">${esc(m.name)}</div><div class="s">${esc(m.slot)}${m.kcal ? ' · ' + fmt(m.kcal, 0) + ' kcal' : ''}</div></div><button class="x" data-act="delmeal" data-id="${m.id}" aria-label="Supprimer">${ic('x')}</button></div>`).join('') : '<div class="empty">Rien noté pour ce jour</div>'}</div>
  <form data-form="meal" style="margin-top:12px;display:grid;grid-template-columns:1fr 90px;gap:8px"><input class="field" name="name" placeholder="Ex : 2 œufs, 100 g de riz, 1 pomme" required maxlength="60"><input class="field" name="kcal" type="number" inputmode="numeric" min="0" placeholder="kcal ✨ auto">
  <select class="field" name="slot">${SLOTS.map((s, i) => `<option ${i === defaultSlot() ? 'selected' : ''}>${s}</option>`).join('')}</select><button class="btn pri" style="justify-content:center" data-ai>${ic('plus')}Ajouter</button></form><p class="sub" style="margin:8px 0 0">Laisse « kcal » vide : l’IA estime les calories pour toi ✨</p>
  ${top.length ? `<div class="chips" style="margin-top:12px">${top.map(t => `<button data-act="quickmeal" data-name="${esc(t.name)}" data-kcal="${t.kcal || ''}" data-slot="${esc(t.slot)}">+ ${esc(t.name)}</button>`).join('')}</div>` : ''}</div>`;
}
const defaultSlot = () => { const h = new Date().getHours(); return h < 10 ? 0 : h < 15 ? 1 : h < 17 ? 3 : 2; };

function vToday() {
  const d = ui.date, x = day(d), c = cfg(), sc = score(d);
  const lastW = [...weights()].filter(w => w.date < d).pop();
  return head('Aujourd’hui', longDate(d), dateBar()) + `<div class="grid">
  <div class="card c4 hero" style="display:flex;gap:16px;align-items:center;justify-content:space-between"><div><h3>Journée remplie</h3><div class="big">${Math.round(sc * 100)} <em>%</em></div><p>${sc === 1 ? 'Parfait, tout est noté 🎉' : 'Coche tout ce que tu as fait.'}</p></div>${ring('today-' + d, sc, Math.round(sc * 100) + '%', { size: 112 })}</div>
  <div class="card c4"><h3>${ic('weight')}Poids</h3><div class="big-in"><input data-day="weight" data-num type="number" step="0.1" inputmode="decimal" placeholder="--,-" value="${x.weight ?? ''}"><span>kg</span></div>
    <div class="sub">${x.weight != null && lastW ? `${x.weight > lastW.w ? '▲' : x.weight < lastW.w ? '▼' : '='} ${fmt(Math.abs(x.weight - lastW.w))} kg vs ${shortDate(lastW.date)}` : lastW ? `Dernier : ${fmt(lastW.w)} kg (${shortDate(lastW.date)})` : 'Entre ton poids du jour'}</div></div>
  <div class="card c4"><h3>${ic('work')}Travail</h3><div class="seg" data-seg="work">${[['work', 'Travaillé'], ['off', 'Repos'], ['leave', 'Congé']].map(([k, l]) => `<button class="${x.work === k ? 'on' : ''}" data-act="set" data-k="work" data-v="${k}">${l}</button>`).join('')}</div>
    ${x.work === 'work' ? `<div style="margin-top:12px"><label class="l">Heures travaillées</label><input class="field" data-day="workH" data-num type="number" step="0.25" inputmode="decimal" placeholder="ex. 7,5" value="${x.workH ?? ''}"></div>` : ''}</div>
  <div class="card c6"><h3>${ic('sport')}Sport</h3><div class="seg">${[['done', '✅ Séance faite'], ['rest', '😴 Repos']].map(([k, l]) => `<button class="${x.sport === k ? 'on' : ''}" data-act="set" data-k="sport" data-v="${k}">${l}</button>`).join('')}</div>
    ${x.sport === 'done' ? `<div class="chips" style="margin-top:12px">${SPORTS.map(s => `<button class="${x.sportType === s ? 'on' : ''}" data-act="set" data-k="sportType" data-v="${s}">${s}</button>`).join('')}</div><div style="margin-top:12px"><label class="l">Durée (minutes)</label><input class="field" data-day="sportMin" data-num type="number" inputmode="numeric" placeholder="45" value="${x.sportMin ?? ''}"></div>` : ''}</div>
  <div class="card c3"><h3>💧 Eau</h3><div class="stepper"><button data-act="water" data-n="-1" aria-label="Moins">−</button><b>${x.water || 0}</b><button data-act="water" data-n="1" aria-label="Plus">+</button></div><div class="drops">${Array.from({ length: Math.max(c.waterGoal, x.water || 0) }, (_, i) => `<i class="${i < (x.water || 0) ? 'on' : ''}"></i>`).join('')}</div><div class="sub">objectif ${c.waterGoal} verres</div></div>
  <div class="card c3"><h3>🌙 Sommeil</h3><div class="big-in"><input data-day="sleep" data-num type="number" step="0.25" inputmode="decimal" placeholder="--" style="width:90px" value="${x.sleep ?? ''}"><span>h</span></div><h3 style="margin-top:14px">Humeur</h3><div class="moods">${MOODS.map((m, i) => `<button class="${x.mood === i + 1 ? 'on' : ''}" data-act="set" data-k="mood" data-v="${i + 1}" data-num aria-label="Humeur ${i + 1}">${m}</button>`).join('')}</div></div>
  ${mealsCard(d)}
  <div class="card c6"><h3>📝 Notes du jour</h3><textarea class="field" data-day="notes" rows="5" placeholder="Comment s’est passée ta journée ?">${esc(x.notes || '')}</textarea></div>
  </div>`;
}

function vHome() {
  const c = cfg(), t = today(), ws = weights(), lastW = ws[ws.length - 1];
  const cs = creditStats(), ms = monthDays(t.slice(0, 7)), worked = ms.filter(d => day(d).work === 'work').length;
  const wk = weekStats(t), wkS = weekStart(t);
  let avg = 0; for (let i = 0; i < 7; i++) avg += score(addDays(t, -i)); avg /= 7;
  const days30 = Array.from({ length: 30 }, (_, i) => addDays(t, i - 29));
  const wy = days30.map(d => day(d).weight ?? null);
  const first30 = ws.find(w => w.date >= days30[0]);
  const delta = lastW && first30 && first30 !== lastW ? lastW.w - first30.w : null;
  const sleepArr = Array.from({ length: 7 }, (_, i) => day(addDays(t, -i)).sleep).filter(v => v != null);
  const kcalArr = Array.from({ length: 7 }, (_, i) => kcalOf(addDays(t, -i))).filter(v => v > 0);
  const waterArr = Array.from({ length: 7 }, (_, i) => day(addDays(t, -i)).water).filter(v => v != null);
  const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  const x = day(t);
  const todo = [['Poids', x.weight != null], ['Sport', !!x.sport], ['Travail', !!x.work], ['Eau', (x.water || 0) >= c.waterGoal], ['Repas', (x.meals || []).length > 0], ['Sommeil', x.sleep != null], ['Humeur', x.mood != null]];
  const heatRows = [['Sport', d => day(d).sport === 'done' ? 'on' : day(d).sport === 'rest' ? 'mid' : ''], ['Travail', d => day(d).work === 'work' ? 'on' : day(d).work ? 'mid' : ''], ['Poids', d => day(d).weight != null ? 'on' : ''], ['Repas', d => kcalOf(d) > 0 ? 'on' : ''], ['Eau', d => (day(d).water || 0) >= c.waterGoal ? 'on' : (day(d).water || 0) > 0 ? 'mid' : '']];
  const wdays = Array.from({ length: 7 }, (_, i) => addDays(wkS, i));
  return head(greet(), longDate(t), `<button class="btn" data-act="palette">${ic('search')}<span class="kbd">⌘K</span></button>`) + `<div class="grid">
  <div class="card c7 hero" style="display:flex;justify-content:space-between;gap:16px;align-items:center"><div><h3>Ta semaine</h3><div class="big">Tu es à <em>${Math.round(avg * 100)} %</em> de suivi cette semaine</div><p>${wk.n}/${c.sportTarget} séances · ${worked} jours travaillés ce mois</p><button class="btn" style="background:rgba(255,255,255,.95);color:#0b4a44" data-act="go" data-to="today">Remplir aujourd’hui →</button></div>${ring('week', avg, Math.round(avg * 100) + '%', { size: 138, sw: 13 })}</div>
  <div class="card c5"><h3>${ic('today')}À faire aujourd’hui</h3><div class="chips">${todo.map(([l, ok]) => `<button class="${ok ? 'on' : ''}" data-act="go" data-to="today">${ok ? '✓' : '○'} ${l}</button>`).join('')}</div>
    <div class="row" style="margin-top:14px"><button class="btn pri sm" data-act="set-today" data-k="sport" data-v="done">✅ Sport fait</button><button class="btn sm" data-act="set-today" data-k="work" data-v="work">💼 J’ai travaillé</button><button class="btn sm" data-act="water-today">💧 +1 verre</button></div></div>
  <div class="card c3 kpis"><h3>${ic('weight')}Poids</h3><div class="val">${fmt(lastW?.w)}<small>kg</small></div><div class="sub">${delta != null ? `<span class="chip ${delta <= 0 ? 'up' : 'down'}">${delta <= 0 ? '▼' : '▲'} ${fmt(Math.abs(delta))} kg / 30 j</span>` : 'Entre ton poids'}</div>${lineChart('sp-w', wy, days30.map(shortDate), { spark: true })}</div>
  <div class="card c3 kpis"><h3>${ic('credit')}Crédit</h3><div class="val">${Math.round(cs.pct * 100)}<small>% remboursé</small></div><div class="sub">${cs.c.total ? `Reste ${eur(cs.remaining)}` : 'À configurer'}</div><div class="bar" style="margin-top:16px"><i style="width:${cs.pct * 100}%"></i></div><div class="sub" style="margin-top:8px">${cs.end ? 'Fin estimée ' + cs.end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : ''}</div></div>
  <div class="card c3 kpis"><h3>${ic('work')}Travail</h3><div class="val">${worked}<small>/ ${c.workTarget} j ce mois</small></div><div class="bar" style="margin-top:16px"><i style="width:${Math.min(worked / c.workTarget * 100, 100)}%"></i></div><div class="sub" style="margin-top:8px">${c.dayRate ? 'Env. ' + eur(worked * c.dayRate) : ms.filter(d => day(d).work === 'off').length + ' jours de repos'}</div></div>
  <div class="card c3 kpis"><h3>${ic('sport')}Sport</h3><div class="val">${wk.n}<small>/ ${c.sportTarget} séances</small></div><div class="bar" style="margin-top:16px"><i style="width:${Math.min(wk.n / c.sportTarget * 100, 100)}%"></i></div><div class="sub" style="margin-top:8px">${wk.min} min cette semaine</div></div>
  <div class="card c8"><h3>${ic('weight')}Évolution du poids · 30 jours</h3>${lineChart('home-w', wy, days30.map(shortDate), { goal: c.goalWeight, unit: ' kg', empty: 'Entre ton poids pour voir la courbe bouger 📈' })}</div>
  <div class="card c4"><h3>Moyennes · 7 jours</h3><div class="list"><div class="item"><div class="grow t">🌙 Sommeil</div><b>${fmt(mean(sleepArr))} h</b></div><div class="item"><div class="grow t">🍽️ Calories</div><b>${fmt(mean(kcalArr), 0)} kcal</b></div><div class="item"><div class="grow t">💧 Eau</div><b>${fmt(mean(waterArr))} verres</b></div><div class="item"><div class="grow t">😊 Humeur</div><b>${fmt(mean(Array.from({ length: 7 }, (_, i) => day(addDays(t, -i)).mood).filter(v => v != null)))} / 5</b></div></div></div>
  <div class="card c12"><h3>Cette semaine</h3><div class="heat"><span></span>${wdays.map(d => `<span class="hd">${parse(d).toLocaleDateString('fr-FR', { weekday: 'short' })}</span>`).join('')}${heatRows.map(([l, fn]) => `<span>${l}</span>${wdays.map(d => `<span class="c ${fn(d)}" data-act="goday" data-d="${d}" style="cursor:pointer">${fn(d) === 'on' ? '✓' : fn(d) === 'mid' ? '·' : ''}</span>`).join('')}`).join('')}</div></div>
  </div>`;
}

function vWeight() {
  const c = cfg(), t = today(), ws = weights();
  const first = ws[0]?.date, start = addDays(t, -(ui.range === 0 ? 365 * 5 : ui.range - 1));
  let from = ws.length ? (first > start ? first : start) : start;
  if (diffDays(from, t) < 6) from = addDays(t, -6);
  const n = diffDays(from, t) + 1, days = Array.from({ length: n }, (_, i) => addDays(from, i));
  const ys = days.map(d => day(d).weight ?? null);
  const last = ws[ws.length - 1], startW = c.startWeight ?? ws[0]?.w, x = day(ui.date);
  const bmi = last && c.height ? last.w / Math.pow(c.height / 100, 2) : null;
  const lost = last && startW != null ? startW - last.w : null;
  const toGo = last && c.goalWeight != null ? last.w - c.goalWeight : null;
  return head('Poids', 'La courbe bouge dès que tu entres ta pesée', dateBar()) + `<div class="grid">
  <div class="card c8"><div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">Courbe</h3><div class="seg">${[[30, '30 j'], [90, '3 mois'], [180, '6 mois'], [0, 'Tout']].map(([r, l]) => `<button class="${ui.range === r ? 'on' : ''}" data-act="range" data-r="${r}">${l}</button>`).join('')}</div></div>
    ${lineChart('weight-main', ys, days.map(shortDate), { goal: c.goalWeight, unit: ' kg', empty: 'Entre ta première pesée →' })}</div>
  <div class="card c4"><h3>Pesée du ${shortDate(ui.date)}</h3><div class="big-in"><input data-day="weight" data-num type="number" step="0.1" inputmode="decimal" placeholder="--,-" value="${x.weight ?? ''}"><span>kg</span></div>
    <div class="list" style="margin-top:18px"><div class="item"><div class="grow">Actuel</div><b>${fmt(last?.w)} kg</b></div><div class="item"><div class="grow">Départ</div><b>${fmt(startW)} kg</b></div><div class="item"><div class="grow">Objectif</div><b>${fmt(c.goalWeight)} kg</b></div>
    <div class="item"><div class="grow">${lost != null && lost < 0 ? 'Pris' : 'Perdu'}</div><b>${lost != null ? fmt(Math.abs(lost)) + ' kg' : '–'}</b></div><div class="item"><div class="grow">Reste à ${toGo != null && toGo < 0 ? 'prendre' : 'perdre'}</div><b>${toGo != null ? fmt(Math.abs(toGo)) + ' kg' : '–'}</b></div>${bmi ? `<div class="item"><div class="grow">IMC</div><b>${fmt(bmi)}</b></div>` : ''}</div></div>
  <div class="card c12"><h3>Historique</h3>${ws.length ? `<table class="table"><tr><th>Date</th><th>Poids</th><th>Écart</th><th></th></tr>${[...ws].reverse().slice(0, 15).map((w, i, a) => { const p = a[i + 1]; const dl = p ? w.w - p.w : null; return `<tr><td>${longDate(w.date)}</td><td><b>${fmt(w.w)} kg</b></td><td>${dl == null ? '' : `<span class="chip ${dl <= 0 ? 'up' : 'down'}">${dl <= 0 ? '▼' : '▲'} ${fmt(Math.abs(dl))}</span>`}</td><td style="text-align:right"><button class="x" data-act="delweight" data-d="${w.date}" aria-label="Supprimer">${ic('x')}</button></td></tr>`; }).join('')}</table>` : '<div class="empty">Aucune pesée pour l’instant</div>'}</div></div>`;
}

function vSport() {
  const c = cfg(), t = today(), wk = weekStats(t), ws0 = weekStart(t);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(ws0, (i - 7) * 7));
  const mdays = monthDays(t.slice(0, 7)), mCount = mdays.filter(d => day(d).sport === 'done').length, mMin = mdays.reduce((s, d) => s + (day(d).sport === 'done' ? day(d).sportMin || 0 : 0), 0);
  let streak = 0; for (let i = 1; i < 60; i++) { if (weekStats(addDays(ws0, -7 * i)).n >= c.sportTarget) streak++; else break; } if (wk.n >= c.sportTarget) streak++;
  const types = {}; dayIds().forEach(d => { const x = day(d); if (x.sport === 'done') types[x.sportType || 'Autre'] = (types[x.sportType || 'Autre'] || 0) + 1; });
  const tmax = Math.max(1, ...Object.values(types));
  const recent = dayIds().filter(d => day(d).sport === 'done').reverse().slice(0, 8);
  return head('Sport', 'Coche tes séances, garde la série', dateBar()) + `<div class="grid">
  <div class="card c4 hero" style="display:flex;align-items:center;justify-content:space-between"><div><h3>Cette semaine</h3><div class="big">${wk.n} / ${c.sportTarget}</div><p>${wk.n >= c.sportTarget ? 'Objectif atteint 🔥' : `Encore ${c.sportTarget - wk.n} séance(s)`}</p></div>${ring('sportw', wk.n / c.sportTarget, Math.round(Math.min(wk.n / c.sportTarget, 1) * 100) + '%', { size: 110 })}</div>
  <div class="card c4"><h3>Ce mois-ci</h3><div class="val">${mCount}<small>séances</small></div><div class="sub">${mMin} min au total</div></div>
  <div class="card c4"><h3>Série</h3><div class="val">${streak}<small>semaine(s) d’objectif</small></div><div class="sub">Objectif : ${c.sportTarget} séances / semaine</div></div>
  <div class="card c6"><h3>Séance du ${shortDate(ui.date)}</h3><div class="seg">${[['done', '✅ Faite'], ['rest', '😴 Repos']].map(([k, l]) => `<button class="${day(ui.date).sport === k ? 'on' : ''}" data-act="set" data-k="sport" data-v="${k}">${l}</button>`).join('')}</div>
    ${day(ui.date).sport === 'done' ? `<div class="chips" style="margin-top:12px">${SPORTS.map(s => `<button class="${day(ui.date).sportType === s ? 'on' : ''}" data-act="set" data-k="sportType" data-v="${s}">${s}</button>`).join('')}</div><div style="margin-top:12px"><label class="l">Durée (min)</label><input class="field" data-day="sportMin" data-num type="number" inputmode="numeric" value="${day(ui.date).sportMin ?? ''}"></div>` : ''}</div>
  <div class="card c6"><h3>8 dernières semaines</h3><div class="heat"><span></span>${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(l => `<span class="hd">${l}</span>`).join('')}${weeks.map(w => `<span>${shortDate(w)}</span>${Array.from({ length: 7 }, (_, i) => { const d = addDays(w, i), s = day(d).sport; return `<span class="c ${s === 'done' ? 'on' : s === 'rest' ? 'mid' : ''}" data-act="goday" data-d="${d}" style="cursor:pointer;${d > t ? 'opacity:.3' : ''}">${s === 'done' ? '✓' : ''}</span>`; }).join('')}`).join('')}</div></div>
  <div class="card c6"><h3>Types de séance</h3><div class="list">${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div><div class="row" style="justify-content:space-between"><span>${k}</span><b>${n}</b></div><div class="bar"><i style="width:${n / tmax * 100}%"></i></div></div>`).join('') || '<div class="empty">Pas encore de séance</div>'}</div></div>
  <div class="card c6"><h3>Dernières séances</h3><div class="list">${recent.map(d => `<div class="item"><div class="grow"><div class="t">${esc(day(d).sportType || 'Séance')}</div><div class="s">${longDate(d)}</div></div><b>${day(d).sportMin ? day(d).sportMin + ' min' : ''}</b></div>`).join('') || '<div class="empty">—</div>'}</div></div></div>`;
}

function vFood() {
  const c = cfg(), t = today();
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13));
  const k = days.map(d => kcalOf(d)), logged = k.filter(v => v > 0), avg = logged.length ? logged.reduce((s, v) => s + v, 0) / logged.length : null;
  return head('Repas', 'Note ce que tu manges, suis tes calories', dateBar()) + `<div class="grid">
  <div class="card c4 hero" style="display:flex;align-items:center;justify-content:space-between"><div><h3>${ui.date === t ? 'Aujourd’hui' : shortDate(ui.date)}</h3><div class="big">${fmt(kcalOf(ui.date), 0)} <em>kcal</em></div><p>sur ${fmt(c.kcalGoal, 0)} visées</p></div>${ring('kcal', kcalOf(ui.date) / c.kcalGoal, Math.round(kcalOf(ui.date) / c.kcalGoal * 100) + '%', { size: 108 })}</div>
  <div class="card c8"><h3>14 derniers jours · moyenne ${fmt(avg, 0)} kcal</h3>${bars('kc', days.map((d, i) => ({ label: parse(d).getDate(), v: k[i] })), { goal: c.kcalGoal, unit: ' kcal' })}</div>
  ${mealsCard(ui.date)}
  <div class="card c6"><h3>Journal alimentaire</h3><div class="list">${days.slice().reverse().filter(d => (day(d).meals || []).length).slice(0, 7).map(d => `<div class="item" style="align-items:flex-start;flex-direction:column;gap:2px"><div class="row" style="width:100%;justify-content:space-between"><b style="text-transform:capitalize">${longDate(d)}</b><span class="chip">${fmt(kcalOf(d), 0)} kcal</span></div><div class="s">${day(d).meals.map(m => esc(m.name)).join(' · ')}</div></div>`).join('') || '<div class="empty">Rien pour l’instant</div>'}</div></div></div>`;
}

function vWork() {
  const c = cfg(), t = today(), m = ui.month, ds = monthDays(m), off = (parse(m + '-01').getDay() + 6) % 7;
  const cnt = k => ds.filter(d => day(d).work === k).length, hours = ds.reduce((s, d) => s + (day(d).work === 'work' ? day(d).workH || 0 : 0), 0);
  const year = dayIds().filter(d => d.startsWith(m.slice(0, 4)) && day(d).work === 'work').length;
  const shift = n => { const d = parse(m + '-01'); d.setMonth(d.getMonth() + n); return ymd(d).slice(0, 7); };
  return head('Travail', 'Touche un jour pour changer : travaillé → repos → congé', `<div class="datebar"><button data-act="month" data-m="${shift(-1)}">${ic('l')}</button><span class="d">${monthName(m)}</span><button data-act="month" data-m="${shift(1)}">${ic('r')}</button></div>`) + `<div class="grid">
  <div class="card c7"><div class="cal">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(l => `<span class="h">${l}</span>`).join('')}${Array.from({ length: off }, () => '<button class="blank" tabindex="-1"></button>').join('')}${ds.map(d => { const x = day(d); return `<button class="${x.work || ''} ${d === t ? 'today' : ''}" data-act="calcycle" data-d="${d}">${parse(d).getDate()}${x.work === 'work' && x.workH ? `<small>${x.workH}h</small>` : ''}</button>`; }).join('')}</div>
    <div class="legend"><span><i style="background:var(--acc)"></i>Travaillé</span><span><i style="background:rgba(56,189,248,.5)"></i>Repos</span><span><i style="background:rgba(251,191,36,.6)"></i>Congé</span></div></div>
  <div class="card c5"><h3>${monthName(m)}</h3><div class="val">${cnt('work')}<small>jours travaillés / ${c.workTarget}</small></div><div class="bar" style="margin:14px 0"><i style="width:${Math.min(cnt('work') / c.workTarget * 100, 100)}%"></i></div>
    <div class="list"><div class="item"><div class="grow">Heures</div><b>${fmt(hours)} h</b></div><div class="item"><div class="grow">Repos</div><b>${cnt('off')}</b></div><div class="item"><div class="grow">Congés</div><b>${cnt('leave')}</b></div>${c.dayRate ? `<div class="item"><div class="grow">Revenu estimé</div><b>${eur(cnt('work') * c.dayRate)}</b></div>` : ''}<div class="item"><div class="grow">Jours travaillés en ${m.slice(0, 4)}</div><b>${year}</b></div></div>
    ${c.dayRate ? '' : '<p class="sub">Astuce : ajoute ton tarif journalier dans Réglages pour estimer tes revenus.</p>'}</div></div>`;
}

function vCredit() {
  const s = creditStats(), c = s.c, t = today();
  // solde restant par mois depuis le début
  let series = '';
  const startM = (c.start || s.pays[s.pays.length - 1]?.date || t).slice(0, 7);
  if (c.total > 0) {
    const months = []; let m = startM; while (m <= t.slice(0, 7) && months.length < 120) { months.push(m); const d = parse(m + '-01'); d.setMonth(d.getMonth() + 1); m = ymd(d).slice(0, 7); }
    if (months.length < 2) months.unshift(addDays(startM + '-01', -1).slice(0, 7));
    const ys = months.map(mm => c.total - s.pays.filter(p => p.date.slice(0, 7) <= mm).reduce((a, p) => a + Number(p.amount), 0));
    series = lineChart('credit', ys, months.map(mm => monthName(mm).replace(/^(\S{3})\S*/, '$1.')), { unit: ' €', dec: 0, zero: true });
  }
  return head('Crédit', 'Suis ton remboursement jusqu’à la dernière mensualité', `<button class="btn pri" data-act="addpay">${ic('plus')}Remboursement</button>`) + `<div class="grid">
  <div class="card c4 hero" style="display:flex;align-items:center;justify-content:space-between"><div><h3>${esc(c.name)}</h3><div class="big">${eur(s.remaining)}</div><p>restant sur ${eur(c.total)}</p></div>${ring('credit-r', s.pct, Math.round(s.pct * 100) + '%', { size: 108 })}</div>
  <div class="card c4"><h3>Déjà remboursé</h3><div class="val">${eur(s.paid)}</div><div class="sub">${s.pays.length} versement(s)</div><div class="bar" style="margin-top:14px"><i style="width:${s.pct * 100}%"></i></div></div>
  <div class="card c4"><h3>Fin estimée</h3><div class="val">${s.end ? s.end.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '–'}</div><div class="sub">${s.monthsLeft != null ? `${s.monthsLeft} mensualité(s) de ${eur(c.monthly)}` : 'Renseigne ta mensualité ci-dessous'}</div></div>
  <div class="card c8"><h3>Solde restant dans le temps</h3>${series || '<div class="empty">Renseigne le montant total pour voir la courbe</div>'}</div>
  <div class="card c4"><h3>Mon crédit</h3><div class="list" style="gap:10px"><div><label class="l">Nom</label><input class="field" data-cr="name" value="${esc(c.name)}"></div><div><label class="l">Montant total à rembourser (€)</label><input class="field" data-cr="total" data-num type="number" inputmode="decimal" value="${c.total || ''}"></div><div><label class="l">Mensualité (€)</label><input class="field" data-cr="monthly" data-num type="number" inputmode="decimal" value="${c.monthly || ''}"></div><div><label class="l">Date de début</label><input class="field" data-cr="start" type="date" value="${c.start || ''}"></div></div></div>
  <div class="card c12"><h3>Versements</h3>${s.pays.length ? `<table class="table"><tr><th>Date</th><th>Montant</th><th>Note</th><th></th></tr>${s.pays.map(p => `<tr><td>${longDate(p.date)}</td><td><b>${eur(p.amount)}</b></td><td>${esc(p.note || '')}</td><td style="text-align:right"><button class="x" data-act="delpay" data-id="${p.id}" aria-label="Supprimer">${ic('x')}</button></td></tr>`).join('')}</table>` : '<div class="empty">Aucun remboursement enregistré</div>'}</div></div>`;
}

function vSettings() {
  const c = cfg(), th = theme(), n = (k, l, step = '1', ph = '') => `<div><label class="l">${l}</label><input class="field" data-cfg="${k}" data-num type="number" step="${step}" inputmode="decimal" placeholder="${ph}" value="${c[k] ?? ''}"></div>`;
  return head('Réglages', 'Objectifs, apparence et synchronisation') + `<div class="grid">
  <div class="card c6"><h3>Profil & objectifs</h3><div class="f2" style="gap:12px"><div style="grid-column:span 2"><label class="l">Prénom</label><input class="field" data-cfg="name" value="${esc(c.name)}"></div>
    ${n('goalWeight', 'Poids objectif (kg)', '0.1')}${n('startWeight', 'Poids de départ (kg)', '0.1', 'auto')}${n('height', 'Taille (cm)')}${n('kcalGoal', 'Objectif calories / jour')}${n('waterGoal', 'Verres d’eau / jour')}${n('sportTarget', 'Séances / semaine')}${n('workTarget', 'Jours de travail / mois')}${n('dayRate', 'Tarif journalier (€)', '0.01')}</div></div>
  <div class="card c6"><h3>Apparence</h3><label class="l">Couleur (synchronisée)</label><div class="swatches">${Object.entries(ACCENTS).map(([k, v]) => `<button class="${c.accent === k ? 'on' : ''}" style="background:rgb(${v})" data-act="accent" data-v="${k}" aria-label="${k}"></button>`).join('')}</div>
    <label class="l" style="margin-top:18px">Thème (cet appareil)</label><div class="seg">${[['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, l]) => `<button class="${th === k ? 'on' : ''}" data-act="theme" data-v="${k}">${l}</button>`).join('')}</div>
    <h3 style="margin-top:24px">Synchronisation</h3><p class="sub" data-sync>${syncHtml()}</p><p class="sub">Tout ce que tu saisis est enregistré sur ton appareil puis envoyé au serveur ; tes autres appareils se mettent à jour en direct.</p>
    <div class="row" style="margin-top:10px">${installEvt ? `<button class="btn pri" data-act="install">Installer l’application</button>` : ''}<button class="btn" data-act="export">Exporter (JSON)</button><label class="btn" style="cursor:pointer">Importer<input type="file" accept="application/json" id="imp" hidden></label><button class="btn danger" data-act="logout">Se déconnecter</button></div></div></div>`;
}

const VIEWS = { home: vHome, today: vToday, weight: vWeight, sport: vSport, food: vFood, work: vWork, credit: vCredit, settings: vSettings };

/* ============================== rendu ============================== */
function vLogin(initialized, err = '') {
  return `<div class="login"><form class="card" data-form="login"><div class="brand"><b>${ic('logo')}</b>Ma Vie</div>
  <p>Connecte-toi pour ouvrir ton dashboard.</p>
  <input class="field" type="email" name="email" placeholder="Email" autocomplete="email" required style="margin-bottom:8px">
  <input class="field" type="password" name="password" placeholder="Mot de passe (6 car. min.)" autocomplete="current-password" required minlength="6">
  <button class="btn pri" style="width:100%;justify-content:center;margin-top:12px">Se connecter</button>
  <button type="button" class="btn ghost sm" style="margin-top:6px" data-act="signup">Créer le compte</button><div class="err">${esc(err)}</div></form></div>`;
}
async function renderLogin(err) { $('#app').innerHTML = vLogin(true, err); }
let renderQ = false;
function render(local = false) {
  applyTheme();
  if (!S.token) { renderLogin(); return; }
  if (!local) { const a = document.activeElement; if (a && a.matches('input,textarea,select') && $('#app').contains(a)) { ui.dirty = true; return; } }
  if (renderQ) return; renderQ = true;
  requestAnimationFrame(() => {
    renderQ = false; ui.dirty = false;
    const y = window.scrollY;
    const nav = TABS.map(([k, l]) => `<a data-act="go" data-to="${k}" class="${ui.tab === k ? 'on' : ''}">${ic(k)}<span>${l}</span></a>`).join('');
    $('#app').innerHTML = `<div class="shell"><aside class="side"><div class="brand"><b>${ic('logo')}</b>Ma Vie</div><nav class="nav">${nav}</nav><div class="grow"></div>
      <a class="nav" style="display:flex"><button class="btn ghost" data-act="palette" style="width:100%;justify-content:space-between">${ic('search')}Rechercher<span class="kbd">⌘K</span></button></a><div class="sync" data-sync>${syncHtml()}</div></aside>
      <main>${VIEWS[ui.tab]()}</main></div><nav class="bottom">${nav}</nav>`;
    $('#app').classList.toggle('still', !ui.anim); ui.anim = false;
    window.scrollTo(0, y); hydrate();
  });
}
document.addEventListener('focusout', () => setTimeout(() => { if (ui.dirty && !document.activeElement?.matches?.('input,textarea,select')) render(true); }, 50));

/* ============================== interactions ============================== */
const numv = el => { const v = el.value.trim().replace(',', '.'); return v === '' ? null : Number(v); };
const setDay = patch => put('day:' + ui.date, patch);
const ACTS = {
  go: el => go(el.dataset.to),
  goday: el => { ui.date = el.dataset.d; go('today'); },
  dday: el => { ui.date = addDays(ui.date, Number(el.dataset.n)); render(true); },
  dtoday: () => { ui.date = today(); render(true); },
  range: el => { ui.range = Number(el.dataset.r); render(true); },
  month: el => { ui.month = el.dataset.m; render(true); },
  set: el => { const k = el.dataset.k, cur = day(ui.date)[k]; let v = el.hasAttribute('data-num') ? Number(el.dataset.v) : el.dataset.v; if (cur === v && k !== 'work') v = undefined; setDay({ [k]: v }); },
  'set-today': el => { put('day:' + today(), { [el.dataset.k]: el.dataset.v }); toast('Enregistré ✓'); },
  'water-today': () => { put('day:' + today(), { water: (day(today()).water || 0) + 1 }); toast('💧 +1 verre'); },
  water: el => setDay({ water: Math.max(0, (day(ui.date).water || 0) + Number(el.dataset.n)) }),
  delmeal: el => setDay({ meals: (day(ui.date).meals || []).filter(m => m.id !== el.dataset.id) }),
  quickmeal: el => setDay({ meals: [...(day(ui.date).meals || []), { id: uid(), name: el.dataset.name, kcal: Number(el.dataset.kcal) || 0, slot: el.dataset.slot }] }),
  delweight: el => put('day:' + el.dataset.d, { weight: null }),
  calcycle: el => { const d = el.dataset.d, order = [undefined, 'work', 'off', 'leave'], cur = day(d).work; put('day:' + d, { work: order[(order.indexOf(cur) + 1) % 4] }); },
  addpay: () => payModal(),
  delpay: el => { if (confirm('Supprimer ce versement ?')) put('pay:' + el.dataset.id, { del: true }); },
  accent: el => { put('cfg', { accent: el.dataset.v }); },
  theme: el => { LS.set('ld_theme', el.dataset.v); render(true); },
  install: async () => { if (installEvt) { installEvt.prompt(); installEvt = null; render(true); } },
  export: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S.docs, null, 1)], { type: 'application/json' })); a.download = `ma-vie-${today()}.json`; a.click(); },
  signup: () => { const f = $('form[data-form=login]'); if (f.reportValidity()) auth(Object.fromEntries(new FormData(f)), true); },
  logout: async () => { try { await sb.auth.signOut(); } catch { /* */ } S.docs = {}; S.pending = {}; S.seq = 0; persist(); localLogout(); },
  palette: () => palette()
};
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && ACTS[el.dataset.act]) { e.preventDefault(); ACTS[el.dataset.act](el); } });
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'imp') { importFile(el.files[0]); return; }
  const conv = () => el.hasAttribute('data-num') ? numv(el) : (el.value === '' ? null : el.value);
  if (el.dataset.day) setDay({ [el.dataset.day]: conv() });
  else if (el.dataset.cfg) put('cfg', { [el.dataset.cfg]: conv() });
  else if (el.dataset.cr) put('credit', { [el.dataset.cr]: conv() });
});
document.addEventListener('submit', async e => {
  const f = e.target; if (!f.dataset.form) return; e.preventDefault();
  const fd = Object.fromEntries(new FormData(f));
  if (f.dataset.form === 'meal') {
    let kcal = Number(fd.kcal) || 0;
    if (!kcal) {
      const btn = $('[data-ai]', f); btn.disabled = true; btn.textContent = '✨ Estimation…';
      try { kcal = await estimate(fd.name); toast(`✨ ≈ ${kcal} kcal`); } catch (err) { toast(err.message || 'Estimation indisponible'); }
    }
    setDay({ meals: [...(day(ui.date).meals || []), { id: uid(), name: fd.name.trim(), kcal, slot: fd.slot }] });
  } else if (f.dataset.form === 'login') {
    await auth(fd, false);
  } else if (f.dataset.form === 'pay') {
    if (!fd.amount || Number(fd.amount) <= 0) return;
    put('pay:' + uid(), { date: fd.date || today(), amount: Number(fd.amount), note: fd.note || null }); closeModal(); toast('Remboursement ajouté ✓');
  }
});
async function estimate(text) {
  const { data } = await sb.auth.getSession();
  const r = await fetch('/api/kcal', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data.session?.access_token || '') }, body: JSON.stringify({ text }) }).catch(() => null);
  if (!r) throw new Error('Hors-ligne : kcal à saisir à la main');
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Estimation indisponible');
  return j.total;
}
async function auth(fd, signup) {
  const creds = { email: fd.email, password: fd.password };
  const { data, error } = signup ? await sb.auth.signUp(creds) : await sb.auth.signInWithPassword(creds);
  if (error) return renderLogin(error.message);
  if (!data.session) return renderLogin('Compte créé : confirme ton email puis reconnecte-toi.');
  S.token = true; LS.set('ld_token', true); ui.anim = true; render(true); connect(); pull(); flush();
}
async function importFile(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text()); let n = 0;
    for (const id in data) { const patch = {}; for (const k in data[id]) { patch[k] = data[id][k]?.v ?? null; n++; } put(id, patch); }
    toast(`${n} valeurs importées`);
  } catch { toast('Fichier invalide'); }
}

/* modales + palette de commandes ⌘K */
function openModal(html, cls = '') {
  closeModal();
  const o = document.createElement('div'); o.className = 'overlay'; o.id = 'ov';
  o.innerHTML = `<div class="modal ${cls}">${html}</div>`;
  o.addEventListener('mousedown', e => { if (e.target === o) closeModal(); });
  document.body.appendChild(o); return o;
}
const closeModal = () => $('#ov')?.remove();
function payModal() {
  const o = openModal(`<form data-form="pay"><h2 style="margin-bottom:14px">Nouveau remboursement</h2><div class="f2"><div><label class="l">Date</label><input class="field" type="date" name="date" value="${today()}"></div><div><label class="l">Montant (€)</label><input class="field" type="number" step="0.01" name="amount" inputmode="decimal" value="${credit().monthly || ''}" required></div></div>
  <label class="l" style="margin-top:12px">Note</label><input class="field" name="note" placeholder="optionnel"><div class="row" style="margin-top:16px;justify-content:flex-end"><button type="button" class="btn" onclick="document.getElementById('ov').remove()">Annuler</button><button class="btn pri">Ajouter</button></div></form>`);
  $('input[name=amount]', o).focus();
}
function palette() {
  const cmds = [
    ...TABS.map(([k, l]) => ({ l: 'Aller à ' + l, h: 'navigation', f: () => go(k), i: k })),
    { l: 'Sport fait aujourd’hui', h: 'action', i: 'sport', f: () => ACTS['set-today']({ dataset: { k: 'sport', v: 'done' } }) },
    { l: 'J’ai travaillé aujourd’hui', h: 'action', i: 'work', f: () => ACTS['set-today']({ dataset: { k: 'work', v: 'work' } }) },
    { l: 'Ajouter un verre d’eau', h: 'action', i: 'today', f: () => ACTS['water-today']() },
    { l: 'Entrer mon poids', h: 'action', i: 'weight', f: () => { ui.date = today(); go('weight'); setTimeout(() => $('[data-day=weight]')?.focus(), 150); } },
    { l: 'Ajouter un remboursement', h: 'action', i: 'credit', f: payModal },
    { l: 'Thème clair / sombre', h: 'action', i: 'settings', f: () => { LS.set('ld_theme', document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'); render(true); } },
    { l: 'Exporter mes données', h: 'action', i: 'settings', f: ACTS.export }
  ];
  const o = openModal(`<input placeholder="Que veux-tu faire ?" id="pq" autocomplete="off"><div id="pl"></div>`, 'pal');
  const q = $('#pq', o), list = $('#pl', o); let sel = 0, cur = cmds;
  const draw = () => { list.innerHTML = cur.map((c, i) => `<div class="opt ${i === sel ? 'on' : ''}" data-i="${i}">${ic(c.i)}<span>${c.l}</span><span>${c.h}</span></div>`).join('') || '<div class="empty">Aucun résultat</div>'; };
  const run = i => { const c = cur[i]; if (c) { closeModal(); c.f(); } };
  q.addEventListener('input', () => { const s = q.value.toLowerCase(); cur = cmds.filter(c => c.l.toLowerCase().includes(s)); sel = 0; draw(); });
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { sel = (sel + 1) % cur.length; draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = (sel - 1 + cur.length) % cur.length; draw(); e.preventDefault(); }
    else if (e.key === 'Enter') run(sel);
  });
  list.addEventListener('click', e => { const el = e.target.closest('.opt'); if (el) run(Number(el.dataset.i)); });
  draw(); q.focus();
}
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && S.token) { e.preventDefault(); $('#ov') ? closeModal() : palette(); }
  else if (e.key === 'Escape') closeModal();
});

/* info-bulle des graphiques */
document.addEventListener('pointermove', e => {
  const cw = e.target.closest?.('.cw'); $$('.tip').forEach(t => t.remove());
  if (!cw) return;
  const svg = $('svg', cw), c = charts[svg.dataset.id]; if (!c || c.spark) return;
  const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * c.W;
  let best = 0, bd = 1e9; c.xs.forEach((px, i) => { const d = Math.abs(px - x); if (d < bd) { bd = d; best = i; } });
  const tip = document.createElement('div'); tip.className = 'tip';
  tip.textContent = `${c.labels[best]} · ${fmt(c.f[best], c.dec)}${c.unit}`;
  tip.style.left = (c.xs[best] / c.W * r.width) + 'px'; tip.style.top = (c.pts[best] / c.H * r.height) + 'px';
  cw.appendChild(tip);
});
document.addEventListener('pointerleave', () => $$('.tip').forEach(t => t.remove()), true);

/* ============================== démarrage ============================== */
const style = document.createElement('style'); style.textContent = '@keyframes grow{from{transform:scaleY(0)}}'; document.head.appendChild(style);
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => render(true));
window.addEventListener('hashchange', () => { const t = location.hash.slice(2); if (TABS.some(x => x[0] === t) && t !== ui.tab) { ui.tab = t; render(true); } });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { });
render(true);
sb.auth.getSession().then(({ data }) => { if (data.session) { if (!S.token) { S.token = true; LS.set('ld_token', true); render(true); } connect(); pull(); flush(); } else if (S.token && navigator.onLine) localLogout(); });
window.__life = { S, put, val, ui, go }; // utile pour les tests
})();
