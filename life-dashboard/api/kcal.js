// Fonction Vercel : estime les kcal d'un repas décrit en texte libre (Claude Haiku).
// Variable d'environnement requise sur Vercel : ANTHROPIC_API_KEY
const SB = process.env.SUPABASE_URL || 'https://xfhubsvivbjgvvytbyxa.supabase.co';
const KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_gBHLEE6rCDSgdrxPBxDSaA_l9yQqjEq';
const SYSTEM = 'Tu es nutritionniste. L\'utilisateur décrit un repas en français. Estime les calories (kcal) de chaque aliment avec des portions réalistes quand elles ne sont pas précisées. Réponds UNIQUEMENT avec un JSON : {"items":[{"name":string,"kcal":integer}],"total":integer}';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
  // seul un utilisateur connecté à Supabase peut appeler l'IA
  const who = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: KEY, Authorization: req.headers.authorization || '' } }).catch(() => null);
  if (!who || !who.ok) return res.status(401).json({ error: 'Non connecté' });
  const text = String((req.body && req.body.text) || '').trim().slice(0, 300);
  if (!text) return res.status(400).json({ error: 'Texte vide' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Clé IA non configurée sur Vercel' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.KCAL_MODEL || 'claude-haiku-5-5', max_tokens: 400, system: SYSTEM, messages: [{ role: 'user', content: text }] })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: j.error?.message || 'Erreur IA' });
    const m = (j.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
    const out = JSON.parse(m[0]);
    const total = Math.round(Number(out.total) || (out.items || []).reduce((s, i) => s + (Number(i.kcal) || 0), 0));
    return res.status(200).json({ total, items: out.items || [] });
  } catch (e) {
    return res.status(502).json({ error: 'Estimation impossible' });
  }
};
