// Logique pure des rappels : quels rappels sont dus à cette minute (fuseau de l'utilisateur) ?
const toMin = t => { if (!t || typeof t !== 'string') return null; const [h, m] = t.split(':').map(Number); return isNaN(h) ? null : h * 60 + (m || 0); };
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const eur = n => Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const WINDOW = 3; // tolérance (minutes) si le déclencheur a un peu de retard

function localParts(tz, d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(d).map(x => [x.type, x.value]));
  const h = p.hour === '24' ? 0 : Number(p.hour);
  return { date: `${p.year}-${p.month}-${p.day}`, min: h * 60 + Number(p.minute), wd: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) };
}
const due = (t, now) => { const m = toMin(t); return m != null && m <= now && now - m <= WINDOW; };
// échéance mensuelle : renvoie le nombre de jours restants si aujourd'hui est le jour du rappel
function monthlyLead(localDate, day, lead) {
  const [y, m, d] = localDate.split('-').map(Number);
  for (const off of [0, 1]) {
    const dim = new Date(y, m + off, 0).getDate(), target = new Date(y, m - 1 + off, Math.min(Number(day) || 1, dim));
    const notify = new Date(target); notify.setDate(notify.getDate() - (Number(lead) || 0));
    if (ymd(notify) === localDate) return Number(lead) || 0;
  }
  return null;
}
const when = n => n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : `dans ${n} jours`;

function computeDue({ rem = {}, cfg = {}, credit = {}, day = {}, local }) {
  const out = [], now = local.min, push = (key, title, body, url) => out.push({ key, title, body, url });
  const on = k => rem[k] && rem[k].on;
  const meals = Array.isArray(day.meals) ? day.meals : [];
  if (on('water')) {
    const drunk = day.waterL ?? (day.water != null ? day.water * 0.25 : 0), goal = cfg.waterGoalL ?? (cfg.waterGoal ? cfg.waterGoal * 0.25 : 2), r = rem.water, s = toMin(r.start), e = toMin(r.end), step = Math.max(1, Number(r.every) || 2) * 60;
    if (s != null && e != null && drunk < goal) for (let t = s; t <= e; t += step) if (now >= t && now - t <= WINDOW) push(`water:${t}`, '💧 Hydratation', `Pense à boire un verre d'eau (${Math.round(drunk * 100) / 100}/${Math.round(goal * 100) / 100} L aujourd'hui).`, '/#/today');
  }
  if (on('sport') && (rem.sport.days || []).includes(local.wd) && due(rem.sport.time, now) && !day.sport) push('sport', '🏋️ Exercice', "C'est l'heure de ta séance. Même 20 minutes comptent !", '/#/sport');
  if (on('meals')) for (const [k, slot, label] of [['b', 'Petit-déj', 'ton petit-déjeuner'], ['l', 'Déjeuner', 'ton déjeuner'], ['d', 'Dîner', 'ton dîner']]) if (due(rem.meals[k], now) && !meals.some(m => m.slot === slot)) push('meal:' + k, '🍽️ Repas', `Note ${label} dans l'app : les calories et macros se calculent toutes seules.`, '/#/food');
  if (on('weigh') && (rem.weigh.days || [0, 1, 2, 3, 4, 5, 6]).includes(local.wd) && due(rem.weigh.time, now) && day.weight == null)
    push('weigh', '⚖️ Pesée', rem.weigh.fasting !== false ? 'Pesée à jeun : après les toilettes, avant de manger ou boire, sans vêtements lourds.' : 'Pense à te peser, à la même heure et dans les mêmes conditions que d\'habitude.', '/#/weight');
  const monthly = (k, icon, label, amount) => {
    const r = rem[k]; if (!on(k) || !due(r.time || '09:00', now)) return;
    const n = monthlyLead(local.date, r.day, r.lead); if (n == null) return;
    push(`${k}:${local.date}`, `${icon} ${label}`, `${label} ${when(n)}${amount ? ' · ' + eur(amount) : ''}.`, k === 'credit' ? '/#/credit' : '/#/budget');
  };
  monthly('credit', '🏦', 'Mensualité de crédit', credit.monthly);
  monthly('rent', '🏠', 'Loyer', rem.rent && rem.rent.amount);
  if (on('bills')) for (const b of rem.bills.items || []) {
    if (!due(rem.bills.time || '09:00', now)) continue;
    const n = monthlyLead(local.date, b.day, b.lead); if (n != null) push(`bill:${b.id}:${local.date}`, `🧾 ${b.name}`, `${b.name} ${when(n)}${b.amount ? ' · ' + eur(b.amount) : ''}.`, '/#/budget');
  }
  if (on('sleep') && due(rem.sleep.time, now)) push('sleep', '😴 Coucher', "Il est bientôt l'heure de dormir : un bon sommeil aide ton poids et ton humeur.", '/#/today');
  if (on('evening') && due(rem.evening.time, now) && (day.sleep == null || day.mood == null)) push('evening', '📝 Bilan du soir', 'Prends 1 minute pour compléter ta journée (repas, eau, humeur).', '/#/today');
  if (on('budget') && due(rem.budget.time, now)) push('budget', '💶 Dépenses du jour', 'As-tu noté tes dépenses du jour ?', '/#/budget');
  if (on('week') && Number(rem.week.day) === local.wd && due(rem.week.time, now)) push('week', '📊 Bilan de la semaine', "Ton bilan hebdo est prêt : lance le bilan IA dans l'onglet Poids.", '/#/weight');
  return out;
}
module.exports = { computeDue, localParts, monthlyLead };
