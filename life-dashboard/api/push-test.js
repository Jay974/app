const { setup, admin, userFromReq, sendTo } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });
  const uid = await userFromReq(req); if (!uid) return res.status(401).json({ error: 'Non connecté' });
  try {
    setup(); const db = admin();
    const { data } = await db.from('push_subs').select('*').eq('uid', uid);
    if (!data || !data.length) return res.status(404).json({ error: "Aucun appareil abonné : active d'abord les notifications" });
    let ok = 0; for (const s of data) if (await sendTo(db, s, { title: '🔔 Ma Vie', body: 'Les notifications fonctionnent !', url: '/#/reminders', tag: 'test' })) ok++;
    res.status(200).json({ sent: ok, total: data.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
