const { setup, admin, userFromReq, sendTo } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
  const uid = await userFromReq(req); if (!uid) return res.status(401).json({ error: 'Non connecté' });
  try {
    setup(); const db = admin();
    const { data, error } = await db.from('push_subs').select('*').eq('uid', uid);
    if (error) return res.status(500).json({ error: 'Lecture des abonnements impossible : ' + error.message });
    if (!data || !data.length) return res.status(404).json({ error: "Aucun appareil abonné : active d'abord les notifications" });
    let ok = 0, err = null; for (const s of data) { const r = await sendTo(db, s, { title: '🔔 Ma Vie', body: 'Les notifications fonctionnent !', url: '/#/reminders', tag: 'test' }); if (r === null) ok++; else err = r; }
    res.status(200).json({ sent: ok, total: data.length, error: ok ? undefined : `Envoi refusé (${err.code}) ${err.msg}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
