/* Prévient le client : e-mail (Brevo) s'il a laissé son adresse, notification s'il l'a activée sur son appareil.
   Appelée par Supabase (private.notify_client) pour « demande reçue », « confirmée » et « non disponible ».
   Variables Vercel : NOTIFY_SECRET, VAPID_PRIVATE_KEY, et pour l'e-mail BREVO_API_KEY + MAIL_FROM (expéditeur validé dans Brevo). */
const webpush = require('web-push');
const { VAPID_PUBLIC_KEY, SITE, SUPABASE_URL, SUPABASE_KEY, dateFr, authorized, body: readBody } = require('./_shared');

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function restaurant(){
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/settings?select=data&id=eq.1', { headers: { apikey: SUPABASE_KEY } });
    const rows = await r.json();
    return (rows && rows[0] && rows[0].data) || {};
  } catch(e){ return {}; }
}

function texts(kind, r, info){
  const name = info.name || 'La Terrasse de Bourbon';
  const when = dateFr(r.date) + ' à ' + r.time + ', ' + r.guests + ' personne' + (r.guests > 1 ? 's' : '');
  const track = SITE + '/#suivi-' + r.token;
  if(kind === 'confirmed') return { subject: 'Réservation confirmée · ' + name, push: 'Réservation confirmée', title: 'Votre table vous attend',
    lines: ['Bonjour ' + r.name + ',', 'Votre réservation est <b>confirmée</b> : ' + when + '.', 'En cas d\'empêchement, merci d\'annuler depuis votre page de suivi pour libérer la table.'], cta: ['Voir ma réservation', track], track };
  if(kind === 'declined') return { subject: 'Votre demande de réservation · ' + name, push: 'Créneau non disponible', title: 'Créneau non disponible',
    lines: ['Bonjour ' + r.name + ',', 'Nous sommes désolés : nous ne pouvons pas vous accueillir ' + when + '.', 'Vous pouvez choisir un autre créneau en ligne, ou nous appeler : nous trouverons peut-être une solution.'], cta: ['Choisir un autre créneau', SITE + '/#reserver'], track };
  return { subject: 'Demande de réservation reçue · ' + name, push: 'Demande reçue', title: 'Demande bien reçue',
    lines: ['Bonjour ' + r.name + ',', 'Nous avons bien reçu votre demande pour ' + when + '.', 'L\'équipe vérifie la disponibilité et vous confirme rapidement, par e-mail et sur votre page de suivi.'], cta: ['Suivre ma demande', track], track };
}

function html(t, info){
  const name = esc(info.name || 'La Terrasse de Bourbon');
  return '<!doctype html><html lang="fr"><body style="margin:0;background:#F5F2EA;font-family:Helvetica,Arial,sans-serif;color:#1A2F1A">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden">' +
    '<tr><td style="background:#1A2F1A;padding:22px 26px;color:#F5F2EA;font-family:Georgia,serif;font-size:20px">' + name + '</td></tr>' +
    '<tr><td style="padding:26px"><h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;font-weight:600">' + esc(t.title) + '</h1>' +
    t.lines.map(l => '<p style="margin:0 0 12px;font-size:15px;line-height:1.5">' + l.replace(/<(?!\/?b>)/g, '&lt;') + '</p>').join('') +
    '<p style="margin:22px 0"><a href="' + esc(t.cta[1]) + '" style="background:#1A2F1A;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:99px;font-weight:bold;display:inline-block">' + esc(t.cta[0]) + '</a></p>' +
    (info.phone ? '<p style="margin:0;font-size:13px;color:#5E7C5E">Une question ? ' + esc(info.phone) + '</p>' : '') +
    (info.address ? '<p style="margin:4px 0 0;font-size:13px;color:#5E7C5E">' + esc(info.address) + '</p>' : '') +
    '</td></tr></table><p style="font-size:11px;color:#8CA48C;margin:14px 0 0">Vous recevez cet e-mail car vous avez réservé sur notre site.</p></td></tr></table></body></html>';
}

module.exports = async (req, res) => {
  if(req.method !== 'POST') return res.status(405).end();
  if(!authorized(req)) return res.status(401).end();
  const { kind, reservation: r, push } = readBody(req);
  if(!r || !r.token || ['received', 'confirmed', 'declined'].indexOf(kind) < 0) return res.status(400).json({ error: 'requête incomplète' });
  const info = await restaurant(), t = texts(kind, r, info), out = { email: 'absent', push: 'absent' };

  // E-mail (Brevo)
  if(r.email){
    if(!process.env.BREVO_API_KEY || !process.env.MAIL_FROM) out.email = 'non configuré';
    else {
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { name: info.name || 'La Terrasse de Bourbon', email: process.env.MAIL_FROM }, to: [{ email: r.email, name: r.name }],
          subject: t.subject, htmlContent: html(t, info), textContent: t.lines.join('\n').replace(/<\/?b>/g, '') + '\n\n' + t.cta[0] + ' : ' + t.cta[1] })
      }).catch(e => ({ ok: false, status: 0, text: async () => e.message }));
      out.email = resp.ok ? 'envoyé' : 'échec ' + resp.status;
      if(!resp.ok) console.error('brevo', resp.status, await resp.text());
    }
  }
  // Notification sur l'appareil du client
  if(push && push.endpoint && kind !== 'received' && process.env.VAPID_PRIVATE_KEY){
    webpush.setVapidDetails(SITE, VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const payload = JSON.stringify({ title: t.push, body: dateFr(r.date, true) + ' à ' + r.time + ' · ' + r.guests + ' pers.', tag: 'resa-' + r.id, url: '/#suivi-' + r.token, icon: '/icons/icon-192.png' });
    out.push = await webpush.sendNotification(push, payload, { TTL: 24 * 3600, urgency: 'high' }).then(() => 'envoyée', e => 'échec ' + (e.statusCode || e.message));
  }
  res.status(200).json(out);
};
