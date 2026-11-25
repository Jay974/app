// Fonction Vercel : bilan de semaine et conseils financiers (Claude). Env : ANTHROPIC_API_KEY
const SB = process.env.SUPABASE_URL || 'https://xfhubsvivbjgvvytbyxa.supabase.co';
const KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_gBHLEE6rCDSgdrxPBxDSaA_l9yQqjEq';
const PROMPTS = {
  week: 'Tu es un coach santé bienveillant et concret. À partir des données des 14 derniers jours (poids, sport, calories mangées, kcal brûlées par le sport, eau, sommeil, humeur) et des objectifs, réponds en français, 180 mots max : 1) un bilan en 2 phrases, 2) ce qui va bien / ce qui peut progresser (3 puces), 3) 2 actions précises pour la semaine. Appuie-toi sur les chiffres. Aucun diagnostic médical.',
  nutrition: 'Tu es un coach nutrition bienveillant et concret. À partir des repas, calories et macros (protéines, glucides, lipides en g) d\'aujourd\'hui et des 7 derniers jours, comparés aux objectifs (et aux kcal brûlées par le sport), réponds en français, 220 mots max : 1) où en est la journée (reste / dépassement pour chaque macro et les calories), 2) les écarts récurrents sur 7 jours (insuffisance ou excès), 3) 3 actions concrètes avec des aliments précis et quantités (pour le reste de la journée, puis pour la semaine), en tenant compte du poids, de l\'objectif et du sport. Ignore les jours sans repas saisi. Aucun diagnostic médical.',
  budget: 'Tu es un conseiller budget pragmatique et bienveillant. À partir du mois en cours (revenus, mensualité de crédit, dépenses par catégorie, limites fixées, projection de fin de mois, mois précédent), réponds en français, 220 mots max : 1) situation du mois en 2 phrases (reste, rythme), 2) les catégories qui dérapent ou qui ont de la marge (chiffres), 3) 3 actions concrètes et chiffrées pour finir le mois et le suivant (limites à ajuster, postes à réduire, montant à mettre de côté). Si peu de données sont saisies, dis-le et indique quoi renseigner. Termine par : « Conseils indicatifs. »',
  finance: 'Tu es un conseiller en gestion financière personnelle, pragmatique. À partir des données (crédit : total, mensualité, taux annuel, remboursé, reste ; salaire net mensuel, heures hebdomadaires, taux horaire net, part de la mensualité sur le salaire, dépenses, épargne), propose en français, 230 mots max, 3 stratégies classées par impact (ex : remboursement anticipé partiel, fonds d\'urgence avant surpaiement, renégociation ou rachat de crédit, budget/épargne automatique), chiffrées quand c\'est possible (mois gagnés, intérêts économisés estimés). Si des données manquent (taux, salaire, dépenses…), dis lesquelles et fais des hypothèses prudentes. Termine par : « Conseils indicatifs, pas un avis financier personnalisé. »'
};
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
  const who = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: KEY, Authorization: req.headers.authorization || '' } }).catch(() => null);
  if (!who || !who.ok) return res.status(401).json({ error: 'Non connecté' });
  const { mode, data } = req.body || {};
  if (!PROMPTS[mode] || !data) return res.status(400).json({ error: 'Requête invalide' });
  const payload = JSON.stringify(data).slice(0, 12000);
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Clé IA non configurée sur Vercel' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.COACH_MODEL || 'claude-sonnet-5-5', max_tokens: 800, system: PROMPTS[mode], messages: [{ role: 'user', content: 'Données (JSON) :\n' + payload }] })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: j.error?.message || 'Erreur IA' });
    return res.status(200).json({ text: (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('') });
  } catch (e) { return res.status(502).json({ error: 'Analyse impossible' }); }
};
