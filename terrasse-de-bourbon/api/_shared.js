/* Commun aux fonctions d'envoi (le préfixe « _ » empêche Vercel d'en faire une adresse publique). */
const VAPID_PUBLIC_KEY = 'BLq0pgWzAk1wm4vKIawA2RADZbURpd80QAoR-PRWAJADxUvf1bNLShXyLgKajSEibXOCd8ETxGygTyHW065Ro1w';
const SITE = 'https://app-terrasse-de-bourbon.vercel.app';
const SUPABASE_URL = 'https://cffggtvlslfepiihlmpm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-zT9LvvD8Fts0dvS4A-uRA_53S7lClf';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function dateFr(iso, short){
  const d = new Date(iso + 'T12:00:00Z');
  return short ? JOURS[d.getUTCDay()].slice(0, 3) + '. ' + d.getUTCDate() + ' ' + MOIS[d.getUTCMonth()].slice(0, 4) + (MOIS[d.getUTCMonth()].length > 4 ? '.' : '')
               : JOURS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MOIS[d.getUTCMonth()];
}
/* Appel interne : seul Supabase connaît le secret partagé. */
function authorized(req){ const s = process.env.NOTIFY_SECRET; return !!s && req.headers['x-notify-secret'] === s; }
function body(req){ return typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {}); }

module.exports = { VAPID_PUBLIC_KEY, SITE, SUPABASE_URL, SUPABASE_KEY, dateFr, authorized, body };
