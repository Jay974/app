import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import webpush from 'web-push';
import QRCode from 'qrcode';
import { getDb } from '@/lib/db';
import { computePoints, tierForPoints, DEFAULT_SETTINGS } from '@/lib/points';
import { generateGiftCardCode, DEFAULT_GIFT_CARD_SETTINGS } from '@/lib/giftcards';

export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
if (!process.env.JWT_SECRET) console.warn('⚠️ JWT_SECRET manquant · dev fallback');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:contact@restaurant.example',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (e) {
    console.warn('VAPID init warn', e.message);
  }
}

const json = (data, status = 200) => NextResponse.json(data, { status });
const err = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: payload.type === 'staff' ? '16h' : '365d' });
}

function getAuth(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function requireStaff(request) {
  const a = getAuth(request);
  if (!a || a.type !== 'staff') return null;
  return a;
}

function requireAdmin(request) {
  const a = requireStaff(request);
  if (!a || a.role !== 'admin') return null;
  return a;
}

function requireClient(request) {
  const a = getAuth(request);
  if (!a || a.type !== 'client') return null;
  return a;
}

async function getSettings(db) {
  const doc = await db.collection('settings').findOne({ _key: 'main' });
  if (!doc) return DEFAULT_SETTINGS;
  const { points_rule, tiers, restaurant, gift_cards } = doc;
  return {
    points_rule: points_rule || DEFAULT_SETTINGS.points_rule,
    tiers: tiers?.length ? tiers : DEFAULT_SETTINGS.tiers,
    restaurant: restaurant || DEFAULT_SETTINGS.restaurant,
    gift_cards: gift_cards || DEFAULT_GIFT_CARD_SETTINGS,
  };
}

function cleanGiftCard(g) {
  if (!g) return null;
  const { _id, ...rest } = g;
  return rest;
}

function cleanClient(c) {
  if (!c) return null;
  const { _id, pin_hash, access_code_hash, access_code_expires, ...rest } = c;
  return rest;
}

function cleanStaff(s) {
  if (!s) return null;
  const { _id, pin_hash, ...rest } = s;
  return rest;
}

async function pushToClient(db, phone, payload) {
  if (!process.env.VAPID_PRIVATE_KEY) return;
  const subs = await db.collection('push_subscriptions').find({ phone }).toArray();
  const body = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(s.subscription, body).catch(async (e) => {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await db.collection('push_subscriptions').deleteOne({ _id: s._id });
        }
      })
    )
  );
}

async function pushToAll(db, payload) {
  if (!process.env.VAPID_PRIVATE_KEY) return { sent: 0 };
  const subs = await db.collection('push_subscriptions').find({}).toArray();
  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(s.subscription, body).catch(async (e) => {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await db.collection('push_subscriptions').deleteOne({ _id: s._id });
        }
      })
    )
  );
  return { sent: results.filter((r) => r.status === 'fulfilled').length };
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function handler(request, { params }) {
  const segs = params.path || [];
  const route = segs.join('/');
  const method = request.method;
  const db = await getDb();
  let body = {};
  if (method !== 'GET' && method !== 'DELETE') {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }
  const url = new URL(request.url);

  try {
    // ---------------- STAFF AUTH ----------------
    if (route === 'staff/bootstrap' && method === 'POST') {
      const count = await db.collection('staff').countDocuments({});
      if (count > 0) return err('Déjà initialisé', 409);
      const { name, pin } = body;
      if (!name || !pin || String(pin).length < 4) return err('Nom et code PIN (4 chiffres min) requis');
      const staff = {
        id: uuidv4(),
        name,
        role: 'admin',
        pin_hash: await bcrypt.hash(String(pin), 10),
        created_at: new Date().toISOString(),
      };
      await db.collection('staff').insertOne(staff);
      const token = signToken({ sub: staff.id, type: 'staff', role: staff.role, name: staff.name });
      return json({ token, staff: cleanStaff(staff) });
    }

    if (route === 'staff/login' && method === 'POST') {
      const { pin } = body;
      if (!pin) return err('Code PIN requis');
      const staffList = await db.collection('staff').find({ active: { $ne: false } }).toArray();
      for (const s of staffList) {
        if (await bcrypt.compare(String(pin), s.pin_hash)) {
          const token = signToken({ sub: s.id, type: 'staff', role: s.role, name: s.name });
          return json({ token, staff: cleanStaff(s) });
        }
      }
      return err('Code PIN invalide', 401);
    }

    if (route === 'staff/me' && method === 'GET') {
      const a = requireStaff(request);
      if (!a) return err('Non autorisé', 401);
      return json({ id: a.sub, name: a.name, role: a.role });
    }

    if (route === 'staff' && method === 'GET') {
      const a = requireAdmin(request);
      if (!a) return err('Réservé aux admins', 403);
      const list = await db.collection('staff').find({}).sort({ created_at: 1 }).toArray();
      return json(list.map(cleanStaff));
    }

    if (route === 'staff' && method === 'POST') {
      const a = requireAdmin(request);
      if (!a) return err('Réservé aux admins', 403);
      const { name, pin, role } = body;
      if (!name || !pin || String(pin).length < 4) return err('Nom et code PIN (4 chiffres min) requis');
      const staff = {
        id: uuidv4(),
        name,
        role: role === 'admin' ? 'admin' : 'caissier',
        pin_hash: await bcrypt.hash(String(pin), 10),
        active: true,
        created_at: new Date().toISOString(),
      };
      await db.collection('staff').insertOne(staff);
      return json(cleanStaff(staff), 201);
    }

    if (route.startsWith('staff/') && method === 'DELETE') {
      const a = requireAdmin(request);
      if (!a) return err('Réservé aux admins', 403);
      const id = segs[1];
      await db.collection('staff').updateOne({ id }, { $set: { active: false } });
      return json({ ok: true });
    }

    // ---------------- SETTINGS ----------------
    if (route === 'settings' && method === 'GET') {
      const settings = await getSettings(db);
      const publicKey = process.env.VAPID_PUBLIC_KEY || null;
      return json({ ...settings, vapid_public_key: publicKey });
    }

    if (route === 'settings' && method === 'PUT') {
      const a = requireAdmin(request);
      if (!a) return err('Réservé aux admins', 403);
      const { points_rule, tiers, restaurant, gift_cards } = body;
      await db.collection('settings').updateOne(
        { _key: 'main' },
        { $set: { points_rule, tiers, restaurant, gift_cards, updated_at: new Date().toISOString() } },
        { upsert: true }
      );
      return json(await getSettings(db));
    }

    // ---------------- REWARDS ----------------
    if (route === 'rewards' && method === 'GET') {
      const list = await db.collection('rewards').find({ active: { $ne: false } }).sort({ points_cost: 1 }).toArray();
      return json(list.map(({ _id, ...r }) => r));
    }

    if (route === 'rewards' && method === 'POST') {
      const a = requireAdmin(request);
      if (!a) return err('Réservé aux admins', 403);
      const { name, points_cost, description } = body;
      if (!name || !points_cost) return err('Nom et coût en points requis');
      const reward = { id: uuidv4(), name, description: description || '', points_cost: Number(points_cost), active: true, created_at: new Date().toISOString() };
      await db.collection('rewards').insertOne(reward);
      return json(reward, 201);
    }

    if (route.startsWith('rewards/') && method === 'PUT') {
      const a = requireAdmin(request);
      if (!a) return err('Réservé aux admins', 403);
      const id = segs[1];
      const { name, points_cost, description, active } = body;
      await db.collection('rewards').updateOne({ id }, { $set: { name, points_cost: Number(points_cost), description, active } });
      return json({ ok: true });
    }

    if (route.startsWith('rewards/') && method === 'DELETE') {
      const a = requireAdmin(request);
      if (!a) return err('Réservé aux admins', 403);
      const id = segs[1];
      await db.collection('rewards').updateOne({ id }, { $set: { active: false } });
      return json({ ok: true });
    }

    // ---------------- CLIENTS ----------------
    if (segs[0] === 'clients' && segs.length === 2 && segs[1] !== 'me' && segs[1] !== 'access' && method === 'GET') {
      const a = requireStaff(request);
      if (!a) return err('Non autorisé', 401);
      const phone = segs[1];
      const client = await db.collection('clients').findOne({ phone });
      if (!client) return json({ exists: false });
      const settings = await getSettings(db);
      const { current, next } = tierForPoints(client.lifetime_points || 0, settings);
      return json({ exists: true, client: cleanClient(client), tier: current, next_tier: next });
    }

    if (route === 'clients/access/init' && method === 'POST') {
      const a = requireStaff(request);
      if (!a) return err('Non autorisé', 401);
      const { phone, name } = body;
      if (!phone) return err('Numéro de téléphone requis');
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const now = new Date().toISOString();
      const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const existing = await db.collection('clients').findOne({ phone });
      if (existing) {
        await db.collection('clients').updateOne(
          { phone },
          { $set: { access_code_hash: await bcrypt.hash(code, 10), access_code_expires: expires } }
        );
      } else {
        await db.collection('clients').insertOne({
          id: uuidv4(),
          phone,
          name: name || '',
          points_balance: 0,
          lifetime_points: 0,
          total_spent_cents: 0,
          access_code_hash: await bcrypt.hash(code, 10),
          access_code_expires: expires,
          created_at: now,
          last_visit: null,
        });
      }
      // Le code est affiché en caisse (jamais envoyé par SMS ici, pas de fournisseur SMS branché) :
      // le client le saisit lui-même dans la PWA pour créer son accès en autonomie.
      return json({ code, expires_at: expires });
    }

    if (route === 'clients/access/claim' && method === 'POST') {
      const { phone, code, pin } = body;
      if (!phone || !code || !pin || String(pin).length < 4) return err('Téléphone, code et PIN (4 chiffres min) requis');
      const client = await db.collection('clients').findOne({ phone });
      if (!client || !client.access_code_hash) return err('Code introuvable, demandez à la caisse', 404);
      if (new Date(client.access_code_expires) < new Date()) return err('Code expiré, redemandez-en un à la caisse', 410);
      const ok = await bcrypt.compare(String(code), client.access_code_hash);
      if (!ok) return err('Code incorrect', 401);
      await db.collection('clients').updateOne(
        { phone },
        { $set: { pin_hash: await bcrypt.hash(String(pin), 10) }, $unset: { access_code_hash: '', access_code_expires: '' } }
      );
      const token = signToken({ sub: phone, type: 'client' });
      return json({ token });
    }

    if (route === 'clients/login' && method === 'POST') {
      const { phone, pin } = body;
      if (!phone || !pin) return err('Téléphone et PIN requis');
      const client = await db.collection('clients').findOne({ phone });
      if (!client || !client.pin_hash) return err('Aucun accès créé pour ce numéro. Demandez un code à la caisse.', 404);
      const ok = await bcrypt.compare(String(pin), client.pin_hash);
      if (!ok) return err('PIN incorrect', 401);
      const token = signToken({ sub: phone, type: 'client' });
      return json({ token });
    }

    if (route === 'clients/me' && method === 'GET') {
      const a = requireClient(request);
      if (!a) return err('Non autorisé', 401);
      const client = await db.collection('clients').findOne({ phone: a.sub });
      if (!client) return err('Introuvable', 404);
      const settings = await getSettings(db);
      const { current, next } = tierForPoints(client.lifetime_points || 0, settings);
      const rewards = await db.collection('rewards').find({ active: { $ne: false } }).sort({ points_cost: 1 }).toArray();
      const history = await db
        .collection('transactions')
        .find({ phone: a.sub })
        .sort({ created_at: -1 })
        .limit(20)
        .toArray();
      return json({
        client: cleanClient(client),
        tier: current,
        next_tier: next,
        points_to_next: next ? Math.max(0, next.min_lifetime_points - (client.lifetime_points || 0)) : 0,
        rewards: rewards.map(({ _id, ...r }) => ({ ...r, unlocked: (client.points_balance || 0) >= r.points_cost })),
        history: history.map(({ _id, ...h }) => h),
      });
    }

    // ---------------- CHECKOUT ----------------
    if (route === 'checkout' && method === 'POST') {
      const a = requireStaff(request);
      if (!a) return err('Non autorisé', 401);
      const { phone, amount_cents, redeem_reward_id } = body;
      if (!phone || !Number.isFinite(amount_cents) || amount_cents <= 0) {
        return err('Numéro de téléphone et montant valides requis');
      }
      const settings = await getSettings(db);
      let client = await db.collection('clients').findOne({ phone });
      const now = new Date().toISOString();
      if (!client) {
        client = {
          id: uuidv4(),
          phone,
          name: '',
          points_balance: 0,
          lifetime_points: 0,
          total_spent_cents: 0,
          created_at: now,
          last_visit: null,
        };
        await db.collection('clients').insertOne(client);
      }

      const { current: tierBefore } = tierForPoints(client.lifetime_points || 0, settings);
      const pointsEarned = computePoints(amount_cents, settings, tierBefore.multiplier || 1);

      let redeemedReward = null;
      let redeemedCost = 0;
      if (redeem_reward_id) {
        const reward = await db.collection('rewards').findOne({ id: redeem_reward_id, active: { $ne: false } });
        if (!reward) return err('Récompense introuvable');
        if ((client.points_balance || 0) < reward.points_cost) return err('Solde de points insuffisant pour cette récompense', 409);
        redeemedReward = reward;
        redeemedCost = reward.points_cost;
      }

      const newBalance = (client.points_balance || 0) + pointsEarned - redeemedCost;
      const newLifetime = (client.lifetime_points || 0) + pointsEarned;
      const { current: tierAfter } = tierForPoints(newLifetime, settings);

      await db.collection('clients').updateOne(
        { phone },
        {
          $set: {
            points_balance: newBalance,
            lifetime_points: newLifetime,
            last_visit: now,
          },
          $inc: { total_spent_cents: amount_cents },
        }
      );

      const tx = {
        id: uuidv4(),
        phone,
        amount_cents,
        points_earned: pointsEarned,
        reward_redeemed: redeemedReward ? { id: redeemedReward.id, name: redeemedReward.name, points_cost: redeemedCost } : null,
        staff_id: a.sub,
        staff_name: a.name,
        tier_at_time: tierAfter.key,
        created_at: now,
      };
      await db.collection('transactions').insertOne(tx);

      const tierUp = tierAfter.key !== tierBefore.key;
      pushToClient(db, phone, {
        title: tierUp ? `Bravo, vous passez au statut ${tierAfter.label} !` : 'Merci de votre visite !',
        body: `+${pointsEarned} points · solde ${newBalance} pts`,
        tag: 'checkout',
      }).catch(() => {});

      return json({
        transaction: tx,
        client: { phone, points_balance: newBalance, lifetime_points: newLifetime },
        tier: tierAfter,
        tier_up: tierUp,
      });
    }

    // ---------------- PUSH ----------------
    if (route === 'push/subscribe' && method === 'POST') {
      const a = requireClient(request);
      if (!a) return err('Non autorisé', 401);
      const { subscription } = body;
      if (!subscription?.endpoint) return err('Souscription invalide');
      await db.collection('push_subscriptions').updateOne(
        { phone: a.sub, 'subscription.endpoint': subscription.endpoint },
        { $set: { phone: a.sub, subscription, created_at: new Date().toISOString() } },
        { upsert: true }
      );
      return json({ ok: true });
    }

    if (route === 'push/unsubscribe' && method === 'POST') {
      const a = requireClient(request);
      if (!a) return err('Non autorisé', 401);
      const { endpoint } = body;
      await db.collection('push_subscriptions').deleteOne({ phone: a.sub, 'subscription.endpoint': endpoint });
      return json({ ok: true });
    }

    // ---------------- OFFERS ----------------
    if (route === 'offers' && method === 'GET') {
      const a = requireAdmin(request);
      if (!a) return err('Réservé aux admins', 403);
      const list = await db.collection('offers').find({}).sort({ created_at: -1 }).toArray();
      return json(list.map(({ _id, ...o }) => o));
    }

    if (route === 'offers' && method === 'POST') {
      const a = requireAdmin(request);
      if (!a) return err('Réservé aux admins', 403);
      const { title, message, type, scheduled_at } = body;
      if (!title || !message) return err('Titre et message requis');
      const offer = {
        id: uuidv4(),
        title,
        message,
        type: type === 'proximity' ? 'proximity' : 'scheduled',
        scheduled_at: scheduled_at || null,
        sent_at: null,
        active: true,
        created_at: new Date().toISOString(),
      };
      await db.collection('offers').insertOne(offer);
      return json(offer, 201);
    }

    if (route.startsWith('offers/') && route.endsWith('/send-now') && method === 'POST') {
      const a = requireAdmin(request);
      if (!a) return err('Réservé aux admins', 403);
      const id = segs[1];
      const offer = await db.collection('offers').findOne({ id });
      if (!offer) return err('Introuvable', 404);
      const result = await pushToAll(db, { title: offer.title, body: offer.message, tag: 'offer' });
      await db.collection('offers').updateOne({ id }, { $set: { sent_at: new Date().toISOString() } });
      return json({ ok: true, ...result });
    }

    if (route.startsWith('offers/') && !route.endsWith('/send-now') && method === 'DELETE') {
      const a = requireAdmin(request);
      if (!a) return err('Réservé aux admins', 403);
      const id = segs[1];
      await db.collection('offers').updateOne({ id }, { $set: { active: false } });
      return json({ ok: true });
    }

    if (route === 'offers/active' && method === 'GET') {
      const now = new Date();
      const list = await db
        .collection('offers')
        .find({ active: true, type: 'scheduled' })
        .sort({ created_at: -1 })
        .limit(10)
        .toArray();
      const visible = list.filter((o) => !o.scheduled_at || new Date(o.scheduled_at) <= now);
      return json(visible.map(({ _id, ...o }) => o));
    }

    // ---------------- PROXIMITY ----------------
    if (route === 'clients/proximity-checkin' && method === 'POST') {
      const a = requireClient(request);
      if (!a) return err('Non autorisé', 401);
      const { lat, lng } = body;
      const settings = await getSettings(db);
      if (!settings.restaurant?.lat || !settings.restaurant?.lng) return json({ near: false });
      const dist = haversineMeters(lat, lng, settings.restaurant.lat, settings.restaurant.lng);
      const near = dist <= (settings.restaurant.proximity_radius_m || 300);
      if (near) {
        const today = new Date().toISOString().slice(0, 10);
        const already = await db.collection('proximity_pings').findOne({ phone: a.sub, day: today });
        if (!already) {
          await db.collection('proximity_pings').insertOne({ phone: a.sub, day: today, created_at: new Date().toISOString() });
          const offer = await db.collection('offers').findOne({ active: true, type: 'proximity' }, { sort: { created_at: -1 } });
          if (offer) {
            pushToClient(db, a.sub, { title: offer.title, body: offer.message, tag: 'proximity' }).catch(() => {});
          }
        }
      }
      return json({ near, distance_m: Math.round(dist) });
    }

    // ---------------- GIFT CARDS ----------------
    if (route === 'gift-cards' && method === 'POST') {
      const staffAuth = requireStaff(request);
      const clientAuth = requireClient(request);
      if (!staffAuth && !clientAuth) return err('Non autorisé', 401);

      const { amount_cents, recipient_name, sender_name, message } = body;
      if (!Number.isFinite(amount_cents) || amount_cents <= 0) return err('Montant invalide');

      const settings = await getSettings(db);
      const validityMonths = settings.gift_cards?.validity_months || DEFAULT_GIFT_CARD_SETTINGS.validity_months;
      const now = new Date();
      const expires = new Date(now);
      expires.setMonth(expires.getMonth() + validityMonths);

      let code = generateGiftCardCode();
      for (let i = 0; i < 5 && (await db.collection('gift_cards').findOne({ code })); i++) {
        code = generateGiftCardCode();
      }

      const card = {
        id: uuidv4(),
        code,
        amount_cents,
        balance_cents: amount_cents,
        recipient_name: recipient_name || '',
        sender_name: sender_name || '',
        message: message || '',
        // Créée par un client depuis la PWA : en attente du règlement en caisse pour être activée.
        // Créée par le staff : le paiement vient d'être encaissé au comptoir, elle est active immédiatement.
        status: staffAuth ? 'active' : 'awaiting_activation',
        created_by_phone: clientAuth ? clientAuth.sub : null,
        created_by_staff_id: staffAuth ? staffAuth.sub : null,
        created_by_staff_name: staffAuth ? staffAuth.name : null,
        activated_at: staffAuth ? now.toISOString() : null,
        expires_at: expires.toISOString(),
        redemptions: [],
        created_at: now.toISOString(),
      };
      await db.collection('gift_cards').insertOne(card);
      return json(cleanGiftCard(card), 201);
    }

    if (route === 'gift-cards/mine' && method === 'GET') {
      const a = requireClient(request);
      if (!a) return err('Non autorisé', 401);
      const list = await db.collection('gift_cards').find({ created_by_phone: a.sub }).sort({ created_at: -1 }).toArray();
      return json(list.map(cleanGiftCard));
    }

    if (segs[0] === 'gift-cards' && segs.length === 2 && segs[1] !== 'mine' && method === 'GET') {
      const code = decodeURIComponent(segs[1]);
      const card = await db.collection('gift_cards').findOne({ code });
      if (!card) return err('Carte cadeau introuvable', 404);
      return json(cleanGiftCard(card));
    }

    if (segs[0] === 'gift-cards' && segs.length === 3 && segs[2] === 'qr' && method === 'GET') {
      const code = decodeURIComponent(segs[1]);
      const card = await db.collection('gift_cards').findOne({ code });
      if (!card) return err('Carte cadeau introuvable', 404);
      const target = `${url.origin}/carte-cadeau/${encodeURIComponent(code)}`;
      const buffer = await QRCode.toBuffer(target, { width: 480, margin: 1, color: { dark: '#14161A', light: '#ffffff' } });
      return new NextResponse(buffer, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' } });
    }

    if (segs[0] === 'gift-cards' && segs.length === 3 && segs[2] === 'activate' && method === 'POST') {
      const a = requireStaff(request);
      if (!a) return err('Non autorisé', 401);
      const code = decodeURIComponent(segs[1]);
      const card = await db.collection('gift_cards').findOne({ code });
      if (!card) return err('Carte cadeau introuvable', 404);
      if (card.status !== 'awaiting_activation') return err('Cette carte est déjà activée ou n\'est plus valable', 409);
      const now = new Date().toISOString();
      await db.collection('gift_cards').updateOne(
        { code },
        { $set: { status: 'active', activated_at: now, activated_by_staff_id: a.sub, activated_by_staff_name: a.name } }
      );
      if (card.created_by_phone) {
        pushToClient(db, card.created_by_phone, {
          title: 'Votre carte cadeau est activée !',
          body: `${(card.amount_cents / 100).toFixed(2)} € prêts à être offerts.`,
          tag: 'gift-card',
        }).catch(() => {});
      }
      const updated = await db.collection('gift_cards').findOne({ code });
      return json(cleanGiftCard(updated));
    }

    if (segs[0] === 'gift-cards' && segs.length === 3 && segs[2] === 'redeem' && method === 'POST') {
      const a = requireStaff(request);
      if (!a) return err('Non autorisé', 401);
      const code = decodeURIComponent(segs[1]);
      const { amount_cents } = body;
      if (!Number.isFinite(amount_cents) || amount_cents <= 0) return err('Montant invalide');
      const card = await db.collection('gift_cards').findOne({ code });
      if (!card) return err('Carte cadeau introuvable', 404);
      if (card.status === 'awaiting_activation') return err('Cette carte n\'est pas encore activée', 409);
      if (card.status !== 'active') return err('Cette carte n\'est plus utilisable', 409);
      if (new Date(card.expires_at) < new Date()) return err('Cette carte a expiré', 410);
      if (amount_cents > card.balance_cents) return err('Le montant dépasse le solde de la carte', 409);

      const newBalance = card.balance_cents - amount_cents;
      const redemption = { amount_cents, staff_id: a.sub, staff_name: a.name, created_at: new Date().toISOString() };
      await db.collection('gift_cards').updateOne(
        { code },
        {
          $set: { balance_cents: newBalance, status: newBalance === 0 ? 'used' : 'active' },
          $push: { redemptions: redemption },
        }
      );
      if (card.created_by_phone) {
        pushToClient(db, card.created_by_phone, {
          title: 'Votre carte cadeau a été utilisée',
          body: `-${(amount_cents / 100).toFixed(2)} € · solde restant ${(newBalance / 100).toFixed(2)} €`,
          tag: 'gift-card',
        }).catch(() => {});
      }
      const updated = await db.collection('gift_cards').findOne({ code });
      return json(cleanGiftCard(updated));
    }

    return err('Route inconnue', 404);
  } catch (e) {
    console.error('API error', route, e);
    return err(e.message || 'Erreur serveur', 500);
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
