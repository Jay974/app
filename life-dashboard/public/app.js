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
  budget: '<path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM3 7l2-3h12M16 13.5h2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  report: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 17v-3M12 17v-6M15 17v-4"/>',
  billing: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  l: '<path d="M15 6l-6 6 6 6"/>', r: '<path d="M9 6l6 6-6 6"/>', logo: '<circle cx="12" cy="12" r="7"/><path d="M12 5a7 7 0 0 1 7 7"/>'
};
ICONS.reminders = ICONS.bell;
const ic = (n, c = 'ic') => `<svg class="${c}" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;
const TABS = [['home', 'Dashboard'], ['today', 'Aujourd’hui'], ['weight', 'Poids'], ['sport', 'Sport'], ['food', 'Repas'], ['work', 'Travail'], ['credit', 'Crédit'], ['budget', 'Budget'], ['reminders', 'Rappels'], ['billing', 'Facturation'], ['report', 'Rapports'], ['settings', 'Réglages']];
const ACCENTS = { Jade: '0,168,150', Corail: '255,90,79', Violet: '139,92,246', Océan: '56,189,248', Menthe: '45,212,160', Ambre: '245,158,11', Rose: '244,114,182' };
const SPORTS = ['Muscu', 'Cardio', 'Course', 'Marche', 'Vélo', 'Natation', 'Yoga', 'Autre'];
const SLOTS = ['Petit-déj', 'Déjeuner', 'Dîner', 'Collation'];
const MOODS = ['😞', '😕', '😐', '🙂', '😄'];

/* ============================== store + sync ============================== */
// Chaque document est { champ: {v, t} } : la fusion se fait champ par champ, le plus récent gagne.
const S = { docs: LS.get('ld_docs', {}), pending: LS.get('ld_pending', {}), seq: LS.get('ld_seq', 0), token: LS.get('ld_token', null), offset: LS.get('ld_off', 0) };
let status = 'busy', lastErr = ''; // ok | off | busy
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
  } catch (e) { setStatus('off', e); }
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
  } catch (e) { setStatus('off', e); }
}
function connect() {
  if (!S.token) return;
  if (chan) sb.removeChannel(chan);
  chan = sb.channel('fields-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'fields' }, () => pull())
    .subscribe(st => { if (st === 'SUBSCRIBED') { setStatus('ok'); flush(); pull(); }  }); // si le temps réel échoue, la synchro continue par interrogation régulière (ci-dessous)
}
function setStatus(s, err) {
  const msg = s === 'ok' ? '' : (err && (err.message || err.details || String(err))) || lastErr;
  if (status === s && msg === lastErr) return;
  status = s; lastErr = msg;
  $$('[data-sync]').forEach(el => { el.innerHTML = syncHtml(); });
}
const syncHtml = () => `<i class="dot ${status === 'ok' ? 'ok' : status === 'off' ? 'off' : ''}"></i>${status === 'ok' ? (Object.keys(S.pending).length ? 'Envoi…' : 'Synchronisé') : status === 'busy' ? 'Synchronisation…' : (navigator.onLine ? 'Erreur de synchro' + (lastErr ? ' : ' + esc(lastErr) : '') : 'Hors-ligne — sera synchronisé')}`;
window.addEventListener('online', () => { flush(); pull(); connect(); });
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && S.token) localLogout(); });
window.addEventListener('offline', () => setStatus('off'));
setInterval(() => { if (S.token && !document.hidden) { pull(); flush(); } }, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { pull(); flush(); } });

function localLogout() {
  if (chan) sb.removeChannel(chan);
  S.token = null; LS.del('ld_token'); LS.del('ld_owner'); ui.owner = false;
  render();
}

/* ============================== domaine ============================== */
const DEF = { goalWeight: null, startWeight: null, height: null, kcalGoal: 2200, burnShare: 50, goalType: null, sex: null, age: null, activity: '1.375', pace: 'mid', kcalMode: 'auto', waterGoal: 8, waterGoalL: null, sportTarget: 3, weekHours: null, netSalary: null, salaryMode: 'fixed', name: '', accent: 'Jade', income: null, expenses: null, savings: null, budgets: null, protGoal: null, carbGoal: null, fatGoal: null };
const cfg = () => { const c = { ...DEF, ...val('cfg') }; if (c.netSalary == null && c.income != null) c.netSalary = c.income; return c; };
const goalBonus = (d, c = cfg()) => Math.round((c.burnShare ?? 50) / 100 * burned(d)); // part des kcal brûlées ajoutée à l'objectif du jour
const GOALS = {
  cut: { t: 'Perte de poids', i: '📉', want: 'deficit', d: 'Perdre du gras en gardant le muscle' },
  bulk: { t: 'Prise de muscle', i: '💪', want: 'surplus', d: 'Prise de masse propre, léger surplus' },
  recomp: { t: 'Recomposition', i: '🔄', want: 'balance', d: 'Perdre du gras et gagner du muscle' },
  maintain: { t: 'Équilibre', i: '⚖️', want: 'balance', d: 'Garder son poids et sa forme' },
  gain: { t: 'Prise de poids', i: '📈', want: 'surplus', d: 'Prendre du poids (muscle et réserves)' }
};
const ACTIVITY = [['1.2', 'Peu actif (bureau, peu de marche)'], ['1.375', 'Actif (debout, marche régulière)'], ['1.55', 'Très actif (travail physique)']]; // hors séances de sport (comptées à part)
const meanA = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
function plan(c = cfg()) { // besoins estimés (Mifflin-St Jeor) + cible calorique et macros selon l'objectif
  const w = [...weights()].pop()?.w ?? c.startWeight;
  if (!c.goalType || !GOALS[c.goalType] || !w || !c.height || !c.age || !c.sex) return null;
  const bmr = 10 * w + 6.25 * c.height - 5 * c.age + (c.sex === 'f' ? -161 : 5), tdee = bmr * (Number(c.activity) || 1.375), pace = c.pace || 'mid';
  const adj = { cut: -{ soft: .15, mid: .2, fast: .25 }[pace], bulk: { soft: .05, mid: .1, fast: .15 }[pace], gain: { soft: .1, mid: .15, fast: .2 }[pace], recomp: -.05, maintain: 0 }[c.goalType] * tdee;
  const floor = c.sex === 'f' ? 1200 : 1500, target = Math.round(Math.max(tdee + adj, floor) / 10) * 10;
  const [pk, fk] = { cut: [2.1, .8], bulk: [1.8, 1], recomp: [2.2, .9], maintain: [1.6, .9], gain: [1.6, 1] }[c.goalType];
  const p = Math.round(pk * w), f = Math.max(Math.round(fk * w), Math.round(target * .2 / 9));
  return { w, bmr: Math.round(bmr), tdee: Math.round(tdee), target, p, f, c: Math.max(0, Math.round((target - p * 4 - f * 9) / 4)), kgWeek: (target - tdee) * 7 / 7700, floorHit: tdee + adj < floor, want: GOALS[c.goalType].want };
}
const kcalBase = (c = cfg()) => { if (c.goalType && c.kcalMode !== 'manual') { const pl = plan(c); if (pl) return pl.target; } return c.kcalGoal; };
const goalKcal = (d, c = cfg()) => kcalBase(c) + goalBonus(d, c);
function macroGoals(d) { // objectifs perso, sinon calculés : prot 1,8 g/kg, lipides 30 % des kcal, glucides = le reste
  const c = cfg(), w = weights().slice(-1)[0]?.w;
  const k = d ? goalKcal(d, c) : kcalBase(c), pl = plan(c);
  const p = c.protGoal ?? (pl ? pl.p : w ? Math.round(1.8 * w) : Math.round(k * .25 / 4));
  const f = c.fatGoal ?? (pl ? pl.f : Math.round(k * .30 / 9));
  return { p, f, c: c.carbGoal ?? Math.max(0, Math.round((k - p * 4 - f * 9) / 4)) };
}
const macrosOf = d => (day(d).meals || []).reduce((a, m) => ({ p: a.p + (Number(m.p) || 0), c: a.c + (Number(m.c) || 0), f: a.f + (Number(m.f) || 0), missing: a.missing + (m.p == null ? 1 : 0) }), { p: 0, c: 0, f: 0, missing: 0 });
function macroBars(d) {
  const m = macrosOf(d), g = macroGoals(d);
  const rows = [['Protéines', 'p', 'var(--acc)'], ['Glucides', 'c', '#38bdf8'], ['Lipides', 'f', '#fbbf24']];
  return `<div class="list" style="gap:10px;margin-bottom:14px">${rows.map(([l, k, col]) => { const v = m[k], goal = g[k], r = goal ? v / goal : 0, diff = Math.round(goal - v);
    return `<div><div class="row" style="justify-content:space-between;font-size:13px"><span>${l}</span><span><b>${fmt(v, 0)}</b> / ${goal} g ${r > 1.15 ? `<span class="chip down">+${-diff} g</span>` : diff > 0 ? `<span class="chip">reste ${diff} g</span>` : '<span class="chip up">✓ atteint</span>'}</span></div><div class="bar" style="height:8px"><i style="width:${Math.min(r * 100, 100)}%;background:${col}"></i></div></div>`; }).join('')}${m.missing ? `<button class="btn sm" data-act="fillmacros">✨ Calculer les macros de ${m.missing} repas</button>` : ''}</div>`;
}
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };
const spanH = (s, e, b) => { const a = toMin(s); let z = toMin(e); if (a == null || z == null) return null; if (z <= a) z += 1440; return Math.max(0, (z - a - (Number(b) || 0)) / 60); }; // gère le travail de nuit
const tpl = (c, d) => c.sched?.[(parse(d).getDay() + 6) % 7];
const weeklyHours = c => c.weekHours ?? (c.sched ? (Object.values(c.sched).reduce((a, x) => a + (spanH(x.s, x.e, x.b) || 0), 0) || null) : null);
const salaryDoc = m => val('sal:' + m).amount;
function salaryFor(m, c = cfg()) { // fixe : valeur unique ; variable : valeur du mois, sinon dernier mois renseigné, sinon valeur par défaut
  if (c.salaryMode !== 'monthly') return c.netSalary ?? null;
  const own = salaryDoc(m); if (own != null) return own;
  const prev = ids('sal:').map(k => k.slice(4)).filter(k => k < m && salaryDoc(k) != null).sort().pop();
  return prev ? salaryDoc(prev) : (c.netSalary ?? null);
}
const curMonth = () => today().slice(0, 7);
function salaryInput(m) {
  const c = cfg();
  if (c.salaryMode !== 'monthly') return `<p class="sub" style="margin:0">Salaire fixe : <b>${c.netSalary ? eur(c.netSalary) : '–'}</b> · modifiable dans Réglages (ou passe en « variable » pour le saisir chaque mois).</p>`;
  const v = salaryFor(m, c);
  return `<label class="l">Salaire net de ${monthName(m)} (€)</label><input class="field" data-sal="${m}" data-num type="number" inputmode="decimal" placeholder="${v ?? ''}" value="${salaryDoc(m) ?? ''}">${salaryDoc(m) == null && v != null ? `<p class="sub" style="margin:8px 0 0">Non saisi : ${eur(v)} (dernier mois renseigné) est utilisé.</p>` : ''}`;
}
const monthTarget = c => weeklyHours(c) ? weeklyHours(c) * 52 / 12 : null; // heures théoriques / mois
function workedHours(d, c) { // priorité : horaires du jour > heures saisies > horaires types > heures hebdo / 5
  const x = day(d); if (x.work !== 'work') return 0;
  const own = spanH(x.workS, x.workE, x.workB); if (own != null) return own;
  if (x.workH != null) return x.workH;
  const t = tpl(c, d), th = t && spanH(t.s, t.e, t.b); if (th != null) return th;
  return weeklyHours(c) ? weeklyHours(c) / 5 : 0;
}
const credit = () => { // durée fixe : si la mensualité n'est pas saisie, elle se déduit du total / durée
  const c = { name: 'Mon crédit', total: 0, monthly: 0, start: null, rate: null, months: null, ...val('credit') };
  c.monthlyAuto = !c.monthly && c.months > 0 && c.total > 0;
  if (c.monthlyAuto) c.monthly = Math.round(c.total / c.months * 100) / 100;
  return c;
};
const day = d => val('day:' + d);
const r2 = n => Math.round(n * 100) / 100;
const waterOf = d => { const x = day(d); return x.waterL ?? (x.water != null ? x.water * 0.25 : null); }; // anciens « verres » = 0,25 L
const waterGoal = c => c.waterGoalL ?? (c.waterGoal ? c.waterGoal * 0.25 : 2);
const payments = () => ids('pay:').map(id => ({ id: id.slice(4), ...val(id) })).filter(p => !p.del && p.amount != null).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
const dayIds = () => ids('day:').map(k => k.slice(4)).sort();

function weights() { // [{date, w}] triés
  return dayIds().map(d => ({ date: d, w: day(d).weight })).filter(x => typeof x.w === 'number');
}
function score(d) {
  const x = day(d), c = cfg();
  const items = [x.weight != null, !!x.sport, !!x.work, (waterOf(d) || 0) >= waterGoal(c), (x.meals || []).length > 0, x.sleep != null, x.mood != null];
  return items.filter(Boolean).length / items.length;
}
const MET = { Muscu: 5, Cardio: 7, Course: 9.8, Marche: 3.8, Vélo: 7.5, Natation: 7, Yoga: 2.5, Autre: 5 }; // équivalents métaboliques (MET)
function burnedAuto(d) { // kcal = MET × poids (kg) × heures
  const x = day(d); if (x.sport !== 'done' || !x.sportMin) return 0;
  const w = [...weights()].filter(k => k.date <= d).pop()?.w ?? cfg().startWeight ?? 70;
  return Math.round((MET[x.sportType || 'Autre'] || 5) * w * x.sportMin / 60);
}
const burned = d => day(d).sport === 'done' ? (day(d).sportKcal ?? burnedAuto(d)) : 0;
const burnLine = d => `<div style="margin-top:12px"><label class="l">Calories brûlées (auto, modifiable)</label><input class="field" data-day="sportKcal" data-num type="number" inputmode="numeric" placeholder="${burnedAuto(d) || 'auto'}" value="${day(d).sportKcal ?? ''}"></div><div class="sub" style="margin-top:8px" title="Estimation : MET du sport × poids × durée">🔥 ≈ <b>${fmt(burned(d), 0)} kcal</b> brûlées</div>`;
function weekStats(d0) {
  const ws = weekStart(d0); let n = 0, min = 0, kcal = 0;
  for (let i = 0; i < 7; i++) { const x = day(addDays(ws, i)); if (x.sport === 'done') { n++; min += x.sportMin || 0; kcal += burned(addDays(ws, i)); } }
  return { n, min, kcal };
}
function monthDays(m) { // m = 'YYYY-MM'
  const first = parse(m + '-01'), out = [];
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  for (let i = 1; i <= last; i++) out.push(`${m}-${pad(i)}`);
  return out;
}
const kcalOf = d => (day(d).meals || []).reduce((s, m) => s + (Number(m.kcal) || 0), 0);
function creditStats() {
  const c = credit(), all = payments(), t = today();
  const pays = all.filter(p => p.date <= t), planned = all.filter(p => p.date > t).sort((a, b) => a.date.localeCompare(b.date));
  const paid = pays.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(c.total - paid, 0);
  const pct = c.total > 0 ? Math.min(paid / c.total, 1) : 0;
  let monthsLeft = c.monthly > 0 ? Math.ceil(remaining / c.monthly) : null, end = null, fixed = false, elapsed = null;
  if (c.months > 0 && c.start) { // durée fixe : fin = début + durée
    fixed = true; const s0 = parse(c.start), n = new Date();
    elapsed = Math.max(0, (n.getFullYear() - s0.getFullYear()) * 12 + n.getMonth() - s0.getMonth() - (n.getDate() < s0.getDate() ? 1 : 0));
    monthsLeft = Math.max(0, Number(c.months) - elapsed); end = new Date(s0); end.setMonth(end.getMonth() + Number(c.months));
  } else if (monthsLeft != null) { const d = new Date(); d.setMonth(d.getMonth() + monthsLeft); end = d; }
  return { c, pays, planned, paid, remaining, pct, monthsLeft, end, fixed, elapsed };
}

const frDate = d => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
function weightForecast() {
  const c = cfg(), t = today(), ws = weights().filter(w => diffDays(w.date, t) <= 45);
  if (ws.length < 3 || diffDays(ws[0].date, ws[ws.length - 1].date) < 7) return { ok: false, msg: 'Entre au moins 3 pesées sur 7 jours pour obtenir une prévision.' };
  const xs = ws.map(w => diffDays(ws[0].date, w.date)), ys = ws.map(w => w.w), n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const last = ws[n - 1], perWeek = slope * 7;
  let eta = null, msg;
  if (c.goalWeight == null) msg = 'Définis un poids objectif dans Réglages pour voir ta date d’arrivée.';
  else {
    const diff = c.goalWeight - last.w;
    if (Math.abs(diff) < 0.2) msg = 'Objectif atteint 🎉';
    else if (slope * diff > 0 && Math.abs(perWeek) >= 0.03) { eta = addDays(last.date, Math.ceil(diff / slope)); msg = `À ce rythme, tu atteins ${fmt(c.goalWeight)} kg vers ${frDate(parse(eta))}.`; }
    else msg = 'À ce rythme, tu ne te rapproches pas de ton objectif.';
  }
  return { ok: true, perWeek, eta, msg };
}
function creditScenarios() {
  const s = creditStats(); if (!(s.c.monthly > 0) || !(s.remaining > 0)) return [];
  const base = Math.ceil(s.remaining / s.c.monthly);
  return [0, 50, 100, 200].map(e => { const m = Math.ceil(s.remaining / (s.c.monthly + e)), d = new Date(); d.setMonth(d.getMonth() + m); return { extra: e, months: m, end: d, saved: base - m }; });
}
function coachData(mode) {
  const c = cfg(), t = today(), cr = creditStats();
  if (mode === 'week') {
    const days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13)).map(d => { const x = day(d); return { date: d, poids: x.weight, sport: x.sport, sportType: x.sportType, minutes: x.sportMin, travail: x.work, kcal: kcalOf(d) || undefined, eauLitres: waterOf(d), sommeil: x.sleep, humeur: x.mood, kcalBrulees: burned(d) || undefined }; });
    const f = weightForecast();
    return { jours: days, objectifs: { poidsCible: c.goalWeight, kcal: kcalBase(c), objectif: profileData(), eauLitres: waterGoal(c), seancesParSemaine: c.sportTarget, tailleCm: c.height }, tendancePoidsKgParSemaine: f.ok ? Number(f.perWeek.toFixed(2)) : null };
  }
  if (mode === 'nutrition') {
    const g = macroGoals(), days = Array.from({ length: 7 }, (_, i) => addDays(t, -i)).map(d => { const m = macrosOf(d); return { date: d, kcal: kcalOf(d), objectifKcalDuJour: goalKcal(d), kcalBruleesSport: burned(d), proteinesG: Math.round(m.p), glucidesG: Math.round(m.c), lipidesG: Math.round(m.f), repas: (day(d).meals || []).map(x => x.name) }; });
    const f = weightForecast();
    return { aujourdhui: days[0], sept_derniers_jours: days, objectif: profileData(), objectifs: { kcalDeBase: kcalBase(c), partKcalSportAjouteeAuObjectifPct: c.burnShare ?? 50, proteinesG: g.p, glucidesG: g.c, lipidesG: g.f }, poidsActuel: weights().slice(-1)[0]?.w, poidsCible: c.goalWeight, tendancePoidsKgParSemaine: f.ok ? Number(f.perWeek.toFixed(2)) : null, seancesSportSemaine: weekStats(t).n };
  }
  if (mode === 'report' && ui.repMode === 'day') { const r = dailyReport(ui.repDay || today()); return { jour: r.d, scorePct: r.score, objectif: profileData(), reussites: r.items.filter(i => i.state === 'ok').map(i => ({ indicateur: i.label, valeur: i.value })), aAmeliorer: r.items.filter(i => i.state === 'bad').map(i => ({ indicateur: i.label, valeur: i.value })) }; }
  if (mode === 'report') { const r = weeklyReport(ui.repWeek || lastWeek()); return { semaineDu: r.w, scorePct: r.score, objectif: profileData(), reussites: r.items.filter(i => i.state === 'ok').map(i => ({ indicateur: i.label, valeur: i.value })), aAmeliorer: r.items.filter(i => i.state === 'bad').map(i => ({ indicateur: i.label, valeur: i.value })) }; }
  if (mode === 'budget') {
    const m = ui.bmonth, b = budgetStats(m), pm = (() => { const d = parse(m + '-01'); d.setMonth(d.getMonth() - 1); return budgetStats(ymd(d).slice(0, 7)); })();
    return { mois: m, revenuNetMensuel: salaryFor(m, c), revenusSupplementaires: [...b.rec.map(r => ({ nom: r.name, montant: r.amount, recurrent: true })), ...b.inc.map(t => ({ nom: t.note, montant: t.amount, date: t.date }))], revenusDuMois: b.income, mensualiteCredit: b.creditM, depensesDuMois: Math.round(b.spent), soldeRestant: Math.round(b.left), joursEcoules: b.elapsed, joursDuMois: b.dim, projectionDepensesFinDeMois: b.proj && Math.round(b.proj), depensesParCategorie: Object.entries(b.byCat).map(([cat, v]) => ({ cat, depense: Math.round(v), limite: b.bud[cat] || null })), limitesSansDepense: CATS.filter(([n]) => b.bud[n] && !b.byCat[n]).map(x => x[0]), moisPrecedent: { depenses: Math.round(pm.spent), parCategorie: pm.byCat }, epargneDisponible: c.savings, depensesFixesDeclarees: c.expenses };
  }
  const ms = monthDays(t.slice(0, 7)), worked = ms.filter(d => day(d).work === 'work').length;
  return { credit: { nom: cr.c.name, total: cr.c.total, mensualite: cr.c.monthly, tauxAnnuelPct: cr.c.rate, rembourse: cr.paid, reste: cr.remaining, mensualitesRestantes: cr.monthsLeft, dureeTotaleMois: cr.c.months, finPrevue: cr.end && cr.end.toISOString().slice(0, 10), debut: cr.c.start, derniersVersements: cr.pays.slice(0, 6).map(p => ({ date: p.date, montant: p.amount })) }, salaireNetMensuel: salaryFor(t.slice(0, 7), c), heuresHebdo: weeklyHours(c), emploiDuTemps: c.sched || null, heuresTravailleesCeMois: Math.round(ms.reduce((a, d) => a + workedHours(d, c), 0)), objectifHeuresMois: monthTarget(c) && Math.round(monthTarget(c)), tauxHoraireNet: salaryFor(t.slice(0, 7), c) && monthTarget(c) ? Number((salaryFor(t.slice(0, 7), c) / monthTarget(c)).toFixed(2)) : null, partMensualiteSurSalairePct: salaryFor(t.slice(0, 7), c) && cr.c.monthly ? Number((cr.c.monthly / salaryFor(t.slice(0, 7), c) * 100).toFixed(1)) : null, depensesMensuelles: c.expenses, epargne: c.savings, joursTravaillesCeMois: worked };
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
    const line = $('.line', svg), area = $('.area', svg), dots = $$('circle[data-i]', svg), t0 = performance.now() + (prev ? 0 : 280), dur = 800; // 1ère apparition : attend la fin de l'entrée des cartes
    const step = now => {
      if (!svg.isConnected) return;
      const k = Math.max(0, Math.min((now - t0) / dur, 1)), e = 1 - Math.pow(1 - k, 4);
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
const ui = { owner: LS.get('ld_owner', false), bmonth: today().slice(0, 7), tab: (location.hash.slice(2) || 'home'), date: today(), range: 30, month: today().slice(0, 7), dirty: false, anim: true };
if (!TABS.some(t => t[0] === ui.tab)) ui.tab = 'home';
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
const theme = () => cfg().theme === 'light' ? 'light' : 'dark'; // sombre par défaut ; seul le réglage synchronisé compte
function applyTheme() {
  const c = cfg(), t = theme();
  const light = t === 'light' || (t === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark'; LS.set('ld_theme_applied', light ? 'light' : 'dark');
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
function go(tab, keep) { if (tab === 'reminders') refreshPush(); if (!keep) ui.date = today(); ui.anim = true; ui.tab = tab; history.replaceState(null, '', '#/' + tab); render(true); window.scrollTo(0, 0); }

/* ============================== vues ============================== */
const head = (title, sub, right = '') => `<div class="top"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="row">${right}<span class="chip" data-sync>${syncHtml()}</span></div></div>`;
const dateBar = () => `<div class="datebar"><button data-act="dday" data-n="-1" aria-label="Jour précédent">${ic('l')}</button><span class="d">${ui.date === today() ? 'Aujourd’hui' : longDate(ui.date)}</span><button data-act="dday" data-n="1" aria-label="Jour suivant">${ic('r')}</button>${ui.date !== today() ? '<button data-act="dtoday" style="width:auto;padding:0 12px;font-weight:600">Auj.</button>' : ''}</div>`;
const greet = () => { const h = new Date().getHours(), n = cfg().name; return `${h < 5 || h >= 18 ? 'Bonsoir' : h < 12 ? 'Bonjour' : 'Bon après-midi'}${n ? ', ' + esc(n) : ''}`; };

function mealsCard(d) {
  const x = day(d), meals = x.meals || [], c = cfg(), tot = kcalOf(d);
  const freq = {}; dayIds().forEach(k => (day(k).meals || []).forEach(m => { const f = freq[m.name.toLowerCase()] = freq[m.name.toLowerCase()] || { n: 0, name: m.name, kcal: m.kcal, slot: m.slot }; f.n++; f.kcal = m.kcal; f.p = m.p; f.c = m.c; f.f = m.f; }));
  const top = Object.values(freq).sort((a, b) => b.n - a.n).slice(0, 6);
  return `<div class="card c6"><h3>${ic('food')}Repas · ${fmt(tot, 0)} / ${fmt(goalKcal(d, c), 0)} kcal${goalBonus(d, c) ? ` (🔥 +${goalBonus(d, c)})` : ''}</h3>
  <div class="bar" style="margin-bottom:12px"><i style="width:${Math.min(tot / goalKcal(d, c) * 100, 100)}%"></i></div>${meals.length ? macroBars(d) : ''}
  <div class="list">${meals.length ? meals.map(m => `<div class="item"><div class="grow"><div class="t">${esc(m.name)}</div><div class="s">${esc(m.slot)}${m.kcal ? ' · ' + fmt(m.kcal, 0) + ' kcal' : ''}${m.p != null ? ` · P ${fmt(m.p, 0)} · G ${fmt(m.c, 0)} · L ${fmt(m.f, 0)}` : ''}</div></div><button class="x" data-act="delmeal" data-id="${m.id}" aria-label="Supprimer">${ic('x')}</button></div>`).join('') : '<div class="empty">Rien noté pour ce jour</div>'}</div>
  <form data-form="meal" style="margin-top:12px;display:grid;grid-template-columns:1fr 90px;gap:8px"><input class="field" name="name" placeholder="Ex : 2 œufs, 100 g de riz, 1 pomme" required maxlength="60"><input class="field" name="kcal" type="number" inputmode="numeric" min="0" placeholder="kcal ✨ auto">
  <select class="field" name="slot">${SLOTS.map((s, i) => `<option ${i === defaultSlot() ? 'selected' : ''}>${s}</option>`).join('')}</select><button class="btn pri" style="justify-content:center" data-ai>${ic('plus')}Ajouter</button></form><p class="sub" style="margin:8px 0 0">Laisse « kcal » vide : l’IA estime les calories pour toi ✨</p>
  ${top.length ? `<div class="chips" style="margin-top:12px">${top.map(t => `<button data-act="quickmeal" data-name="${esc(t.name)}" data-kcal="${t.kcal || ''}" data-p="${t.p ?? ''}" data-c="${t.c ?? ''}" data-f="${t.f ?? ''}" data-slot="${esc(t.slot)}">+ ${esc(t.name)}</button>`).join('')}</div>` : ''}</div>`;
}
const defaultSlot = () => { const h = new Date().getHours(); return h < 10 ? 0 : h < 15 ? 1 : h < 17 ? 3 : 2; };

function vToday() {
  const d = ui.date, x = day(d), c = cfg(), sc = score(d);
  const lastW = [...weights()].filter(w => w.date < d).pop();
  return head('Aujourd’hui', longDate(d), dateBar()) + `<div class="grid">
  <div class="card c4 hero" style="display:flex;gap:16px;align-items:center;justify-content:space-between"><div><h3>Journée remplie</h3><div class="big">${Math.round(sc * 100)} <em>%</em></div><p>${sc === 1 ? 'Parfait, tout est noté 🎉' : 'Coche tout ce que tu as fait.'}</p></div>${ring('today-' + d, sc, Math.round(sc * 100) + '%', { size: 112 })}</div>
  <div class="card c4"><h3>${ic('weight')}Poids</h3><div class="big-in"><input data-day="weight" data-num type="number" step="0.1" inputmode="decimal" placeholder="--,-" value="${x.weight ?? ''}"><span>kg</span></div>
    <div class="seg" style="margin-top:10px">${[['fasting', 'À jeun'], ['normal', 'Pas à jeun']].map(([k, l]) => `<button class="${x.wCond === k ? 'on' : ''}" data-act="set" data-k="wCond" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="sub" style="margin-top:8px">${x.weight != null && lastW ? `${x.weight > lastW.w ? '▲' : x.weight < lastW.w ? '▼' : '='} ${fmt(Math.abs(x.weight - lastW.w))} kg vs ${shortDate(lastW.date)}` : lastW ? `Dernier : ${fmt(lastW.w)} kg (${shortDate(lastW.date)})` : 'Entre ton poids du jour'}</div></div>
  <div class="card c4"><h3>${ic('work')}Travail</h3><div class="seg" data-seg="work">${[['work', 'Travaillé'], ['off', 'Repos'], ['leave', 'Congé']].map(([k, l]) => `<button class="${x.work === k ? 'on' : ''}" data-act="set" data-k="work" data-v="${k}">${l}</button>`).join('')}</div>
    ${x.work === 'work' ? (() => { const t = tpl(c, d) || {}; return `<div class="f2" style="margin-top:12px;grid-template-columns:1fr 1fr 1fr"><div><label class="l">Début</label><input class="field" type="time" data-day="workS" value="${x.workS ?? t.s ?? ''}"></div><div><label class="l">Fin</label><input class="field" type="time" data-day="workE" value="${x.workE ?? t.e ?? ''}"></div><div><label class="l">Pause (min)</label><input class="field" data-day="workB" data-num type="number" inputmode="numeric" placeholder="0" value="${x.workB ?? t.b ?? ''}"></div></div><div class="sub" style="margin-top:8px">= <b>${fmt(workedHours(d, c), 2)} h</b> travaillées${tpl(c, d) && x.workS == null ? ' (horaires types)' : ''}</div>`; })() : ''}</div>
  <div class="card c6"><h3>${ic('sport')}Sport</h3><div class="seg">${[['done', '✅ Séance faite'], ['rest', '😴 Repos']].map(([k, l]) => `<button class="${x.sport === k ? 'on' : ''}" data-act="set" data-k="sport" data-v="${k}">${l}</button>`).join('')}</div>
    ${x.sport === 'done' ? `<div class="chips" style="margin-top:12px">${SPORTS.map(s => `<button class="${x.sportType === s ? 'on' : ''}" data-act="set" data-k="sportType" data-v="${s}">${s}</button>`).join('')}</div><div style="margin-top:12px"><label class="l">Durée (minutes)</label><input class="field" data-day="sportMin" data-num type="number" inputmode="numeric" placeholder="45" value="${x.sportMin ?? ''}"></div>${burnLine(d)}` : ''}</div>
  <div class="card c3"><h3>💧 Eau</h3>${(() => { const w = r2(waterOf(d) || 0), g = r2(waterGoal(c)); return `<div class="val">${fmt(w, 2)}<small>/ ${fmt(g, 2)} L</small></div><div class="bar" style="margin:12px 0"><i style="width:${Math.min(w / g * 100, 100)}%;background:#38bdf8"></i></div><div class="chips">${[0.2, 0.3, 0.5, 0.75, 1, 1.5].map(v => `<button data-act="water" data-n="${v}">+${fmt(v, 2)} L</button>`).join('')}</div><div class="row" style="margin-top:12px;flex-wrap:nowrap"><input class="field" data-day="waterL" data-num type="number" step="0.05" min="0" inputmode="decimal" placeholder="Total (L)" value="${w || ''}"><button class="btn sm" data-act="water" data-n="-0.2" aria-label="Retirer 0,2 litre">−0,2</button></div>`; })()}</div>
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
  const waterArr = Array.from({ length: 7 }, (_, i) => waterOf(addDays(t, -i))).filter(v => v != null);
  const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  const x = day(t);
  const todo = [['Poids', x.weight != null], ['Sport', !!x.sport], ['Travail', !!x.work], ['Eau', (waterOf(t) || 0) >= waterGoal(c)], ['Repas', (x.meals || []).length > 0], ['Sommeil', x.sleep != null], ['Humeur', x.mood != null]];
  const heatRows = [['Sport', d => day(d).sport === 'done' ? 'on' : day(d).sport === 'rest' ? 'mid' : ''], ['Travail', d => day(d).work === 'work' ? 'on' : day(d).work ? 'mid' : ''], ['Poids', d => day(d).weight != null ? 'on' : ''], ['Repas', d => kcalOf(d) > 0 ? 'on' : ''], ['Eau', d => (waterOf(d) || 0) >= waterGoal(c) ? 'on' : (waterOf(d) || 0) > 0 ? 'mid' : '']];
  const wdays = Array.from({ length: 7 }, (_, i) => addDays(wkS, i));
  return head(greet(), longDate(t), `<button class="btn pri" data-act="coach" data-m="week">✨ Bilan IA</button><button class="btn" data-act="palette">${ic('search')}<span class="kbd">⌘K</span></button>`) + `<div class="grid">
  ${reportCard()}
  <div class="card c7 hero" style="display:flex;justify-content:space-between;gap:16px;align-items:center"><div><h3>Ta semaine</h3><div class="big">Tu es à <em>${Math.round(avg * 100)} %</em> de suivi cette semaine</div><p>${wk.n}/${c.sportTarget} séances · ${worked} jour${worked > 1 ? 's' : ''} travaillé${worked > 1 ? 's' : ''} ce mois</p><button class="btn" style="background:rgba(255,255,255,.95);color:#0b4a44" data-act="go" data-to="today">Remplir aujourd’hui →</button></div>${ring('week', avg, Math.round(avg * 100) + '%', { size: 138, sw: 13 })}</div>
  <div class="card c5"><h3>${ic('today')}À faire aujourd’hui</h3><div class="chips">${todo.map(([l, ok]) => `<button class="${ok ? 'on' : ''}" data-act="go" data-to="today">${ok ? '✓' : '○'} ${l}</button>`).join('')}</div>
    <div class="row" style="margin-top:14px"><button class="btn pri sm" data-act="set-today" data-k="sport" data-v="done">✅ Sport fait</button><button class="btn sm" data-act="set-today" data-k="work" data-v="work">💼 J’ai travaillé</button><button class="btn sm" data-act="water-today">💧 +0,25 L</button></div></div>
  <div class="card c3 kpis"><h3>${ic('weight')}Poids</h3><div class="val">${fmt(lastW?.w)}<small>kg</small></div><div class="sub">${delta != null ? `<span class="chip ${delta <= 0 ? 'up' : 'down'}">${delta <= 0 ? '▼' : '▲'} ${fmt(Math.abs(delta))} kg / 30 j</span>` : 'Entre ton poids'}</div>${lineChart('sp-w', wy, days30.map(shortDate), { spark: true })}</div>
  <div class="card c3 kpis"><h3>${ic('credit')}Crédit</h3><div class="val">${Math.round(cs.pct * 100)}<small>% remboursé</small></div><div class="sub">${cs.c.total ? `Reste ${eur(cs.remaining)}` : 'À configurer'}</div><div class="bar" style="margin-top:16px"><i style="width:${cs.pct * 100}%"></i></div><div class="sub" style="margin-top:8px">${cs.end ? 'Fin estimée ' + cs.end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : ''}</div></div>
  <div class="card c3 kpis"><h3>${ic('work')}Travail</h3>${(() => { const tg = monthTarget(c), h = ms.reduce((a, d) => a + workedHours(d, c), 0); return tg ? `<div class="val">${fmt(h, 0)}<small>/ ${fmt(tg, 0)} h ce mois</small></div><div class="bar" style="margin-top:16px"><i style="width:${Math.min(h / tg * 100, 100)}%"></i></div><div class="sub" style="margin-top:8px">${salaryFor(curMonth(), c) ? 'Salaire net ' + eur(salaryFor(curMonth(), c)) : worked + ' jours travaillés'}</div>` : `<div class="val">${worked}<small>jour${worked > 1 ? 's' : ''} ce mois</small></div><div class="sub" style="margin-top:16px">Renseigne tes heures hebdo dans Réglages</div>`; })()}</div>
  <div class="card c3 kpis"><h3>${ic('sport')}Sport</h3><div class="val">${wk.n}<small>/ ${c.sportTarget} séances</small></div><div class="bar" style="margin-top:16px"><i style="width:${Math.min(wk.n / c.sportTarget * 100, 100)}%"></i></div><div class="sub" style="margin-top:8px">${wk.min} min · 🔥 ${fmt(wk.kcal, 0)} kcal cette semaine</div></div>
  <div class="card c8"><h3>${ic('weight')}Évolution du poids · 30 jours</h3>${lineChart('home-w', wy, days30.map(shortDate), { goal: c.goalWeight, unit: ' kg', empty: 'Entre ton poids pour voir la courbe bouger 📈' })}</div>
  <div class="card c4"><h3>Moyennes · 7 jours</h3><div class="list"><div class="item"><div class="grow t">🌙 Sommeil</div><b>${fmt(mean(sleepArr))} h</b></div><div class="item"><div class="grow t">🍽️ Calories</div><b>${fmt(mean(kcalArr), 0)} kcal</b></div><div class="item"><div class="grow t">💧 Eau</div><b>${fmt(mean(waterArr), 2)} L</b></div><div class="item"><div class="grow t">😊 Humeur</div><b>${fmt(mean(Array.from({ length: 7 }, (_, i) => day(addDays(t, -i)).mood).filter(v => v != null)))} / 5</b></div></div></div>
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
  <div class="card c12"><h3>🔮 Prévision</h3>${(() => { const f = weightForecast(); return f.ok ? `<div class="val">${f.perWeek > 0 ? '+' : ''}${fmt(f.perWeek, 2)}<small>kg / semaine</small></div><p class="sub">${f.msg}</p>` : `<p class="sub">${f.msg}</p>`; })()}<button class="btn pri sm" data-act="coach" data-m="week">✨ Bilan IA de ma semaine</button></div>
  <div class="card c12"><h3>Historique</h3>${ws.length ? `<table class="table"><tr><th>Date</th><th>Poids</th><th>Écart</th><th></th></tr>${[...ws].reverse().slice(0, 15).map((w, i, a) => { const p = a[i + 1]; const dl = p ? w.w - p.w : null; return `<tr><td>${longDate(w.date)}</td><td><b>${fmt(w.w)} kg</b>${day(w.date).wCond ? ` <span class="chip">${day(w.date).wCond === 'fasting' ? 'à jeun' : 'pas à jeun'}</span>` : ''}</td><td>${dl == null ? '' : `<span class="chip ${dl <= 0 ? 'up' : 'down'}">${dl <= 0 ? '▼' : '▲'} ${fmt(Math.abs(dl))}</span>`}</td><td style="text-align:right"><button class="x" data-act="delweight" data-d="${w.date}" aria-label="Supprimer">${ic('x')}</button></td></tr>`; }).join('')}</table>` : '<div class="empty">Aucune pesée pour l’instant</div>'}</div></div>`;
}

function vSport() {
  const c = cfg(), t = today(), wk = weekStats(t), ws0 = weekStart(t);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(ws0, (i - 7) * 7));
  const mdays = monthDays(t.slice(0, 7)), mCount = mdays.filter(d => day(d).sport === 'done').length, mMin = mdays.reduce((s, d) => s + (day(d).sport === 'done' ? day(d).sportMin || 0 : 0), 0), mBurn = mdays.reduce((s, d) => s + burned(d), 0);
  let streak = 0; for (let i = 1; i < 60; i++) { if (weekStats(addDays(ws0, -7 * i)).n >= c.sportTarget) streak++; else break; } if (wk.n >= c.sportTarget) streak++;
  const types = {}; dayIds().forEach(d => { const x = day(d); if (x.sport === 'done') types[x.sportType || 'Autre'] = (types[x.sportType || 'Autre'] || 0) + 1; });
  const tmax = Math.max(1, ...Object.values(types));
  const recent = dayIds().filter(d => day(d).sport === 'done').reverse().slice(0, 8);
  return head('Sport', 'Coche tes séances, garde la série', dateBar()) + `<div class="grid">
  ${goalCard()}${verdictCard('sport')}
  <div class="card c4 hero" style="display:flex;align-items:center;justify-content:space-between"><div><h3>Cette semaine</h3><div class="big">${wk.n} / ${c.sportTarget}</div><p>${wk.n >= c.sportTarget ? 'Objectif atteint 🔥' : `Encore ${c.sportTarget - wk.n} séance(s)`}</p></div>${ring('sportw', wk.n / c.sportTarget, Math.round(Math.min(wk.n / c.sportTarget, 1) * 100) + '%', { size: 110 })}</div>
  <div class="card c4"><h3>Ce mois-ci</h3><div class="val">${mCount}<small>séances</small></div><div class="sub">${mMin} min · 🔥 ${fmt(mBurn, 0)} kcal brûlées</div></div>
  <div class="card c4"><h3>Série</h3><div class="val">${streak}<small>semaine(s) d’objectif</small></div><div class="sub">Objectif : ${c.sportTarget} séances / semaine</div></div>
  <div class="card c6" id="sportday"><h3>Séance du ${shortDate(ui.date)}</h3><div class="seg">${[['done', '✅ Faite'], ['rest', '😴 Repos']].map(([k, l]) => `<button class="${day(ui.date).sport === k ? 'on' : ''}" data-act="set" data-k="sport" data-v="${k}">${l}</button>`).join('')}</div>
    ${day(ui.date).sport === 'done' ? `<div class="chips" style="margin-top:12px">${SPORTS.map(s => `<button class="${day(ui.date).sportType === s ? 'on' : ''}" data-act="set" data-k="sportType" data-v="${s}">${s}</button>`).join('')}</div><div style="margin-top:12px"><label class="l">Durée (min)</label><input class="field" data-day="sportMin" data-num type="number" inputmode="numeric" value="${day(ui.date).sportMin ?? ''}"></div>${burnLine(ui.date)}` : ''}</div>
  <div class="card c6"><h3>8 dernières semaines · touche un jour pour le modifier</h3><div class="heat"><span></span>${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(l => `<span class="hd">${l}</span>`).join('')}${weeks.map(w => `<span>${shortDate(w)}</span>${Array.from({ length: 7 }, (_, i) => { const d = addDays(w, i), s = day(d).sport; return `<span class="c ${s === 'done' ? 'on' : s === 'rest' ? 'mid' : ''}" data-act="pickday" data-d="${d}" style="cursor:pointer;${d > t ? 'opacity:.35;' : ''}${d === ui.date ? 'outline:2px solid var(--acc);outline-offset:1px;' : ''}">${s === 'done' ? '✓' : ''}</span>`; }).join('')}`).join('')}</div></div>
  <div class="card c6"><h3>Types de séance</h3><div class="list">${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div><div class="row" style="justify-content:space-between"><span>${k}</span><b>${n}</b></div><div class="bar"><i style="width:${n / tmax * 100}%"></i></div></div>`).join('') || '<div class="empty">Pas encore de séance</div>'}</div></div>
  <div class="card c6"><h3>Dernières séances</h3><div class="list">${recent.map(d => `<div class="item"><div class="grow"><div class="t">${esc(day(d).sportType || 'Séance')}</div><div class="s">${longDate(d)}</div></div><b>${day(d).sportMin ? day(d).sportMin + ' min' : ''}</b></div>`).join('') || '<div class="empty">—</div>'}</div></div></div>`;
}

function profileData() {
  const c = cfg(), pl = plan(c); if (!c.goalType) return null;
  return { objectif: GOALS[c.goalType]?.t, sexe: c.sex === 'f' ? 'femme' : c.sex === 'h' ? 'homme' : null, age: c.age, tailleCm: c.height, rythme: c.pace, besoinsEstimesKcalHorsSport: pl && pl.tdee, cibleKcalDeBase: pl && pl.target, cibleMacrosG: pl && { p: pl.p, g: pl.c, l: pl.f } };
}
/* ---------- Objectif (formulaire) + verdicts ---------- */
function goalCard() {
  const c = cfg(), pl = plan(c), G = GOALS[c.goalType], edit = ui.goalEdit || !c.goalType;
  if (!edit) return `<div class="card c12" style="display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><h3 style="margin-bottom:6px">🎯 Mon objectif</h3><div class="t" style="font-size:17px;font-weight:700">${G.i} ${G.t}</div><div class="sub">${pl ? `Cible ${fmt(kcalBase(c), 0)} kcal/j · P ${pl.p} g · G ${pl.c} g · L ${pl.f} g${c.kcalMode === 'manual' ? ' (calories manuelles)' : ''}` : 'Complète ton profil pour calculer tes cibles'}</div></div><button class="btn" data-act="goaledit">Modifier</button></div>`;
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button type="button" class="${c[k] === v ? 'on' : ''}" data-act="cfgset" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return `<div class="card c12"><h3>🎯 Mon objectif ${c.goalType ? '' : '· 2 minutes pour des conseils sur mesure'}</h3>
  <div class="chips" style="margin-bottom:14px">${Object.entries(GOALS).map(([k, g]) => `<button type="button" class="${c.goalType === k ? 'on' : ''}" data-act="cfgset" data-k="goalType" data-v="${k}" title="${g.d}">${g.i} ${g.t}</button>`).join('')}</div>
  ${G ? `<p class="sub" style="margin:-4px 0 12px">${G.d}.</p>` : ''}
  <div class="f2" style="gap:12px"><div><label class="l">Sexe</label>${seg('sex', [['h', 'Homme'], ['f', 'Femme']])}</div><div><label class="l">Rythme</label>${seg('pace', [['soft', 'Doux'], ['mid', 'Modéré'], ['fast', 'Rapide']])}</div>
  <div><label class="l">Âge</label><input class="field" data-cfg="age" data-num type="number" inputmode="numeric" value="${c.age ?? ''}"></div><div><label class="l">Taille (cm)</label><input class="field" data-cfg="height" data-num type="number" inputmode="numeric" value="${c.height ?? ''}"></div>
  <div style="grid-column:span 2"><label class="l">Activité quotidienne (hors séances de sport)</label><select class="field" data-cfg="activity">${ACTIVITY.map(([v, l]) => `<option value="${v}" ${String(c.activity) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div style="grid-column:span 2"><label class="l">Objectif calorique</label>${seg('kcalMode', [['auto', 'Calculé automatiquement'], ['manual', 'Manuel (Réglages)']])}</div></div>
  <div class="list" style="margin-top:14px">${pl ? `<div class="item"><div class="grow">Métabolisme de base · dépense/jour</div><b>${fmt(pl.bmr, 0)} · ${fmt(pl.tdee, 0)} kcal</b></div><div class="item"><div class="grow">Cible calorique de base</div><b>${fmt(pl.target, 0)} kcal ${pl.kgWeek ? `(≈ ${pl.kgWeek > 0 ? '+' : ''}${fmt(pl.kgWeek, 2)} kg/sem)` : ''}</b></div><div class="item"><div class="grow">Cibles protéines · glucides · lipides</div><b>${pl.p} · ${pl.c} · ${pl.f} g</b></div>${pl.floorHit ? '<div class="sub">⚠️ Cible relevée au minimum de sécurité (1 200 kcal femme / 1 500 homme).</div>' : ''}` : `<div class="empty">Choisis ton objectif, ton sexe, ton âge, ta taille et ${weights().length || c.startWeight ? 'ton rythme' : 'enregistre ton poids (onglet Poids)'} pour calculer tes cibles.</div>`}</div>
  <p class="sub" style="margin:10px 0 0">Estimations indicatives (formule Mifflin-St Jeor), pas un avis médical.</p>
  <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn pri" data-act="goaldone">Terminé</button></div></div>`;
}
function verdictRows(kind) {
  const c = cfg(), pl = plan(c), G = GOALS[c.goalType], t = today(), rows = [], row = (state, icon, label, text) => rows.push({ state, icon, label, text });
  const past = Array.from({ length: 6 }, (_, i) => addDays(t, -i - 1)), want = G.want, f = weightForecast();
  if (kind === 'food') {
    const dd = past.filter(d => kcalOf(d) > 0);
    if (!pl) row('warn', '🧮', 'Besoins estimés', 'Complète sexe, âge, taille et poids pour calculer tes besoins.');
    else if (!dd.length) row('warn', '🍽️', 'Calories', 'Note quelques repas complets (hors aujourd’hui) pour obtenir un verdict.');
    else {
      const inn = meanA(dd.map(kcalOf)), exp = pl.tdee + meanA(dd.map(burned)), bal = Math.round(inn - exp), lab = bal < -150 ? 'déficit' : bal > 150 ? 'surplus' : 'équilibre';
      let st = 'ok', adv = 'conforme à ton objectif';
      if (want === 'deficit') { if (bal > -150) { st = 'warn'; adv = 'déficit insuffisant pour perdre du poids'; } else if (bal < -700) { st = 'bad'; adv = 'déficit trop agressif : risque de perdre du muscle'; } }
      else if (want === 'surplus') { if (bal < 100) { st = 'warn'; adv = 'surplus insuffisant pour prendre'; } else if (bal > 500) { st = 'warn'; adv = 'surplus trop fort : prise de gras probable'; } }
      else if (Math.abs(bal) > 200) { st = 'warn'; adv = `pas à l’équilibre (${lab})`; }
      row(st, '🔥', 'Bilan énergétique', `Moyenne ${fmt(inn, 0)} kcal vs dépense estimée ${fmt(exp, 0)} → ${bal > 0 ? '+' : ''}${bal} kcal/j (${lab}) : ${adv}.`);
      const dm = dd.filter(d => (day(d).meals || []).some(m => m.p != null));
      for (const [k, name, ic] of [['p', 'Protéines', '🥩'], ['c', 'Glucides', '🍚'], ['f', 'Lipides', '🥑']]) {
        if (!dm.length) break;
        const v = meanA(dm.map(d => macrosOf(d)[k])), tg = Math.round(meanA(dm.map(d => macroGoals(d)[k]))), r = tg ? v / tg : 1; let st2 = 'ok', msg = 'dans la cible';
        if (r < .85) { st2 = 'warn'; msg = 'insuffisant' + ({ p: want === 'deficit' ? ' : risque de perdre du muscle' : ' : freine le gain de muscle', c: ' : énergie et récupération réduites', f: ' : hormones et vitamines liposolubles' }[k]); }
        else if (r > 1.2) { st2 = 'warn'; msg = 'en excès' + ({ p: ' : inutile au-delà de la cible', c: want === 'deficit' ? ' : compromet le déficit' : '', f: ' : très calorique, surveille le total' }[k]); }
        row(st2, ic, name, `${fmt(v, 0)} g/j vs cible ${tg} g : ${msg}.`);
      }
    }
  } else {
    const l7 = Array.from({ length: 7 }, (_, i) => addDays(t, -i)), done = l7.filter(d => day(d).sport === 'done'), muscu = done.filter(d => day(d).sportType === 'Muscu').length;
    const need = { cut: 2, bulk: 3, recomp: 3, maintain: 0, gain: 3 }[c.goalType];
    if (need) row(muscu >= need ? 'ok' : 'warn', '🏋️', 'Musculation', `${muscu} séance(s) sur 7 jours (recommandé : ${need}+)${muscu < need ? ' : ajoute-en pour ' + (want === 'deficit' ? 'conserver ton muscle' : 'stimuler la prise de muscle') : ''}.`);
    if (c.goalType === 'cut') { const cardio = done.length - muscu; row(cardio >= 1 ? 'ok' : 'warn', '🏃', 'Cardio / activité', `${cardio} séance(s) hors musculation sur 7 jours${cardio < 1 ? ' : 1 à 2 séances de cardio ou de marche soutiennent le déficit' : ''}.`); }
    if (!need && c.goalType === 'maintain') row(done.length >= c.sportTarget ? 'ok' : 'warn', '✅', 'Régularité', `${done.length} séance(s) sur 7 jours (objectif ${c.sportTarget}/semaine).`);
    const sl = l7.map(d => day(d).sleep).filter(v => v != null);
    if (sl.length) { const m = meanA(sl); row(m >= 7 ? 'ok' : 'warn', '😴', 'Sommeil', `${fmt(m, 1)} h en moyenne${m < 7 ? ' : sous 7 h, la récupération et la prise de muscle en pâtissent' : ' : bonne récupération'}.`); }
  }
  if (f.ok) {
    const pw = f.perWeek; let st = 'ok', adv = 'en phase avec ton objectif';
    if (want === 'deficit') { if (pw > -0.1) { st = 'warn'; adv = 'tu ne perds pas encore : ajuste le déficit'; } else if (pw < -1) { st = 'bad'; adv = 'perte trop rapide'; } }
    else if (want === 'surplus') { if (pw < 0.05) { st = 'warn'; adv = 'tu ne prends pas : augmente les calories'; } else if (pw > 0.6) { st = 'warn'; adv = 'prise trop rapide (gras)'; } }
    else if (Math.abs(pw) > 0.3) { st = 'warn'; adv = 'poids instable pour un objectif d’équilibre'; }
    row(st, '⚖️', 'Tendance du poids', `${pw > 0 ? '+' : ''}${fmt(pw, 2)} kg/sem : ${adv}.`);
  }
  return rows;
}
/* ---------- Rapport hebdomadaire (lundi → dimanche) ---------- */
const lastWeek = () => addDays(weekStart(today()), -7);
function weeklyReport(w) {
  const c = cfg(), pl = plan(c), G = GOALS[c.goalType], want = G && G.want, ds = Array.from({ length: 7 }, (_, i) => addDays(w, i)), pds = ds.map(d => addDays(d, -7));
  const items = [], add = (k, icon, label, state, value, tip) => items.push({ k, icon, label, state, value, tip: state === 'bad' ? tip : '' });
  const nums = (arr, f) => arr.map(f).filter(v => typeof v === 'number'), plural = (n, a, b) => n > 1 ? b : a;
  const wts = nums(ds, d => day(d).weight), pw = nums(pds, d => day(d).weight);
  add('weigh', '⚖️', 'Pesées', wts.length >= 3 ? 'ok' : 'bad', `${wts.length} pesée(s) sur 7 jours`, 'Pèse-toi 3 fois par semaine, à la même heure et dans les mêmes conditions (idéalement à jeun) : la tendance devient fiable.');
  if (wts.length && pw.length) {
    const dl = meanA(wts) - meanA(pw), v = `${dl > 0 ? '+' : ''}${fmt(dl, 2)} kg vs semaine précédente`;
    if (want === 'deficit') add('trend', '📉', 'Évolution du poids', dl <= -0.1 && dl >= -1 ? 'ok' : 'bad', v, dl > -0.1 ? 'Ton poids ne baisse pas : vérifie les portions et les grignotages, puis retire environ 150 kcal par jour (une portion de féculents ou de matières grasses en moins).' : 'La perte est rapide : remonte un peu les calories et garde tes protéines hautes pour protéger ton muscle.');
    else if (want === 'surplus') add('trend', '📈', 'Évolution du poids', dl >= 0.05 && dl <= 0.6 ? 'ok' : 'bad', v, dl < 0.05 ? 'Tu ne prends pas assez : ajoute environ 200 kcal par jour (collation protéinée, féculents, huile d’olive).' : 'La prise est rapide (risque de gras) : réduis le surplus d’environ 150 kcal par jour.');
    else if (want === 'balance') add('trend', '⚖️', 'Stabilité du poids', Math.abs(dl) <= 0.4 ? 'ok' : 'bad', v, 'Ton poids varie plus que prévu : garde des repas réguliers et évite les gros écarts du week-end.');
    else add('trend', '⚖️', 'Évolution du poids', 'na', v, '');
  }
  const done = ds.filter(d => day(d).sport === 'done'), n = done.length, muscu = done.filter(d => day(d).sportType === 'Muscu').length;
  add('sport', '🏋️', 'Séances de sport', n >= c.sportTarget ? 'ok' : 'bad', `${n} / ${c.sportTarget} séance(s)`, `Il te manque ${c.sportTarget - n} séance(s) : planifie-les à l’avance dans ton agenda, même 20 minutes valent mieux que rien.`);
  const need = c.goalType ? { cut: 2, bulk: 3, recomp: 3, maintain: 0, gain: 3 }[c.goalType] : 0;
  if (need) add('muscu', '💪', 'Musculation', muscu >= need ? 'ok' : 'bad', `${muscu} séance(s) (recommandé : ${need}+)`, `Ajoute une séance de musculation avec des mouvements polyarticulaires (squat, développé, tirage) pour ${want === 'deficit' ? 'conserver ton muscle' : 'progresser'}.`);
  const kd = ds.filter(d => kcalOf(d) > 0);
  add('log', '🍽️', 'Repas notés', kd.length >= 5 ? 'ok' : 'bad', `${kd.length} jour(s) sur 7`, 'Note tes repas juste après les avoir mangés : ça prend 10 secondes et rend le suivi fiable.');
  if (kd.length >= 3) {
    const inn = meanA(kd.map(kcalOf)), tg = meanA(kd.map(d => goalKcal(d, c))), r = inn / tg, gap = Math.round(Math.abs(inn - tg));
    add('kcal', '🔥', 'Calories', r >= .9 && r <= 1.1 ? 'ok' : 'bad', `${fmt(inn, 0)} kcal/j pour une cible de ${fmt(tg, 0)}`, r > 1.1 ? `Tu dépasses ta cible de ${gap} kcal par jour : surveille les boissons sucrées, l’huile de cuisson et les grignotages du soir.` : `Tu manges ${gap} kcal sous ta cible : risque de fatigue et de perte de muscle, ajoute une collation (yaourt grec, fruit, oléagineux).`);
    const md = kd.filter(d => (day(d).meals || []).some(m => m.p != null));
    if (md.length >= 3) { const pv = meanA(md.map(d => macrosOf(d).p)), pt = meanA(md.map(d => macroGoals(d).p)); add('prot', '🥩', 'Protéines', pv >= pt * .9 ? 'ok' : 'bad', `${fmt(pv, 0)} g/j pour une cible de ${fmt(pt, 0)} g`, 'Ajoute une source de protéines à chaque repas : œufs, poulet, thon, skyr, fromage blanc ou légumineuses.'); }
  }
  const wm = ds.filter(d => (waterOf(d) || 0) >= waterGoal(c)).length;
  add('water', '💧', 'Hydratation', wm >= 5 ? 'ok' : 'bad', `Objectif atteint ${wm} jour(s) sur 7`, 'Garde une bouteille à portée, bois un grand verre au réveil et un autre avant chaque repas.');
  const sl = nums(ds, d => day(d).sleep);
  if (sl.length >= 3) { const m = meanA(sl); add('sleep', '😴', 'Sommeil', m >= 7 ? 'ok' : 'bad', `${fmt(m, 1)} h en moyenne`, 'Fixe une heure de coucher régulière et coupe les écrans 30 minutes avant : le sommeil pèse sur le poids, l’énergie et la récupération.'); }
  const mo = nums(ds, d => day(d).mood);
  if (mo.length >= 3) { const m = meanA(mo); add('mood', '🙂', 'Humeur', m >= 3.2 ? 'ok' : 'bad', `${fmt(m, 1)} / 5 en moyenne`, 'Humeur en baisse : planifie une activité qui te fait du bien (marche, sortie, ami) et protège ton sommeil.'); }
  const wh = ds.reduce((a, d) => a + workedHours(d, c), 0), wc = weeklyHours(c);
  if (wc && wh > 0) add('work', '💼', 'Heures de travail', wh <= wc * 1.15 ? 'ok' : 'bad', `${fmt(wh, 1)} h pour ${fmt(wc, 1)} h prévues`, `Tu as dépassé de ${fmt(wh - wc, 1)} h : prévois une vraie coupure et une soirée sans travail pour récupérer.`);
  const lim = Object.values(c.budgets || {}).reduce((a, v) => a + (Number(v) || 0), 0);
  if (lim > 0) { const sp = sumA(txs().filter(t => t.type !== 'inc' && ds.includes(t.date))), wl = lim * 7 / 30; add('budget', '💶', 'Dépenses', sp <= wl ? 'ok' : 'bad', `${eur(sp)} pour une enveloppe d’environ ${eur(wl)}`, 'Repère dans Budget la catégorie qui dérape, fixe-lui une limite et reporte les achats non urgents à la semaine suivante.'); }
  const act = ds.filter(d => { const x = day(d); return x.weight != null || x.sport || kcalOf(d) > 0 || x.water != null || x.waterL != null || x.sleep != null || x.mood != null; }).length;
  add('track', '📝', 'Régularité du suivi', act >= 5 ? 'ok' : 'bad', `${act} jour(s) renseigné(s) sur 7`, 'Active les rappels (onglet Rappels) et remplis ta journée en 1 minute le soir : la régularité fait toute la différence.');
  const ok = items.filter(i => i.state === 'ok').length, bad = items.filter(i => i.state === 'bad').length;
  return { w, items, ok, bad, score: ok + bad ? Math.round(ok / (ok + bad) * 100) : 0 };
}
function dailyReport(d) {
  const c = cfg(), pl = plan(c), G = GOALS[c.goalType], want = G && G.want, x = day(d), isToday = d === today(), items = [];
  const add = (k, icon, label, state, value, tip = '', missing = false) => items.push({ k, icon, label, state: missing && isToday && state === 'bad' ? 'na' : state, value: missing && isToday && state === 'bad' ? 'Pas encore renseigné' : value, tip: state === 'bad' && !(missing && isToday) ? tip : '' });
  add('weigh', '⚖️', 'Pesée', x.weight != null ? 'ok' : 'bad', x.weight != null ? `${fmt(x.weight)} kg${x.wCond ? (x.wCond === 'fasting' ? ' (à jeun)' : ' (pas à jeun)') : ''}` : 'Aucune pesée', 'Pèse-toi demain matin, à la même heure et dans les mêmes conditions (idéalement à jeun).', true);
  if (x.sport === 'done') add('sport', '🏋️', 'Sport', 'ok', `${x.sportType || 'Séance'}${x.sportMin ? ' · ' + x.sportMin + ' min' : ''}${burned(d) ? ' · 🔥 ' + burned(d) + ' kcal' : ''}`);
  else if (x.sport === 'rest') add('sport', '😴', 'Sport', 'ok', 'Jour de repos');
  else add('sport', '🏋️', 'Sport', 'na', 'Aucune séance notée');
  const meals = x.meals || [], inn = kcalOf(d), tg = goalKcal(d, c);
  if (!meals.length) add('kcal', '🍽️', 'Repas', 'bad', 'Aucun repas noté', 'Note tes repas juste après les avoir mangés : ça prend 10 secondes.', true);
  else {
    const r = inn / tg, gap = Math.round(Math.abs(inn - tg));
    add('kcal', '🔥', 'Calories', r >= .9 && r <= 1.1 ? 'ok' : (isToday && r < .9 ? 'na' : 'bad'), `${fmt(inn, 0)} kcal pour une cible de ${fmt(tg, 0)}${isToday && r < .9 ? ' (journée en cours)' : ''}`, r > 1.1 ? `Tu dépasses de ${gap} kcal : surveille les boissons sucrées, l’huile et les grignotages.` : `Tu es ${gap} kcal sous ta cible : ajoute une collation (yaourt grec, fruit, oléagineux).`);
    if (meals.some(m => m.p != null)) {
      const m = macrosOf(d), g = macroGoals(d), pr = m.p / g.p, cr = m.c / g.c, fr = m.f / g.f;
      add('prot', '🥩', 'Protéines', pr >= .9 ? 'ok' : (isToday ? 'na' : 'bad'), `${fmt(m.p, 0)} g pour une cible de ${g.p} g`, 'Ajoute une source de protéines à chaque repas : œufs, poulet, thon, skyr ou légumineuses.');
      add('carb', '🍚', 'Glucides', cr >= .75 && cr <= 1.25 ? 'ok' : (isToday && cr < .75 ? 'na' : 'bad'), `${fmt(m.c, 0)} g pour une cible de ${g.c} g`, cr > 1.25 ? 'Trop de glucides : réduis les produits sucrés et les portions de féculents.' : 'Glucides bas : ajoute riz, pâtes, pain complet ou fruits, surtout autour de ton entraînement.');
      add('fat', '🥑', 'Lipides', fr >= .75 && fr <= 1.25 ? 'ok' : (isToday && fr < .75 ? 'na' : 'bad'), `${fmt(m.f, 0)} g pour une cible de ${g.f} g`, fr > 1.25 ? 'Lipides élevés : limite fritures, charcuterie et sauces grasses.' : 'Lipides bas : ajoute huile d’olive, avocat ou oléagineux pour tes hormones et tes vitamines.');
    }
    if (pl && !isToday) {
      const bal = Math.round(inn - (pl.tdee + burned(d))), lab = bal < -100 ? 'déficit' : bal > 100 ? 'surplus' : 'équilibre';
      const okb = want === 'deficit' ? bal <= -100 && bal >= -800 : want === 'surplus' ? bal >= 50 && bal <= 600 : Math.abs(bal) <= 250;
      add('bal', '⚡', 'Bilan énergétique', okb ? 'ok' : 'bad', `${bal > 0 ? '+' : ''}${bal} kcal (${lab})`, want === 'deficit' ? (bal > -100 ? 'Pas de déficit : réduis un peu les portions ou ajoute de l’activité.' : 'Déficit trop fort : remonte les calories pour préserver ton muscle.') : want === 'surplus' ? (bal < 50 ? 'Pas assez de calories pour prendre : ajoute une collation riche.' : 'Surplus trop fort : réduis d’environ 150 kcal pour limiter le gras.') : 'Garde des journées plus régulières pour rester à l’équilibre.');
    }
  }
  const wl = waterOf(d);
  add('water', '💧', 'Eau', wl != null && wl >= waterGoal(c) ? 'ok' : 'bad', `${wl != null ? fmt(wl, 2) : '0'} L pour un objectif de ${fmt(waterGoal(c), 2)} L`, 'Garde une bouteille à portée et bois un grand verre au réveil et avant chaque repas.', true);
  if (x.sleep != null) add('sleep', '😴', 'Sommeil', x.sleep >= 7 ? 'ok' : 'bad', `${fmt(x.sleep, 1)} h`, 'Fixe une heure de coucher régulière et coupe les écrans 30 minutes avant.'); else add('sleep', '😴', 'Sommeil', 'na', 'Non renseigné');
  if (x.mood != null) add('mood', '🙂', 'Humeur', x.mood >= 3 ? 'ok' : 'bad', `${x.mood} / 5`, 'Journée difficile : planifie une activité qui te fait du bien et protège ton sommeil.');
  const wh = workedHours(d, c); if (wh > 0) add('work', '💼', 'Travail', wh <= 10 ? 'ok' : 'bad', `${fmt(wh, 1)} h`, 'Journée très longue : prévois une vraie coupure et une soirée de récupération.');
  const lim = Object.values(c.budgets || {}).reduce((a, v) => a + (Number(v) || 0), 0);
  if (lim > 0) { const sp = sumA(txs().filter(t => t.type !== 'inc' && t.date === d)), env = lim / 30; add('budget', '💶', 'Dépenses', sp <= env ? 'ok' : 'bad', `${eur(sp)} pour une enveloppe d’environ ${eur(env)}`, 'Identifie l’achat qui a fait dépasser et compense en réduisant les dépenses des prochains jours.'); }
  if ((x.notes || '').trim()) add('note', '📝', 'Note du jour', 'na', x.notes.trim().slice(0, 160));
  const ok = items.filter(i => i.state === 'ok').length, bad = items.filter(i => i.state === 'bad').length;
  return { d, items, ok, bad, score: ok + bad ? Math.round(ok / (ok + bad) * 100) : 0 };
}
function reportCard() {
  const w = lastWeek(), r = weeklyReport(w), bads = r.items.filter(i => i.state === 'bad').slice(0, 2), isMon = new Date().getDay() === 1;
  return `<div class="card c12"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><h3 style="margin:0">📋 Rapport de la semaine du ${shortDate(w)} au ${shortDate(addDays(w, 6))} ${isMon ? '<span class="chip up">Nouveau</span>' : ''}</h3><button class="btn sm" data-act="openweek">Voir le rapport complet →</button></div>
  <div class="row" style="margin:12px 0 4px"><span class="chip up"><i class="rdot g"></i> ${r.ok} réussi(s)</span><span class="chip down"><i class="rdot r"></i> ${r.bad} à améliorer</span><span class="sub">Score ${r.score} %</span></div>
  ${bads.length ? `<div class="list" style="margin-top:10px">${bads.map(i => `<div class="item"><i class="rdot r"></i><div class="grow"><div class="t">${i.icon} ${i.label} · ${esc(i.value)}</div><div class="s">${esc(i.tip)}</div></div></div>`).join('')}</div>` : '<p class="sub" style="margin:8px 0 0">Aucun point rouge cette semaine, bravo 🎉</p>'}</div>`;
}
function vReport() {
  const mode = ui.repMode || 'week', isDay = mode === 'day', dd = ui.repDay || today(), w = ui.repWeek || lastWeek();
  const r = isDay ? dailyReport(dd) : weeklyReport(w), ok = r.items.filter(i => i.state === 'ok'), bad = r.items.filter(i => i.state === 'bad'), na = r.items.filter(i => i.state === 'na');
  const row = i => `<div class="item"><i class="rdot ${i.state === 'ok' ? 'g' : i.state === 'bad' ? 'r' : ''}"></i><div class="grow"><div class="t">${i.icon} ${i.label}</div><div class="s">${esc(i.value)}</div>${i.tip ? `<div class="tipline">💡 ${esc(i.tip)}</div>` : ''}</div></div>`;
  const nav = isDay ? `<div class="datebar"><button data-act="repday" data-n="-1" aria-label="Jour précédent">${ic('l')}</button><span class="d">${dd === today() ? 'Aujourd’hui' : longDate(dd)}</span><button data-act="repday" data-n="1" aria-label="Jour suivant">${ic('r')}</button></div>` : `<div class="datebar"><button data-act="repweek" data-n="-1" aria-label="Semaine précédente">${ic('l')}</button><span class="d">Semaine</span><button data-act="repweek" data-n="1" aria-label="Semaine suivante">${ic('r')}</button></div>`;
  const sub = isDay ? longDate(dd) + (dd === today() ? ' · journée en cours' : '') : `Semaine du ${shortDate(w)} au ${shortDate(addDays(w, 6))}`;
  return head('Rapports', sub, `<div class="seg"><button class="${!isDay ? 'on' : ''}" data-act="repmode" data-v="week">Hebdomadaire</button><button class="${isDay ? 'on' : ''}" data-act="repmode" data-v="day">Journalier</button></div>`) + `<div class="row" style="margin:-8px 0 16px">${nav}</div><div class="grid">
  <div class="card c12 hero" style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap"><div><h3>${isDay ? 'Bilan de la journée' : 'Bilan de la semaine'}</h3><div class="big">${r.score} <em>%</em> de points réussis</div><p>${r.ok} en vert · ${r.bad} en rouge</p><div class="row"><button class="btn" style="background:rgba(255,255,255,.95);color:#0b4a44" data-act="reportpdf">⬇️ Télécharger (PDF)</button><button class="btn" style="background:rgba(255,255,255,.2);color:#fff" data-act="coach" data-m="report">✨ Résumé IA</button></div></div>${ring('rep', r.score / 100, r.score + '%', { size: 120 })}</div>
  <div class="card c6"><h3><i class="rdot g"></i> Réussites (${ok.length})</h3><div class="list">${ok.map(row).join('') || '<div class="empty">Pas encore de réussite</div>'}</div></div>
  <div class="card c6"><h3><i class="rdot r"></i> À améliorer (${bad.length})</h3><div class="list">${bad.map(row).join('') || '<div class="empty">Rien à rattraper 🎉</div>'}</div></div>
  ${na.length ? `<div class="card c12"><h3>Pour information</h3><div class="list">${na.map(row).join('')}</div></div>` : ''}</div>`;
}
async function reportPdf() {
  const isDay = ui.repMode === 'day', w = ui.repWeek || lastWeek(), r = isDay ? dailyReport(ui.repDay || today()) : weeklyReport(w);
  if (!window.jspdf) await new Promise((ok, ko) => { const el = document.createElement('script'); el.src = '/vendor/jspdf.min.js'; el.onload = ok; el.onerror = () => ko(); document.head.appendChild(el); }).catch(() => toast('Chargement du PDF impossible'));
  if (!window.jspdf) return;
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), M = 15, W = 210, H = 297; let y = 20;
  const cl = x => String(x == null ? '' : x).replace(/[\u202F\u00A0]/g, ' '); // espaces insécables → espaces simples (police PDF)
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(0, 168, 150); doc.text(isDay ? 'Rapport journalier' : 'Rapport hebdomadaire', M, y); y += 7;
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90); doc.text(`${isDay ? longDate(r.d) : 'Semaine du ' + shortDate(w) + ' au ' + shortDate(addDays(w, 6))}${cfg().name ? '  ·  ' + cfg().name : ''}`, M, y); y += 8;
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(30); doc.text(`Score : ${r.score} %   ·   ${r.ok} réussi(s)   ·   ${r.bad} à améliorer`, M, y); y += 9;
  const section = (title, list, color) => {
    if (!list.length) return; doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...color); doc.text(title, M, y); y += 6;
    for (const i of list) {
      const tip = i.tip ? doc.splitTextToSize(cl('Conseil : ' + i.tip), W - 2 * M - 8) : [], h = 5 + tip.length * 4.2 + 3;
      if (y + h > H - 18) { doc.addPage(); y = 20; }
      doc.setFillColor(...color).circle(M + 2, y - 1.2, 1.7, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(30); doc.text(i.label, M + 7, y);
      doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(80); doc.text(cl(i.value), W - M, y, { align: 'right' }); y += 5;
      doc.setFontSize(9).setTextColor(70); tip.forEach(l => { doc.text(l, M + 7, y); y += 4.2; }); y += 3;
    } y += 3;
  };
  section('Réussites', r.items.filter(i => i.state === 'ok'), [34, 160, 90]);
  section('À améliorer', r.items.filter(i => i.state === 'bad'), [214, 60, 60]);
  section('Pour information', r.items.filter(i => i.state === 'na'), [120, 120, 120]);
  doc.setFontSize(8).setTextColor(140); doc.text('Généré par Ma Vie — conseils indicatifs, pas un avis médical.', M, H - 10);
  doc.save(isDay ? `Rapport-jour-${r.d}.pdf` : `Rapport-semaine-${w}.pdf`);
}
function verdictCard(kind) {
  const c = cfg(); if (!c.goalType) return '';
  const chip = s => s === 'ok' ? '<span class="chip up">OK</span>' : s === 'bad' ? '<span class="chip down">À corriger</span>' : '<span class="chip" style="background:rgba(251,191,36,.18);color:var(--warn)">À ajuster</span>';
  return `<div class="card c12"><h3>📋 Verdict selon ton objectif · ${GOALS[c.goalType].t}</h3><div class="list">${verdictRows(kind).map(r => `<div class="item"><span style="font-size:20px">${r.icon}</span><div class="grow"><div class="t">${r.label}</div><div class="s">${r.text}</div></div>${chip(r.state)}</div>`).join('') || '<div class="empty">Pas assez de données</div>'}</div></div>`;
}
function nutritionCard() {
  const t = today(), c = cfg();
  const ds = Array.from({ length: 6 }, (_, i) => addDays(t, -i - 1)).filter(d => (day(d).meals || []).some(m => m.p != null)); // jours complets (hors aujourd’hui)
  const avg = k => ds.length ? ds.reduce((a, d) => a + macrosOf(d)[k], 0) / ds.length : null;
  const st = (v, goal) => v == null ? '' : v / goal < .85 ? '<span class="chip down">Insuffisant</span>' : v / goal > 1.15 ? '<span class="chip down">Excès</span>' : '<span class="chip up">OK</span>';
  const gAvg = k => ds.length ? ds.reduce((a, d) => a + macroGoals(d)[k], 0) / ds.length : macroGoals()[k];
  const kAvg = ds.length ? ds.reduce((a, d) => a + goalKcal(d, c), 0) / ds.length : kcalBase(c);
  const kc = ds.length ? ds.reduce((a, d) => a + kcalOf(d), 0) / ds.length : null;
  return `<div class="card c6"><h3>🥗 Macros · moyenne des ${ds.length} derniers jours</h3><div class="list">${[['Protéines', 'p'], ['Glucides', 'c'], ['Lipides', 'f']].map(([l, k]) => `<div class="item"><div class="grow">${l}</div><b>${fmt(avg(k), 0)} g</b><span class="sub">/ ${Math.round(gAvg(k))} g</span>${st(avg(k), gAvg(k))}</div>`).join('')}<div class="item"><div class="grow">Calories</div><b>${fmt(kc, 0)}</b><span class="sub">/ ${Math.round(kAvg)}</span>${st(kc, kAvg)}</div></div>
  <p class="sub">Objectifs ${c.protGoal != null ? 'personnalisés' : 'calculés (protéines 1,8 g/kg, lipides 30 %)'} — modifiables dans Réglages.</p><button class="btn pri sm" data-act="coach" data-m="nutrition">✨ Conseils nutrition IA</button></div>`;
}
function vFood() {
  const c = cfg(), t = today();
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13));
  const k = days.map(d => kcalOf(d)), logged = k.filter(v => v > 0), avg = logged.length ? logged.reduce((s, v) => s + v, 0) / logged.length : null;
  return head('Repas', 'Note ce que tu manges, suis tes calories', dateBar()) + `<div class="grid">
  ${goalCard()}${verdictCard('food')}
  <div class="card c4 hero" style="display:flex;align-items:center;justify-content:space-between"><div><h3>${ui.date === t ? 'Aujourd’hui' : shortDate(ui.date)}</h3><div class="big">${fmt(kcalOf(ui.date), 0)} <em>kcal</em></div><p>sur ${fmt(goalKcal(ui.date, c), 0)} visées${goalBonus(ui.date, c) ? ` (${fmt(c.kcalGoal, 0)} + ${goalBonus(ui.date, c)} 🔥 sport)` : ''}</p></div>${ring('kcal', kcalOf(ui.date) / goalKcal(ui.date, c), Math.round(kcalOf(ui.date) / goalKcal(ui.date, c) * 100) + '%', { size: 108 })}</div>
  <div class="card c8"><h3>14 derniers jours · moyenne ${fmt(avg, 0)} kcal</h3>${bars('kc', days.map((d, i) => ({ label: parse(d).getDate(), v: k[i] })), { goal: kcalBase(c), unit: ' kcal' })}</div>
  ${mealsCard(ui.date)}
  ${nutritionCard()}
  <div class="card c6"><h3>Journal alimentaire</h3><div class="list">${days.slice().reverse().filter(d => (day(d).meals || []).length).slice(0, 7).map(d => `<div class="item" style="align-items:flex-start;flex-direction:column;gap:2px"><div class="row" style="width:100%;justify-content:space-between"><b style="text-transform:capitalize">${longDate(d)}</b><span class="chip">${fmt(kcalOf(d), 0)} kcal</span></div><div class="s">${day(d).meals.map(m => esc(m.name)).join(' · ')}</div></div>`).join('') || '<div class="empty">Rien pour l’instant</div>'}</div></div></div>`;
}

function schedCard(c) {
  return `  <div class="card c12"><h3>🗓️ Emploi du temps type</h3><p class="sub" style="margin-top:0">Renseigne tes horaires habituels : quand tu marques « Travaillé », les heures sont calculées automatiquement (modifiables jour par jour). Si la fin est avant le début, c'est compté comme travail de nuit.</p>
  <table class="table sched"><tr><th>Jour</th><th>Début</th><th>Fin</th><th>Pause</th><th>Heures</th></tr>${DAYS.map((l, i) => { const t = c.sched?.[i] || {}; return `<tr><td><span class="dfull">${l}</span><span class="dshort">${l.slice(0, 3)}</span></td><td><input class="field" type="time" data-sched="${i}" data-k="s" value="${t.s || ''}"></td><td><input class="field" type="time" data-sched="${i}" data-k="e" value="${t.e || ''}"></td><td><input class="field" type="number" inputmode="numeric" style="max-width:90px" data-sched="${i}" data-k="b" value="${t.b ?? ''}"></td><td><b>${spanH(t.s, t.e, t.b) != null ? fmt(spanH(t.s, t.e, t.b), 2) + ' h' : '–'}</b></td></tr>`; }).join('')}</table>
  <div class="row" style="margin-top:12px"><button class="btn sm" data-act="copymon">Copier le lundi sur lun–ven</button><button class="btn sm danger" data-act="clearsched">Effacer</button><span class="sub">Total : <b>${fmt(Object.values(c.sched || {}).reduce((a, x) => a + (spanH(x.s, x.e, x.b) || 0), 0), 2)} h / semaine</b></span></div></div>`;
}
function vWork() {
  const c = cfg(), t = today(), m = ui.month, ds = monthDays(m), off = (parse(m + '-01').getDay() + 6) % 7;
  const cnt = k => ds.filter(d => day(d).work === k).length, hours = ds.reduce((s, d) => s + workedHours(d, c), 0), tg = monthTarget(c), sal = salaryFor(m, c), rate = sal && tg ? sal / tg : null;
  const year = dayIds().filter(d => d.startsWith(m.slice(0, 4)) && day(d).work === 'work').length;
  const shift = n => { const d = parse(m + '-01'); d.setMonth(d.getMonth() + n); return ymd(d).slice(0, 7); };
  return head('Travail', 'Touche un jour pour changer : travaillé → repos → congé', `<div class="datebar"><button data-act="month" data-m="${shift(-1)}">${ic('l')}</button><span class="d">${monthName(m)}</span><button data-act="month" data-m="${shift(1)}">${ic('r')}</button></div>`) + `<div class="grid">
  <div class="card c7"><div class="cal">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(l => `<span class="h">${l}</span>`).join('')}${Array.from({ length: off }, () => '<button class="blank" tabindex="-1"></button>').join('')}${ds.map(d => { const x = day(d); return `<button class="${x.work || ''} ${d === t ? 'today' : ''}" data-act="calcycle" data-d="${d}">${parse(d).getDate()}${x.work === 'work' && workedHours(d, c) ? `<small>${fmt(workedHours(d, c), 1)}h</small>` : ''}</button>`; }).join('')}</div>
    <div class="legend"><span><i style="background:var(--acc)"></i>Travaillé</span><span><i style="background:rgba(56,189,248,.5)"></i>Repos</span><span><i style="background:rgba(251,191,36,.6)"></i>Congé</span></div></div>
  <div class="card c5"><h3>${monthName(m)}</h3><div class="val">${fmt(hours, 1)}<small>${tg ? '/ ' + fmt(tg, 0) + ' h' : 'h'} · ${cnt('work')} jour${cnt('work') > 1 ? 's' : ''}</small></div>${tg ? `<div class="bar" style="margin:14px 0"><i style="width:${Math.min(hours / tg * 100, 100)}%"></i></div>` : '<div style="height:14px"></div>'}
    <div class="list"><div class="item"><div class="grow">Heures hebdo contrat</div><b>${weeklyHours(c) ? fmt(weeklyHours(c)) + ' h' : '–'}</b></div><div class="item"><div class="grow">Repos</div><b>${cnt('off')}</b></div><div class="item"><div class="grow">Congés</div><b>${cnt('leave')}</b></div>${rate ? `<div class="item"><div class="grow">Taux horaire net</div><b>${eur(rate)}</b></div><div class="item"><div class="grow">Gagné à ce jour (heures faites)</div><b>${eur(hours * rate)}</b></div>` : ''}<div class="item"><div class="grow">Jours travaillés en ${m.slice(0, 4)}</div><b>${year}</b></div></div>
    <div style="margin-top:14px">${salaryInput(m)}</div>
    ${rate ? '' : '<p class="sub">Astuce : renseigne tes heures hebdo et ton salaire net ci-dessous et dans Réglages pour estimer ton taux horaire et tes revenus.</p>'}</div>
  ${schedCard(c)}</div>`;
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
  <div class="card c4"><h3>${s.fixed ? 'Fin prévue' : 'Fin estimée'}</h3><div class="val">${s.end ? s.end.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '–'}</div><div class="sub">${s.fixed ? `Durée ${c.months} mois · ${s.elapsed} écoulé(s) · ${s.monthsLeft} restant(s)` : s.monthsLeft != null ? `${s.monthsLeft} mensualité(s) de ${eur(c.monthly)}` : 'Renseigne ta mensualité ou ta durée ci-dessous'}</div></div>
  <div class="card c8"><h3>Solde restant dans le temps</h3>${series || '<div class="empty">Renseigne le montant total pour voir la courbe</div>'}</div>
  <div class="card c4"><h3>Mon crédit</h3><div class="list" style="gap:10px"><div><label class="l">Nom</label><input class="field" data-cr="name" value="${esc(c.name)}"></div><div><label class="l">Montant total à rembourser (€)</label><input class="field" data-cr="total" data-num type="number" inputmode="decimal" value="${c.total || ''}"></div><div><label class="l">Mensualité (€)${c.monthlyAuto ? ' — calculée' : ''}</label><input class="field" data-cr="monthly" data-num type="number" inputmode="decimal" placeholder="${c.monthlyAuto ? fmt(c.monthly, 2) + ' (total ÷ durée)' : ''}" value="${val('credit').monthly || ''}"></div><div><label class="l">Durée totale (mois)</label><input class="field" data-cr="months" data-num type="number" inputmode="numeric" min="1" placeholder="ex. 60" value="${c.months || ''}"></div><div><label class="l">Taux annuel (%) — optionnel</label><input class="field" data-cr="rate" data-num type="number" step="0.01" inputmode="decimal" value="${c.rate ?? ''}"></div><div><label class="l">Date de début</label><input class="field" data-cr="start" type="date" value="${c.start || ''}"></div></div></div>
  <div class="card c6"><h3>🔮 Si j’augmente ma mensualité</h3>${creditScenarios().length ? `<table class="table"><tr><th>Mensualité</th><th>Fin</th><th>Gain</th></tr>${creditScenarios().map(r => `<tr><td>${eur(c.monthly + r.extra)}${r.extra ? ` <span class="chip">+${r.extra} €</span>` : ''}</td><td>${frDate(r.end)}</td><td>${r.saved ? `<span class="chip up">−${r.saved} mois</span>` : '—'}</td></tr>`).join('')}</table>` : '<div class="empty">Renseigne total et mensualité</div>'}</div>
  <div class="card c6"><h3>💡 Stratégie financière (IA)</h3><div class="f2" style="gap:10px"><div><label class="l">${cfg().salaryMode === 'monthly' ? 'Salaire par défaut (€)' : 'Salaire net / mois (€)'}</label><input class="field" data-cfg="netSalary" data-num type="number" inputmode="decimal" value="${cfg().netSalary ?? ''}"></div><div><label class="l">Dépenses / mois (€)</label><input class="field" data-cfg="expenses" data-num type="number" inputmode="decimal" value="${cfg().expenses ?? ''}"></div><div style="grid-column:span 2"><label class="l">Épargne disponible (€)</label><input class="field" data-cfg="savings" data-num type="number" inputmode="decimal" value="${cfg().savings ?? ''}"></div></div><button class="btn pri sm" style="margin-top:12px" data-act="coach" data-m="finance">✨ Me conseiller</button></div>
  ${s.planned.length ? `<div class="card c12"><h3>📅 À venir (${s.planned.length}) · ${eur(s.planned.reduce((a, p) => a + Number(p.amount), 0))}</h3><table class="table"><tr><th>Date</th><th>Nom</th><th>Montant</th><th></th></tr>${s.planned.slice(0, 12).map(p => `<tr><td>${longDate(p.date)} <span class="chip">à venir</span></td><td>${esc(p.name || p.note || '')}</td><td><b>${eur(p.amount)}</b></td><td style="text-align:right"><button class="x" data-act="delpay" data-id="${p.id}" aria-label="Supprimer">${ic('x')}</button></td></tr>`).join('')}</table>${s.planned.length > 12 ? `<p class="sub">+ ${s.planned.length - 12} autres…</p>` : ''}</div>` : ''}
  <div class="card c12"><h3>Versements</h3>${s.pays.length ? `<table class="table"><tr><th>Date</th><th>Montant</th><th>Nom</th><th></th></tr>${s.pays.map(p => `<tr><td>${longDate(p.date)}</td><td><b>${eur(p.amount)}</b></td><td>${esc(p.name || p.note || '')}</td><td style="text-align:right"><button class="x" data-act="delpay" data-id="${p.id}" aria-label="Supprimer">${ic('x')}</button></td></tr>`).join('')}</table>` : '<div class="empty">Aucun remboursement enregistré</div>'}</div></div>`;
}

const CATS = [['Logement', '🏠'], ['Courses', '🛒'], ['Transport', '🚗'], ['Restaurants', '🍽️'], ['Loisirs', '🎬'], ['Santé', '💊'], ['Abonnements', '📱'], ['Shopping', '🛍️'], ['Épargne', '🏦'], ['Autre', '📦']];
const catIcon = c => (CATS.find(x => x[0] === c) || [0, '📦'])[1];
const txs = () => ids('tx:').map(id => ({ id: id.slice(3), ...val(id) })).filter(t => !t.del && t.amount != null);
const recurring = () => ids('rinc:').map(id => ({ id: id.slice(5), ...val(id) })).filter(r => !r.del && r.amount != null); // revenus récurrents (chaque mois)
const sumA = a => a.reduce((s, t) => s + Number(t.amount || 0), 0);
function budgetStats(m) {
  const c = cfg(), cr = credit(), tx = txs().filter(t => (t.date || '').startsWith(m)).sort((a, b) => b.date.localeCompare(a.date));
  const exp = tx.filter(t => t.type !== 'inc'), inc = tx.filter(t => t.type === 'inc');
  const paid = cr.total ? payments().filter(p => (p.date || '').startsWith(m)) : [];
  const creditM = paid.length ? sumA(paid) : (cr.monthly || 0); // versement réel du mois, sinon la mensualité
  const rec = recurring().filter(r => (r.from || '') <= m), salary = salaryFor(m, c) || 0, extra = sumA(inc) + sumA(rec);
  const income = salary + extra, spent = sumA(exp), byCat = {};
  exp.forEach(t => { byCat[t.cat || 'Autre'] = (byCat[t.cat || 'Autre'] || 0) + Number(t.amount); });
  const bud = c.budgets || {}, limit = Object.values(bud).reduce((a, v) => a + (Number(v) || 0), 0);
  const [y, mo] = m.split('-').map(Number), dim = new Date(y, mo, 0).getDate(), cur = today().slice(0, 7);
  const elapsed = m === cur ? new Date().getDate() : m < cur ? dim : 0;
  return { tx, inc, rec, salary, extra, income, spent, byCat, bud, limit, creditM, dim, elapsed, proj: m === cur && elapsed ? spent / elapsed * dim : null, left: income - creditM - spent };
}
function vBudget() {
  const m = ui.bmonth, s = budgetStats(m), c = cfg(), cur = today().slice(0, 7);
  const shift = n => { const d = parse(m + '-01'); d.setMonth(d.getMonth() + n); return ymd(d).slice(0, 7); };
  const days = monthDays(m), pct = s.income ? (s.spent + s.creditM) / s.income : 0;
  const perDay = days.map(d => ({ label: parse(d).getDate(), v: sumA(s.tx.filter(t => t.date === d && t.type !== 'inc')) }));
  return head('Budget', 'Revenus, dépenses et limites par catégorie', `<div class="datebar"><button data-act="bmonth" data-m="${shift(-1)}">${ic('l')}</button><span class="d">${monthName(m)}</span><button data-act="bmonth" data-m="${shift(1)}">${ic('r')}</button></div>`) + `<div class="grid">
  <div class="card c5 hero" style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><h3>Reste du mois</h3><div class="big">${eur(s.left)}</div><p>Revenus ${eur(s.income)}<br>Crédit ${eur(s.creditM)} · Dépenses ${eur(s.spent)}</p></div>${ring('bud', pct, Math.round(pct * 100) + '%', { size: 112 })}</div>
  <div class="card c7"><h3>${ic('plus')}Ajouter</h3><form data-form="tx"><div class="f2" style="gap:10px"><div><label class="l">Montant (€)</label><input class="field" name="amount" type="number" step="0.01" inputmode="decimal" required></div><div><label class="l">Type</label><select class="field" name="type"><option value="exp">Dépense</option><option value="inc">Revenu</option></select></div>
  <div><label class="l">Catégorie</label><select class="field" name="cat">${CATS.map(([n, e]) => `<option>${n}</option>`).join('')}</select></div><div><label class="l">Date</label><input class="field" name="date" type="date" value="${m === cur ? today() : m + '-01'}"></div></div>
  <div class="row" style="margin-top:10px;flex-wrap:nowrap"><input class="field" name="note" placeholder="Note (ex. Carrefour)" maxlength="60"><button class="btn pri">${ic('plus')}Ajouter</button></div></form></div>
  <div class="card c12"><h3>💰 Revenus de ${monthName(m)} · ${eur(s.income)}</h3>
    <div class="grid" style="gap:14px"><div class="c6"><div style="margin-bottom:14px">${salaryInput(m)}</div><div class="list"><div class="item"><div class="grow">💼 Salaire net</div><b>${eur(s.salary)}</b></div>
    ${s.rec.map(r => `<div class="item"><div class="grow"><div class="t">🔁 ${esc(r.name || 'Revenu mensuel')}</div><div class="s">chaque mois depuis ${monthName(r.from)}</div></div><b style="color:var(--ok)">+${eur(r.amount)}</b><button class="x" data-act="delrinc" data-id="${r.id}" aria-label="Arrêter">${ic('x')}</button></div>`).join('')}
    ${s.inc.map(t => `<div class="item"><div class="grow"><div class="t">💰 ${esc(t.note || 'Revenu')}</div><div class="s">${longDate(t.date)}</div></div><b style="color:var(--ok)">+${eur(t.amount)}</b><button class="x" data-act="deltx" data-id="${t.id}" aria-label="Supprimer">${ic('x')}</button></div>`).join('')}
    <div class="item" style="background:rgba(var(--acc-rgb),.14)"><div class="grow"><b>Total des revenus</b></div><b>${eur(s.income)}</b></div></div></div>
    <form class="c6" data-form="inc"><label class="l">Ajouter un revenu supplémentaire</label><div class="f2" style="gap:10px"><div style="grid-column:span 2"><input class="field" name="name" placeholder="Nom (ex. Prime, Freelance, Aide…)" maxlength="60"></div><div><input class="field" name="amount" type="number" step="0.01" inputmode="decimal" placeholder="Montant (€)" required></div><div><input class="field" name="date" type="date" value="${m === cur ? today() : m + '-01'}"></div><div style="grid-column:span 2"><select class="field" name="freq"><option value="once">Ponctuel (ce mois uniquement)</option><option value="monthly">Chaque mois (récurrent)</option></select></div></div><button class="btn pri" style="margin-top:10px;width:100%;justify-content:center">${ic('plus')}Ajouter au revenu mensuel</button></form></div></div>
  <div class="card c7"><h3>Budget par catégorie</h3><div class="list" style="gap:12px">${CATS.map(([n, e]) => { const sp = s.byCat[n] || 0, lim = Number(s.bud[n]) || 0, over = lim && sp > lim; return `<div><div class="row" style="justify-content:space-between;flex-wrap:nowrap;font-size:13px"><span>${e} ${n}${over ? ' <span class="chip down">dépassé</span>' : ''}</span><span style="white-space:nowrap"><b>${eur(sp)}</b> / <input class="field" style="width:88px;padding:4px 8px;display:inline-block" data-bud="${n}" data-num type="number" inputmode="decimal" placeholder="limite" value="${lim || ''}"></span></div><div class="bar" style="height:8px;margin-top:6px"><i style="width:${lim ? Math.min(sp / lim * 100, 100) : sp ? 100 : 0}%;${over ? 'background:var(--bad)' : lim ? '' : 'background:var(--faint)'}"></i></div></div>`; }).join('')}</div>
  <div class="row" style="margin-top:14px;justify-content:space-between"><span class="sub">Total des limites : <b>${eur(s.limit)}</b></span><button class="btn pri sm" data-act="coach" data-m="budget">✨ Conseils budget IA</button></div></div>
  <div class="card c5"><h3>Dépenses par jour</h3>${bars('bd', perDay, { unit: ' €' })}${s.proj != null ? `<p class="sub" style="margin-top:10px">À ce rythme : <b>${eur(s.proj)}</b> de dépenses fin de mois ${s.income && s.proj + s.creditM > s.income ? '<span class="chip down">au-dessus de tes revenus</span>' : '<span class="chip up">OK</span>'}</p>` : ''}</div>
  <div class="card c12"><h3>Opérations du mois (${s.tx.length})</h3>${s.tx.length ? `<div class="list">${s.tx.map(t => `<div class="item"><span style="font-size:20px">${t.type === 'inc' ? '💰' : catIcon(t.cat)}</span><div class="grow"><div class="t">${esc(t.note || t.cat || 'Autre')}</div><div class="s">${esc(t.type === 'inc' ? 'Revenu' : t.cat || 'Autre')} · ${longDate(t.date)}</div></div><b style="color:${t.type === 'inc' ? 'var(--ok)' : 'inherit'}">${t.type === 'inc' ? '+' : '−'}${eur(t.amount)}</b><button class="x" data-act="deltx" data-id="${t.id}" aria-label="Supprimer">${ic('x')}</button></div>`).join('')}</div>` : '<div class="empty">Aucune opération ce mois-ci</div>'}${salaryFor(m, c) ? '' : '<p class="sub">Astuce : renseigne ton salaire net dans Réglages pour calculer ce qu’il te reste.</p>'}</div></div>`;
}
/* ---------- Rappels / notifications push ---------- */
const WD = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const REMS = [
  { k: 'water', i: '💧', t: 'Eau', d: 'Rappels réguliers (arrêtés quand ton objectif du jour est atteint)', def: { start: '09:00', end: '20:00', every: 2 }, f: [['start', 'time', 'Début'], ['end', 'time', 'Fin'], ['every', 'number', 'Toutes les (heures)']] },
  { k: 'sport', i: '🏋️', t: 'Exercice', d: 'À l’heure de ta séance (pas de rappel si déjà notée)', def: { time: '18:00', days: [0, 2, 4] }, f: [['time', 'time', 'Heure'], ['days', 'days', 'Jours']] },
  { k: 'meals', i: '🍽️', t: 'Repas', d: 'Pour noter ce que tu manges (pas de rappel si déjà noté)', def: { b: '08:00', l: '12:30', d: '19:30' }, f: [['b', 'time', 'Petit-déj'], ['l', 'time', 'Déjeuner'], ['d', 'time', 'Dîner']] },
  { k: 'weigh', i: '⚖️', t: 'Pesée', d: 'Pas de rappel si tu t’es déjà pesé', def: { time: '07:00', days: [0, 1, 2, 3, 4, 5, 6], fasting: true }, f: [['time', 'time', 'Heure'], ['fasting', 'fast', 'Conditions'], ['days', 'days', 'Jours']] },
  { k: 'credit', i: '🏦', t: 'Mensualité de crédit', d: 'Avant la date de prélèvement', def: { day: 5, lead: 1, time: '09:00' }, f: [['day', 'number', 'Jour du mois'], ['lead', 'number', 'Prévenir (jours avant)'], ['time', 'time', 'Heure']] },
  { k: 'rent', i: '🏠', t: 'Loyer', d: 'Avant l’échéance', def: { day: 1, lead: 2, time: '09:00', amount: null }, f: [['day', 'number', 'Jour du mois'], ['lead', 'number', 'Prévenir (jours avant)'], ['time', 'time', 'Heure'], ['amount', 'number', 'Montant (€)']] },
  { k: 'bills', i: '🧾', t: 'Autres charges', d: 'Électricité, internet, assurance, abonnements…', def: { time: '09:00', items: [] }, special: 'bills' },
  { k: 'sleep', i: '😴', t: 'Coucher', d: 'Pour tenir ton objectif de sommeil', def: { time: '22:30' }, f: [['time', 'time', 'Heure']] },
  { k: 'evening', i: '📝', t: 'Bilan du soir', d: 'Compléter ta journée (sommeil, humeur)', def: { time: '21:00' }, f: [['time', 'time', 'Heure']] },
  { k: 'budget', i: '💶', t: 'Dépenses du jour', d: 'Noter tes dépenses', def: { time: '20:30' }, f: [['time', 'time', 'Heure']] },
  { k: 'report', i: '📋', t: 'Rapport hebdomadaire', d: 'Chaque lundi matin : réussites en vert, points à rattraper en rouge (actif par défaut)', def: { day: 0, time: '08:00' }, f: [['day', 'weekday', 'Jour'], ['time', 'time', 'Heure']] },
  { k: 'week', i: '📊', t: 'Bilan de la semaine', d: 'Lancer le bilan IA', def: { day: 6, time: '19:00' }, f: [['day', 'weekday', 'Jour'], ['time', 'time', 'Heure']] }
];
function remField(k, r, [fk, type, label]) {
  const a = `data-rem="${k}" data-rk="${fk}"`, v = r[fk];
  if (type === 'days') return `<div style="grid-column:1/-1"><label class="l">${label}</label><div class="chips">${WD.map((d, i) => `<button type="button" class="${(v || []).includes(i) ? 'on' : ''}" data-act="remday" data-k="${k}" data-i="${i}">${d}</button>`).join('')}</div></div>`;
  if (type === 'fast') return `<div style="grid-column:1/-1"><label class="l">${label}</label><div class="seg"><button type="button" class="${v !== false ? 'on' : ''}" data-act="remfast" data-k="${k}" data-v="1">À jeun</button><button type="button" class="${v === false ? 'on' : ''}" data-act="remfast" data-k="${k}" data-v="0">Pas à jeun</button></div></div>`;
  if (type === 'weekday') return `<div><label class="l">${label}</label><select class="field" ${a}>${WD.map((d, i) => `<option value="${i}" ${Number(v) === i ? 'selected' : ''}>${d}</option>`).join('')}</select></div>`;
  return `<div><label class="l">${label}</label><input class="field" ${a} type="${type}" ${type === 'number' ? 'inputmode="decimal"' : ''} value="${v ?? ''}"></div>`;
}
function vReminders() {
  const rem = val('rem'), st = ui.push || 'unknown';
  const msg = { unsupported: 'Ce navigateur ne gère pas les notifications. Sur iPhone : installe d’abord l’app (Partager → Sur l’écran d’accueil) puis ouvre-la depuis l’icône.', denied: 'Notifications bloquées : autorise-les dans les réglages du navigateur pour ce site.', on: 'Activées sur cet appareil ✓', off: 'Désactivées sur cet appareil.', unknown: 'Vérification…' }[st];
  const cards = REMS.map(R => { const r = { ...R.def, ...(rem[R.k] || {}) }, on = R.k === 'report' ? !(rem.report && rem.report.on === false) : !!(rem[R.k] && rem[R.k].on);
    const body = !on ? '' : R.special === 'bills' ? `<div class="list" style="margin-top:12px">${(r.items || []).map(b => `<div class="item"><div class="grow"><div class="t">${esc(b.name)}</div><div class="s">le ${b.day} du mois · prévenir ${b.lead} j avant${b.amount ? ' · ' + eur(b.amount) : ''}</div></div><button class="x" data-act="delbill" data-id="${b.id}" aria-label="Supprimer">${ic('x')}</button></div>`).join('') || '<div class="empty">Aucune charge ajoutée</div>'}</div>
      <form data-form="bill" style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><input class="field" name="name" placeholder="Nom (ex. Internet)" required style="grid-column:1/-1"><input class="field" name="day" type="number" min="1" max="31" placeholder="Jour" required><input class="field" name="lead" type="number" min="0" max="14" placeholder="Jours avant" value="1"><input class="field" name="amount" type="number" step="0.01" placeholder="€"><button class="btn pri sm" style="grid-column:1/-1;justify-content:center">${ic('plus')}Ajouter</button></form><div style="margin-top:10px">${remField(R.k, r, ['time', 'time', 'Heure du rappel'])}</div>`
      : `<div class="f2" style="margin-top:12px;gap:10px">${R.f.map(f => remField(R.k, r, f)).join('')}</div>`;
    return `<div class="card c6"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div><h3 style="margin:0">${R.i} ${R.t}</h3><div class="sub">${R.d}</div></div><button class="sw ${on ? 'on' : ''}" data-act="remtoggle" data-k="${R.k}" aria-label="Activer ${R.t}"></button></div>${body}</div>`; }).join('');
  return head('Rappels', 'Notifications push, même quand l’app est fermée') + `<div class="grid" style="align-items:start"><div class="card c12"><h3>${ic('bell')}Notifications de cet appareil</h3><p style="margin:0 0 12px">${msg}</p><div class="row">${st === 'on' ? '<button class="btn pri" data-act="pushtest">Envoyer un test</button><button class="btn" data-act="pushoff">Désactiver ici</button>' : st === 'off' || st === 'unknown' ? '<button class="btn pri" data-act="pushon">🔔 Activer les notifications</button>' : ''}</div><p class="sub" style="margin-bottom:0">Chaque appareil (PC, téléphone) s’active séparément. Les rappels déjà faits (eau atteinte, pesée saisie…) ne sont pas envoyés.</p></div>${cards}</div>`;
}
const b64u = k => { const p = '='.repeat((4 - k.length % 4) % 4), b = atob((k + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function pushState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try { const reg = await navigator.serviceWorker.ready; return (await reg.pushManager.getSubscription()) ? 'on' : 'off'; } catch { return 'off'; }
}
async function ensureSub(force) { // (ré)abonne cet appareil et enregistre l'abonnement sur le serveur
  if ((await pushState()) === 'unsupported') throw new Error('Notifications non supportées ici (sur iPhone : installe d’abord l’app sur l’écran d’accueil).');
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Permission refusée');
  const j = await (await fetch('/api/vapid')).json(); if (!j.key) throw new Error(j.error || 'Clé serveur manquante');
  const reg = await navigator.serviceWorker.ready; let sub = await reg.pushManager.getSubscription();
  if (sub && force) { await sub.unsubscribe(); sub = null; }
  sub = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(j.key) });
  const o = sub.toJSON(), { error } = await sb.from('push_subs').upsert({ endpoint: o.endpoint, p256dh: o.keys.p256dh, auth: o.keys.auth, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }, { onConflict: 'endpoint' });
  if (error) throw error;
}
async function refreshPush() {
  const st = await pushState(); if (ui.push !== st) { ui.push = st; if (ui.tab === 'reminders') render(true); }
  if (st === 'on' && S.token) ensureSub(false).catch(() => { }); // remet l'abonnement sur le serveur s'il a disparu
}
function vSettings() {
  const c = cfg(), th = theme(), n = (k, l, step = '1', ph = '') => `<div><label class="l">${l}</label><input class="field" data-cfg="${k}" data-num type="number" step="${step}" inputmode="decimal" placeholder="${ph}" value="${c[k] ?? ''}"></div>`;
  return head('Réglages', 'Objectifs, apparence et synchronisation') + `<div class="grid">
  <div class="card c6"><h3>Profil & objectifs</h3><div class="f2" style="gap:12px"><div style="grid-column:span 2"><label class="l">Prénom</label><input class="field" data-cfg="name" value="${esc(c.name)}"></div>
    ${n('goalWeight', 'Poids objectif (kg)', '0.1')}${n('startWeight', 'Poids de départ (kg)', '0.1', 'auto')}${n('height', 'Taille (cm)')}${n('kcalGoal', 'Objectif calories / jour (manuel)')}${n('burnShare', 'Part des kcal sport ajoutée (%)', '5', '50')}${n('waterGoalL', 'Eau (litres / jour)', '0.1', '2')}${n('sportTarget', 'Séances / semaine')}${n('protGoal', 'Protéines (g/jour)', '1', 'auto')}${n('carbGoal', 'Glucides (g/jour)', '1', 'auto')}${n('fatGoal', 'Lipides (g/jour)', '1', 'auto')}${n('weekHours', 'Horaires hebdomadaires (h)', '0.25', 'ex. 35')}<div style="grid-column:span 2"><label class="l">Salaire</label><div class="seg"><button class="${c.salaryMode !== 'monthly' ? 'on' : ''}" data-act="salmode" data-v="fixed">Fixe</button><button class="${c.salaryMode === 'monthly' ? 'on' : ''}" data-act="salmode" data-v="monthly">Variable (chaque mois)</button></div><p class="sub" style="margin:6px 0 0">${c.salaryMode === 'monthly' ? 'Saisis ton salaire du mois dans Budget ou Travail. Si tu l\'oublies, le dernier mois renseigné est repris.' : 'Le même salaire chaque mois.'}</p></div>${n('netSalary', c.salaryMode === 'monthly' ? 'Salaire par défaut (€)' : 'Salaire net / mois (€)', '1')}</div><button class="btn pri" style="margin-top:16px;width:100%;justify-content:center" data-act="savecfg">💾 Enregistrer et synchroniser</button></div>
  <div class="card c6"><h3>Apparence</h3><label class="l">Couleur (synchronisée)</label><div class="swatches">${Object.entries(ACCENTS).map(([k, v]) => `<button class="${c.accent === k ? 'on' : ''}" style="background:rgb(${v})" data-act="accent" data-v="${k}" aria-label="${k}"></button>`).join('')}</div>
    <label class="l" style="margin-top:18px">Thème (synchronisé)</label><div class="seg">${[['dark', 'Sombre'], ['light', 'Clair']].map(([k, l]) => `<button class="${th === k ? 'on' : ''}" data-act="theme" data-v="${k}">${l}</button>`).join('')}</div>
    <h3 style="margin-top:24px">Synchronisation</h3><p class="sub" data-sync>${syncHtml()}</p><p class="sub">Tout ce que tu saisis est enregistré sur ton appareil puis envoyé au serveur ; tes autres appareils se mettent à jour en direct.</p>
    <div class="row" style="margin-top:10px">${installEvt ? `<button class="btn pri" data-act="install">Installer l’application</button>` : ''}<button class="btn" data-act="export">Exporter (JSON)</button><label class="btn" style="cursor:pointer">Importer<input type="file" accept="application/json" id="imp" hidden></label><button class="btn danger" data-act="logout">Se déconnecter</button></div></div></div>`;
}

function vBilling() { // module chargé à la demande, uniquement pour le propriétaire
  if (window.Billing) return window.Billing.view();
  if (!ui.billingLoading) {
    ui.billingLoading = true;
    (async () => { try { for (const f of ['/vendor/jspdf.min.js', '/vendor/jspdf-autotable.min.js', '/billing.js']) await new Promise((ok, ko) => { const el = document.createElement('script'); el.src = f; el.onload = ok; el.onerror = () => ko(new Error(f)); document.head.appendChild(el); }); } catch (e) { toast('Chargement impossible : ' + e.message); ui.billingLoading = false; return; } render(true); })();
  }
  return head('Facturation', 'Réservé au propriétaire') + '<div class="card c12">Chargement…</div>';
}
const VIEWS = { report: vReport, billing: vBilling, reminders: vReminders, budget: vBudget, home: vHome, today: vToday, weight: vWeight, sport: vSport, food: vFood, work: vWork, credit: vCredit, settings: vSettings };

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
    const y = window.scrollY; if (ui.tab === 'billing' && !ui.owner) ui.tab = 'home';
    const nav = TABS.filter(t => t[0] !== 'billing' || ui.owner).map(([k, l]) => `<a data-act="go" data-to="${k}" class="${ui.tab === k ? 'on' : ''}">${ic(k)}<span>${l}</span></a>`).join('');
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
  goday: el => { ui.date = el.dataset.d; go('today', true); },
  pickday: el => { ui.date = el.dataset.d; render(true); setTimeout(() => $('#sportday')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80); },
  dday: el => { ui.date = addDays(ui.date, Number(el.dataset.n)); render(true); },
  dtoday: () => { ui.date = today(); render(true); },
  range: el => { ui.range = Number(el.dataset.r); render(true); },
  month: el => { ui.month = el.dataset.m; render(true); },
  set: el => { const k = el.dataset.k, cur = day(ui.date)[k]; let v = el.hasAttribute('data-num') ? Number(el.dataset.v) : el.dataset.v; if (cur === v && k !== 'work') v = undefined; setDay({ [k]: v }); },
  'set-today': el => { put('day:' + today(), { [el.dataset.k]: el.dataset.v }); toast('Enregistré ✓'); },
  'water-today': () => { put('day:' + today(), { waterL: r2((waterOf(today()) || 0) + 0.25) }); toast('💧 +0,25 L'); },
  water: el => setDay({ waterL: r2(Math.max(0, (waterOf(ui.date) || 0) + Number(el.dataset.n))) }),
  delmeal: el => setDay({ meals: (day(ui.date).meals || []).filter(m => m.id !== el.dataset.id) }),
  quickmeal: el => setDay({ meals: [...(day(ui.date).meals || []), { id: uid(), name: el.dataset.name, kcal: Number(el.dataset.kcal) || 0, ...(el.dataset.p !== '' ? { p: Number(el.dataset.p), c: Number(el.dataset.c), f: Number(el.dataset.f) } : {}), slot: el.dataset.slot }] }),
  delweight: el => put('day:' + el.dataset.d, { weight: null }),
  calcycle: el => { const d = el.dataset.d, order = [undefined, 'work', 'off', 'leave'], cur = day(d).work; put('day:' + d, { work: order[(order.indexOf(cur) + 1) % 4] }); },
  savecfg: async () => {
    document.activeElement?.blur?.(); await new Promise(r => setTimeout(r, 80));
    put('cfg', val('cfg')); put('credit', val('credit')); // ré-envoie tous les paramètres
    for (let i = 0; i < 20 && (flushing || Object.keys(S.pending).length); i++) { await flush(); await new Promise(r => setTimeout(r, 150)); }
    await pull();
    toast(Object.keys(S.pending).length ? 'Enregistré — synchro dès que le réseau revient' : 'Paramètres enregistrés et synchronisés ✓');
  },
  fillmacros: async el => {
    el.disabled = true; el.textContent = '✨ Calcul…'; const d = ui.date, meals = [...(day(d).meals || [])];
    for (const m of meals) if (m.p == null) { try { const r = await estimate(m.name); Object.assign(m, { p: r.p, c: r.c, f: r.f }); if (!m.kcal) m.kcal = r.total; } catch (e) { toast(e.message); break; } }
    put('day:' + d, { meals });
  },
  copymon: () => { const m = cfg().sched?.[0]; if (!m) return toast('Renseigne d’abord le lundi'); const sc = { ...(cfg().sched) }; for (let i = 1; i < 5; i++) sc[i] = { ...m }; put('cfg', { sched: sc }); toast('Lundi copié sur lun–ven'); },
  clearsched: () => { if (confirm('Effacer l’emploi du temps type ?')) put('cfg', { sched: null }); },
  bmonth: el => { ui.bmonth = el.dataset.m; render(true); },
  delrinc: el => { put('rinc:' + el.dataset.id, { del: true }); toast('Revenu récurrent arrêté'); },
  deltx: el => { put('tx:' + el.dataset.id, { del: true }); toast('Opération supprimée'); },
  remtoggle: el => { const k = el.dataset.k, R = REMS.find(x => x.k === k), cur = val('rem')[k], curOn = k === 'report' ? !(cur && cur.on === false) : !!(cur && cur.on); put('rem', { [k]: { ...R.def, ...(cur || {}), on: !curOn } }); },
  remday: el => { const k = el.dataset.k, i = Number(el.dataset.i), R = REMS.find(x => x.k === k), r = { ...R.def, ...(val('rem')[k] || {}) }, d = new Set(r.days || []); d.has(i) ? d.delete(i) : d.add(i); put('rem', { [k]: { ...r, days: [...d].sort() } }); },
  remfast: el => { const k = el.dataset.k, R = REMS.find(x => x.k === k); put('rem', { [k]: { ...R.def, ...(val('rem')[k] || {}), fasting: el.dataset.v === '1' } }); },
  delbill: el => { const r = { ...REMS[6].def, ...(val('rem').bills || {}) }; put('rem', { bills: { ...r, items: r.items.filter(b => b.id !== el.dataset.id) } }); },
  pushon: async () => {
    try { await ensureSub(false); toast('Notifications activées ✓'); } catch (e) { toast(e.message || 'Activation impossible'); }
    refreshPush();
  },
  pushon_old: async () => {
    try {
      if ((await pushState()) === 'unsupported') throw new Error('Notifications non supportées ici (sur iPhone : installe d’abord l’app sur l’écran d’accueil).');
      if ((await Notification.requestPermission()) !== 'granted') throw new Error('Permission refusée');
      const j = await (await fetch('/api/vapid')).json(); if (!j.key) throw new Error(j.error || 'Clé serveur manquante');
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(j.key) });
      const o = sub.toJSON(), { error } = await sb.from('push_subs').upsert({ endpoint: o.endpoint, p256dh: o.keys.p256dh, auth: o.keys.auth, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }, { onConflict: 'endpoint' });
      if (error) throw error;
      toast('Notifications activées ✓');
    } catch (e) { toast(e.message || 'Activation impossible'); }
    refreshPush();
  },
  pushoff: async () => { try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (sub) { await sb.from('push_subs').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); } toast('Notifications désactivées'); } catch (e) { toast('Erreur : ' + e.message); } refreshPush(); },
  pushtest: async () => {
    const { data } = await sb.auth.getSession();
    const call = () => fetch('/api/push-test', { method: 'POST', headers: { Authorization: 'Bearer ' + (data.session?.access_token || '') } }).catch(() => null);
    let r = await call(), j = r ? await r.json().catch(() => ({})) : {};
    if (r && (r.status === 404 || (r.ok && !j.sent))) { // abonnement perdu ou refusé : on se réabonne proprement puis on réessaie
      try { toast('Réabonnement de cet appareil…'); await ensureSub(true); r = await call(); j = r ? await r.json().catch(() => ({})) : {}; } catch (e) { return toast(e.message); }
    }
    toast(r && r.ok && j.sent ? `Test envoyé à ${j.sent}/${j.total} appareil(s)` : (j.error || 'Test impossible'));
  },
  salmode: el => put('cfg', { salaryMode: el.dataset.v }),
  cfgset: el => { if (el.dataset.k === 'goalType') ui.goalEdit = true; const k = el.dataset.k, cur = cfg()[k]; put('cfg', { [k]: cur === el.dataset.v && k === 'goalType' ? cur : el.dataset.v }); },
  goaledit: () => { ui.goalEdit = true; render(true); },
  goaldone: () => { ui.goalEdit = false; render(true); },
  repweek: el => { const cur = ui.repWeek || lastWeek(), nx = addDays(cur, 7 * Number(el.dataset.n)); ui.repWeek = nx > lastWeek() ? lastWeek() : nx; render(true); },
  repmode: el => { ui.repMode = el.dataset.v; render(true); },
  repday: el => { const nx = addDays(ui.repDay || today(), Number(el.dataset.n)); ui.repDay = nx > today() ? today() : nx; render(true); },
  openweek: () => { ui.repMode = 'week'; ui.repWeek = null; go('report'); },
  reportpdf: () => reportPdf(),
  coach: el => coach(el.dataset.m),
  addpay: () => payModal(),
  delpay: el => { if (confirm('Supprimer ce versement ?')) put('pay:' + el.dataset.id, { del: true }); },
  accent: el => { put('cfg', { accent: el.dataset.v }); },
  theme: el => { LS.set('ld_theme', el.dataset.v); put('cfg', { theme: el.dataset.v }); },
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
  else if (el.dataset.sched !== undefined) { const sc = { ...(cfg().sched || {}) }, i = el.dataset.sched; sc[i] = { ...(sc[i] || {}), [el.dataset.k]: el.dataset.k === 'b' ? numv(el) : (el.value || null) }; put('cfg', { sched: sc }); }
  else if (el.dataset.rem !== undefined) { const k = el.dataset.rem, R = REMS.find(x => x.k === k), cur = { ...R.def, ...(val('rem')[k] || {}) }, t = el.type; cur[el.dataset.rk] = t === 'number' ? numv(el) : t === 'select-one' ? Number(el.value) : el.value; put('rem', { [k]: cur }); }
  else if (el.dataset.sal !== undefined) put('sal:' + el.dataset.sal, { amount: numv(el) });
  else if (el.dataset.bud !== undefined) put('cfg', { budgets: { ...(cfg().budgets || {}), [el.dataset.bud]: numv(el) } });
  else if (el.dataset.cfg) put('cfg', { [el.dataset.cfg]: conv() });
  else if (el.dataset.cr) put('credit', { [el.dataset.cr]: conv() });
});
document.addEventListener('submit', async e => {
  const f = e.target; if (!f.dataset.form) return; e.preventDefault();
  const fd = Object.fromEntries(new FormData(f));
  if (f.dataset.form === 'meal') {
    const typed = Number(fd.kcal) || 0, meal = { id: uid(), name: fd.name.trim(), kcal: typed, slot: fd.slot };
    const btn = $('[data-ai]', f); btn.disabled = true; btn.textContent = '✨ Calcul…';
    try { const r = await estimate(fd.name); meal.kcal = typed || r.total; Object.assign(meal, { p: r.p, c: r.c, f: r.f }); toast(`✨ ≈ ${meal.kcal} kcal · P ${r.p} · G ${r.c} · L ${r.f}`); } catch (err) { toast(err.message || 'Estimation indisponible'); }
    setDay({ meals: [...(day(ui.date).meals || []), meal] });
  } else if (f.dataset.form === 'login') {
    await auth(fd, false);
  } else if (f.dataset.form === 'bill') {
    const r = { ...REMS[6].def, ...(val('rem').bills || {}), on: true };
    put('rem', { bills: { ...r, items: [...(r.items || []), { id: uid(), name: fd.name.trim(), day: Number(fd.day), lead: Number(fd.lead) || 0, amount: Number(fd.amount) || null }] } }); toast('Charge ajoutée ✓');
  } else if (f.dataset.form === 'inc') {
    if (!(Number(fd.amount) > 0)) return;
    const d = fd.date || today();
    if (fd.freq === 'monthly') put('rinc:' + uid(), { name: fd.name?.trim() || null, amount: Number(fd.amount), from: d.slice(0, 7) });
    else put('tx:' + uid(), { date: d, amount: Number(fd.amount), cat: 'Autre', type: 'inc', note: fd.name?.trim() || 'Revenu' });
    toast(fd.freq === 'monthly' ? 'Revenu mensuel ajouté ✓' : 'Revenu ajouté ✓');
  } else if (f.dataset.form === 'tx') {
    if (!(Number(fd.amount) > 0)) return;
    put('tx:' + uid(), { date: fd.date || today(), amount: Number(fd.amount), cat: fd.cat, type: fd.type, note: fd.note?.trim() || null }); toast(fd.type === 'inc' ? 'Revenu ajouté ✓' : 'Dépense ajoutée ✓');
  } else if (f.dataset.form === 'pay') {
    if (!fd.amount || Number(fd.amount) <= 0) return;
    const start = fd.date || today(), n = fd.repeat === 'monthly' ? Math.min(Math.max(parseInt(fd.count) || 12, 2), 120) : 1, name = (fd.name || '').trim() || null;
    const [y, m, d0] = start.split('-').map(Number);
    for (let i = 0; i < n; i++) { // chaque mois à la même date (ramenée au dernier jour si le mois est plus court)
      const last = new Date(y, m - 1 + i + 1, 0).getDate(), dt = new Date(y, m - 1 + i, Math.min(d0, last));
      put('pay:' + uid(), { date: ymd(dt), amount: Number(fd.amount), name: name ? (n > 1 ? `${name} (${i + 1}/${n})` : name) : null });
    }
    closeModal(); toast(n > 1 ? `${n} remboursements planifiés ✓` : start > today() ? 'Remboursement planifié ✓' : 'Remboursement ajouté ✓');
  }
});
async function estimate(text) {
  const { data } = await sb.auth.getSession();
  const r = await fetch('/api/kcal', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data.session?.access_token || '') }, body: JSON.stringify({ text }) }).catch(() => null);
  if (!r) throw new Error('Hors-ligne : kcal à saisir à la main');
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Estimation indisponible');
  return j;
}
async function coach(mode) {
  const o = openModal(`<h2>${{ week: '✨ Bilan de ma semaine', finance: '✨ Conseils financiers', nutrition: '✨ Conseils nutrition', report: '✨ Résumé du rapport', budget: '✨ Conseils budget' }[mode]}</h2><div id="coach" class="sub" style="white-space:pre-wrap;margin-top:12px;line-height:1.6;font-size:15px;color:var(--text)">Analyse en cours…</div><div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn" onclick="document.getElementById('ov').remove()">Fermer</button></div>`, 'wide');
  const box = $('#coach', o);
  try {
    const { data } = await sb.auth.getSession();
    const r = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (data.session?.access_token || '') }, body: JSON.stringify({ mode, data: coachData(mode) }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Analyse indisponible');
    box.innerHTML = esc(j.text + (j.truncated ? '\n\n… (réponse coupée : relance pour une version plus courte)' : '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  } catch (e) { box.textContent = e.message === 'Failed to fetch' ? 'Hors-ligne : réessaie avec du réseau.' : e.message; }
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
  const o = openModal(`<form data-form="pay"><h2 style="margin-bottom:14px">Nouveau remboursement</h2>
  <label class="l">Nom</label><input class="field" name="name" placeholder="ex. Mensualité, Remboursement anticipé…" maxlength="60">
  <div class="f2" style="margin-top:12px"><div><label class="l">Date (ou date de début)</label><input class="field" type="date" name="date" value="${today()}"></div><div><label class="l">Montant (€)</label><input class="field" type="number" step="0.01" name="amount" inputmode="decimal" value="${credit().monthly || ''}" required></div></div>
  <div class="f2" style="margin-top:12px"><div><label class="l">Répétition</label><select class="field" name="repeat" onchange="document.getElementById('cnt').style.display=this.value==='monthly'?'block':'none'"><option value="once">Une seule fois</option><option value="monthly">Chaque mois</option></select></div><div id="cnt" style="display:none"><label class="l">Nombre de mensualités</label><input class="field" type="number" name="count" min="2" max="120" value="12" inputmode="numeric"></div></div>
  <p class="sub" style="margin:10px 0 0">Une date future crée un remboursement « à venir » : il ne compte comme remboursé qu’à partir de sa date.</p>
  <div class="row" style="margin-top:16px;justify-content:flex-end"><button type="button" class="btn" onclick="document.getElementById('ov').remove()">Annuler</button><button class="btn pri">Ajouter</button></div></form>`);
  $('input[name=amount]', o).focus();
}
function palette() {
  const cmds = [
    ...TABS.map(([k, l]) => ({ l: 'Aller à ' + l, h: 'navigation', f: () => go(k), i: k })),
    { l: 'Sport fait aujourd’hui', h: 'action', i: 'sport', f: () => ACTS['set-today']({ dataset: { k: 'sport', v: 'done' } }) },
    { l: 'J’ai travaillé aujourd’hui', h: 'action', i: 'work', f: () => ACTS['set-today']({ dataset: { k: 'work', v: 'work' } }) },
    { l: 'Ajouter 0,25 L d’eau', h: 'action', i: 'today', f: () => ACTS['water-today']() },
    { l: 'Entrer mon poids', h: 'action', i: 'weight', f: () => { ui.date = today(); go('weight'); setTimeout(() => $('[data-day=weight]')?.focus(), 150); } },
    { l: 'Rapports (journalier / hebdomadaire)', h: 'navigation', i: 'report', f: () => go('report') },
    { l: 'Ajouter une dépense', h: 'action', i: 'budget', f: () => { go('budget'); setTimeout(() => $('form[data-form=tx] [name=amount]')?.focus(), 200); } },
    { l: 'Ajouter un remboursement', h: 'action', i: 'credit', f: payModal },
    { l: 'Thème clair / sombre', h: 'action', i: 'settings', f: () => { const v = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; LS.set('ld_theme', v); put('cfg', { theme: v }); } },
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
render(true); refreshPush();
sb.auth.getSession().then(({ data }) => { if (data.session) { const own = data.session.user?.app_metadata?.owner === true; if (own !== ui.owner) { ui.owner = own; LS.set('ld_owner', own); render(true); } if (!S.token) { S.token = true; LS.set('ld_token', true); render(true); } connect(); pull(); flush(); } else if (S.token && navigator.onLine) localLogout(); });
window.__life = { S, put, val, ui, go, api: { sb, toast, render, esc, ic, head, today, addDays, uid, put } }; // utile pour les tests
})();
