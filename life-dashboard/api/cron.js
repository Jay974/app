// Appelé chaque minute (pg_cron côté Supabase). Protégé par CRON_SECRET.
const { setup, admin, sendTo } = require('./_lib');
const { computeDue, localParts } = require('./_remind');
module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret) return res.status(401).json({ error: 'unauthorized' });
  try {
    setup(); const db = admin();
    const { data: subs, error } = await db.from('push_subs').select('*');
    if (error) throw error;
    const byUser = {}; (subs || []).forEach(s => (byUser[s.uid] = byUser[s.uid] || []).push(s));
    let sent = 0;
    for (const [uid, list] of Object.entries(byUser)) {
      const local = localParts(list[list.length - 1].tz || 'UTC');
      const { data: rows } = await db.from('fields').select('doc,field,v').eq('uid', uid).in('doc', ['rem', 'cfg', 'credit', 'day:' + local.date]);
      const docs = {}; (rows || []).forEach(r => { (docs[r.doc] = docs[r.doc] || {})[r.field] = r.v; });
      const items = computeDue({ rem: docs.rem || {}, cfg: docs.cfg || {}, credit: docs.credit || {}, day: docs['day:' + local.date] || {}, local });
      for (const it of items) {
        // une seule notification par rappel et par jour (même si le déclencheur passe 2 fois)
        const { error: dup } = await db.from('push_sent').insert({ uid, key: it.key, day: local.date });
        if (dup) continue;
        for (const s of list) if (await sendTo(db, s, { title: it.title, body: it.body, url: it.url, tag: it.key })) sent++;
      }
    }
    await db.from('push_sent').delete().lt('day', new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
    res.status(200).json({ ok: true, users: Object.keys(byUser).length, sent });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
