/* Envoi des notifications push à l'équipe.
   Appelée par Supabase (déclencheurs : nouvelle demande, annulation par le client ; voir supabase-push.sql), jamais par le navigateur.
   Variables d'environnement Vercel : VAPID_PRIVATE_KEY et NOTIFY_SECRET. */
const webpush = require('web-push');
const { VAPID_PUBLIC_KEY, SITE, SUPABASE_URL, SUPABASE_KEY, dateFr, authorized, body: readBody } = require('./_shared');

module.exports = async (req, res) => {
  if(req.method !== 'POST') return res.status(405).end();
  if(!authorized(req)) return res.status(401).end();
  const secret = process.env.NOTIFY_SECRET;
  if(!process.env.VAPID_PRIVATE_KEY) return res.status(500).json({ error: 'VAPID_PRIVATE_KEY manquante' });
  webpush.setVapidDetails(SITE, VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

  const body = readBody(req);
  const r = body.reservation || {}, subs = Array.isArray(body.subscriptions) ? body.subscriptions : [];
  const cancel = body.kind === 'cancelled', modif = body.kind === 'modified', b = r.before || {};
  const before = modif && (b.date !== r.date || b.time !== r.time || b.guests !== r.guests)
    ? ' (avant : ' + (b.date !== r.date ? dateFr(b.date, true) + ' ' : '') + b.time + ', ' + b.guests + ' pers.)' : '';
  const payload = JSON.stringify({
    title: cancel ? (r.late ? 'Annulation tardive' : 'Réservation annulée par le client')
         : modif ? (r.pending ? 'Réservation modifiée · à reconfirmer' : 'Note modifiée par le client')
         : 'Nouvelle demande de réservation',
    body: r.name + ' · ' + r.guests + ' pers. · ' + dateFr(r.date) + ' à ' + r.time + before +
          (cancel && r.table ? ' · table ' + r.table + ' libérée' : cancel && r.was === 'pending' ? ' · demande retirée' : ''),
    tag: (cancel ? 'annul-' : modif ? 'modif-' : 'resa-') + r.id,
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
