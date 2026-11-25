// Fournisseur IA avec secours : Claude d'abord, puis Gemini (offre gratuite) si Claude échoue ou n'est pas configuré.
// Variables Vercel : ANTHROPIC_API_KEY (optionnelle), GEMINI_API_KEY (optionnelle), AI_PROVIDER = auto | claude | gemini
async function claude({ system, user, maxTokens, model }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Claude : ' + (j.error?.message || r.status));
  return { text: (j.content || []).filter(b => b.type === 'text').map(b => b.text).join(''), truncated: j.stop_reason === 'max_tokens', provider: 'claude' };
}
async function gemini({ system, user, maxTokens, json }) {
  const models = [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean);
  let lastErr = 'inconnue';
  for (const m of models) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { maxOutputTokens: Math.max(maxTokens, 1024), temperature: 0.4, ...(json ? { responseMimeType: 'application/json' } : {}) }
      })
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const c = j.candidates && j.candidates[0];
      const text = ((c && c.content && c.content.parts) || []).map(p => p.text || '').join('');
      if (text) return { text, truncated: c.finishReason === 'MAX_TOKENS', provider: 'gemini' };
      lastErr = 'réponse vide (' + ((c && c.finishReason) || (j.promptFeedback && j.promptFeedback.blockReason) || '?') + ')';
    } else { lastErr = j.error?.message || String(r.status); if (r.status !== 404) break; }
  }
  throw new Error('Gemini : ' + lastErr);
}
async function ask(opts) {
  const mode = (process.env.AI_PROVIDER || 'auto').toLowerCase(), hasC = !!process.env.ANTHROPIC_API_KEY, hasG = !!process.env.GEMINI_API_KEY;
  if (!hasC && !hasG) throw new Error('Aucune clé IA configurée sur Vercel (ANTHROPIC_API_KEY ou GEMINI_API_KEY)');
  const order = mode === 'gemini' ? ['gemini', 'claude'] : mode === 'claude' ? ['claude', 'gemini'] : ['claude', 'gemini'];
  const errs = [];
  for (const p of order) {
    if ((p === 'claude' && !hasC) || (p === 'gemini' && !hasG)) continue;
    try { return await (p === 'claude' ? claude(opts) : gemini(opts)); } catch (e) { errs.push(e.message); }
  }
  throw new Error(errs.join(' | ').slice(0, 300));
}
// extrait le premier objet JSON d'une réponse
function parseJson(raw) {
  const m = String(raw).match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Réponse IA illisible : ' + String(raw).slice(0, 80));
  return JSON.parse(m[0]);
}
module.exports = { ask, parseJson };
