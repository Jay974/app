/* Envoi des notifications push à l'équipe.
   Appelée par Supabase (déclencheur sur les nouvelles demandes, voir supabase-push.sql), jamais par le navigateur.
   Variables d'environnement Vercel : VAPID_PRIVATE_KEY et NOTIFY_SECRET. */
const webpush = require('web-push');

const VAPID_PUBLIC_KEY = 'BAgWPN-sk_-M_UJWcu0UHxNa3M1wKBFuxFJ-KYa2YUiH7O6rV-ovfVj1JOs72af8nIoUzdSIfBq5m25eBVoht34';
const SITE = 'https://app-terrasse-de-bourbon.vercel.app';
const SUPABASE_URL = 'https://cffggtvlslfepiihlmpm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-zT9LvvD8Fts0dvS4A-uRA_53S7lClf';

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function dateFr(iso){ const d = new Date(iso + 'T12:00:00Z'); return JOURS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MOIS[d.getUTCMonth()]; }

module.exports = async (req, res) => {
  if(req.method !== 'POST') return res.status(405).end();
  const secret = process.env.NOTIFY_SECRET;
  if(!secret || req.headers['x-notify-secret'] !== secret) return res.status(401).end();
  if(!process.env.VAPID_PRIVATE_KEY) return res.status(500).json({ error: 'VAPID_PRIVATE_KEY manquante' });
  webpush.setVapidDetails(SITE, VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const r = body.reservation || {}, subs = Array.isArray(body.subscriptions) ? body.subscriptions : [];
  const payload = JSON.stringify({
    title: 'Nouvelle demande de réservation',
    body: r.name + ' · ' + r.guests + ' pers. · ' + dateFr(r.date) + ' à ' + r.time,
    tag: 'resa-' + r.id,
    url: '/equipe',
    badge: body.pending || 0
  });

  const gone = []; let sent = 0, failed = 0;
  await Promise.all(subs.map(s => webpush.sendNotification(s, payload, { TTL: 6 * 3600, urgency: 'high' })
    .then(() => { sent++; })
    .catch(e => { if(e.statusCode === 404 || e.statusCode === 410) gone.push(s.endpoint); else { failed++; console.error('push', e.statusCode || '', e.body || e.message); } })));

  // Appareils désinstallés ou abonnements expirés : on les retire de la liste.
  if(gone.length){
    await fetch(SUPABASE_URL + '/rest/v1/rpc/prune_push_subscriptions', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_secret: secret, p_endpoints: gone })
    }).catch(() => {});
  }
  res.status(200).json({ sent, failed, removed: gone.length });
};
