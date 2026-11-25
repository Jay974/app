// Fonction Vercel : estime les kcal d'un repas décrit en texte libre (Claude Haiku).
// Variable d'environnement requise sur Vercel : ANTHROPIC_API_KEY
const { ask, parseJson } = require('./_ai');
const SB = process.env.SUPABASE_URL || 'https://xfhubsvivbjgvvytbyxa.supabase.co';
const KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_gBHLEE6rCDSgdrxPBxDSaA_l9yQqjEq';
const SYSTEM = 'Tu es nutritionniste. L\'utilisateur décrit un repas en français. Estime les calories (kcal) et les macronutriments en grammes (protéines p, glucides c, lipides f) de chaque aliment avec des portions réalistes quand elles ne sont pas précisées. Réponds UNIQUEMENT avec un JSON : {"items":[{"name":string,"kcal":integer,"p":integer,"c":integer,"f":integer}],"total":{"kcal":integer,"p":integer,"c":integer,"f":integer}}';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
  // seul un utilisateur connecté à Supabase peut appeler l'IA
  const who = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: KEY, Authorization: req.headers.authorization || '' } }).catch(() => null);
  if (!who || !who.ok) return res.status(401).json({ error: 'Non connecté' });
  const text = String((req.body && req.body.text) || '').trim().slice(0, 300);
  if (!text) return res.status(400).json({ error: 'Texte vide' });
  try {
    const r = await ask({ system: SYSTEM, user: text, maxTokens: 1200, model: process.env.KCAL_MODEL || 'claude-haiku-5-5', json: true });
    const out = parseJson(r.text);
    const T = out.total || {}, sum = key => Math.round(Number(T[key]) || (out.items || []).reduce((s, i) => s + (Number(i[key]) || 0), 0));
    return res.status(200).json({ total: sum('kcal'), p: sum('p'), c: sum('c'), f: sum('f'), items: out.items || [], provider: r.provider });
  } catch (e) {
    console.error('kcal', e);
    return res.status(502).json({ error: 'Estimation impossible : ' + (e.message || e).toString().slice(0, 200) });
  }
};
