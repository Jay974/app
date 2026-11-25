const crypto = require('node:crypto');
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');
const SB = process.env.SUPABASE_URL || 'https://xfhubsvivbjgvvytbyxa.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_gBHLEE6rCDSgdrxPBxDSaA_l9yQqjEq';

// Clés VAPID dérivées d'un secret déjà présent (aucune clé de plus à gérer)
function vapid() {
  const seed = process.env.VAPID_SEED || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!seed) return null;
  const priv = crypto.createHash('sha256').update('life-vapid:' + seed).digest();
  const ecdh = crypto.createECDH('prime256v1'); ecdh.setPrivateKey(priv);
  return { publicKey: ecdh.getPublicKey().toString('base64url'), privateKey: priv.toString('base64url') };
}
function setup() {
  const k = vapid(); if (!k) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante sur Vercel');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:noreply@example.com', k.publicKey, k.privateKey);
  return k;
}
const admin = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante sur Vercel');
  return createClient(SB, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
};
async function userFromReq(req) { // vérifie le jeton Supabase de l'utilisateur
  const r = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: ANON, Authorization: req.headers.authorization || '' } }).catch(() => null);
  if (!r || !r.ok) return null;
  return (await r.json()).id || null;
}
async function sendTo(db, sub, payload) { // null si envoyé, sinon { code, msg } (abonnement mort = supprimé)
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 3600 });
    return null;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) await db.from('push_subs').delete().eq('endpoint', sub.endpoint);
    return { code: e.statusCode || 0, msg: String(e.body || e.message || '').slice(0, 120) };
  }
}
module.exports = { vapid, setup, admin, userFromReq, sendTo };
