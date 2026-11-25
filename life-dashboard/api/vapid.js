const { vapid } = require('./_lib');
module.exports = (req, res) => {
  const k = vapid();
  if (!k) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante sur Vercel' });
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).json({ key: k.publicKey });
};
