import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME && process.env.DB_NAME !== 'your_database_name' ? process.env.DB_NAME : 'tikreol';
const JWT_SECRET = process.env.JWT_SECRET || 'tikreol-dev-secret-974';

let cachedClient = null;
async function getDb() {
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGO_URL);
    await cachedClient.connect();
  }
  return cachedClient.db(DB_NAME);
}

const json = (data, status = 200) => NextResponse.json(data, { status });
const err = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, creche_id: user.creche_id, prenom: user.prenom, nom: user.nom },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function getAuth(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

function todayKey() { return new Date().toISOString().slice(0, 10); }

async function seedIfEmpty(db) {
  const cnt = await db.collection('users').countDocuments();
  if (cnt > 0) return false;

  const crecheId = uuidv4();
  await db.collection('creches').insertOne({
    id: crecheId, nom: "Les P'tits Bouts", ville: 'Saint-Denis', region: 'La Réunion',
    slug: 'les-ptits-bouts', adresse: '12 rue des Flamboyants, 97400 Saint-Denis',
    telephone: '0262 21 00 00', email: 'contact@lesptitsbouts.re', capacite: 24, created_at: new Date(),
  });

  const hash = await bcrypt.hash('demo1234', 8);
  const admin = { id: uuidv4(), email: 'admin@demo.re', password: hash, role: 'admin', creche_id: crecheId, prenom: 'Marie', nom: 'Hoarau', created_at: new Date() };
  const pro1  = { id: uuidv4(), email: 'pro@demo.re',   password: hash, role: 'pro',   creche_id: crecheId, prenom: 'Aurélie', nom: 'Payet', created_at: new Date() };
  const pro2  = { id: uuidv4(), email: 'pro2@demo.re',  password: hash, role: 'pro',   creche_id: crecheId, prenom: 'Sandra', nom: 'Grondin', created_at: new Date() };
  const par1  = { id: uuidv4(), email: 'parent@demo.re',password: hash, role: 'parent',creche_id: crecheId, prenom: 'Jean', nom: 'Bègue', created_at: new Date() };
  const par2  = { id: uuidv4(), email: 'parent2@demo.re',password:hash, role: 'parent',creche_id: crecheId, prenom: 'Sophie', nom: 'Técher', created_at: new Date() };
  await db.collection('users').insertMany([admin, pro1, pro2, par1, par2]);

  const childColors = ['#FF6B6B', '#FFA726', '#8B6BE8', '#42A5F5', '#66BB6A'];
  const children = [
    { prenom: 'Lucas',  age_mois: 14, groupe: 'Tournesol',  contrat_heures: 35, mensualite: 520, parent: par1 },
    { prenom: 'Emma',   age_mois: 8,  groupe: 'Coquelicot', contrat_heures: 30, mensualite: 460, parent: par2 },
    { prenom: 'Chloé',  age_mois: 18, groupe: 'Marguerite', contrat_heures: 40, mensualite: 580, parent: par2 },
    { prenom: 'Noah',   age_mois: 10, groupe: 'Coquelicot', contrat_heures: 35, mensualite: 520, parent: par1 },
    { prenom: 'Léa',    age_mois: 30, groupe: 'Marguerite', contrat_heures: 40, mensualite: 580, parent: par2 },
  ];
  const childDocs = children.map((c, i) => {
    const birth = new Date(); birth.setMonth(birth.getMonth() - c.age_mois);
    return {
      id: uuidv4(), creche_id: crecheId, prenom: c.prenom, nom: 'Demo',
      date_naissance: birth.toISOString().slice(0, 10), groupe: c.groupe,
      contrat_heures: c.contrat_heures, mensualite: c.mensualite,
      avatar_color: childColors[i], avatar_url: null,
      parent_ids: [c.parent.id], created_at: new Date(),
    };
  });
  await db.collection('enfants').insertMany(childDocs);

  const lucas = childDocs[0]; const noah = childDocs[3];
  const now = new Date();
  const mk = (eid, h, m, type, titre, detail, color) => ({
    id: uuidv4(), creche_id: crecheId, enfant_id: eid,
    auteur_id: pro1.id, auteur_nom: `${pro1.prenom} ${pro1.nom}`,
    type, titre, detail, color,
    heure: new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).toISOString(),
    visible_parents: true, created_at: new Date(),
  });
  await db.collection('transmissions').insertMany([
    mk(lucas.id, 8, 15, 'arrivee', 'Arrivée à la crèche', 'Lucas est arrivé tout souriant ce matin 🌞', '#3ECDB5'),
    mk(lucas.id, 9, 30, 'biberon', 'Biberon du matin', '180ml — bu entièrement', '#FF6B6B'),
    mk(lucas.id, 10, 15, 'change', 'Change', 'Couche propre, peau OK', '#66BB6A'),
    mk(lucas.id, 10, 45, 'activite', 'Atelier peinture', 'Lucas a adoré tremper ses mains dans la peinture verte 🎨', '#8B6BE8'),
    mk(lucas.id, 12, 0, 'repas', 'Déjeuner', 'Purée carotte + compote pomme — assiette finie 🍽️', '#FF6B6B'),
    mk(lucas.id, 13, 0, 'sieste', 'Sieste', 'Endormi à 13h, réveil prévu vers 15h 😴', '#42A5F5'),
    mk(noah.id, 8, 30, 'arrivee', 'Arrivée à la crèche', 'Noah un peu fatigué ce matin', '#3ECDB5'),
    mk(noah.id, 9, 45, 'biberon', 'Biberon', '150ml — bu en entier', '#FF6B6B'),
    mk(noah.id, 11, 30, 'sieste', 'Sieste matin', 'A bien dormi 1h30', '#42A5F5'),
  ]);

  await db.collection('pointages').insertMany([
    { id: uuidv4(), creche_id: crecheId, employe_id: pro1.id, type: 'arrivee', heure: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 50).toISOString(), date: todayKey() },
    { id: uuidv4(), creche_id: crecheId, employe_id: pro2.id, type: 'arrivee', heure: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 5).toISOString(), date: todayKey() },
  ]);

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  await db.collection('factures').insertMany(childDocs.map((c) => ({
    id: uuidv4(), creche_id: crecheId, enfant_id: c.id,
    famille: `Famille ${c.prenom}`, montant: c.mensualite, mois: monthLabel,
    statut: Math.random() > 0.3 ? 'payee' : 'en_attente', date: new Date(),
  })));

  await db.collection('messages').insertMany([
    { id: uuidv4(), creche_id: crecheId, from_id: par1.id, from_nom: `${par1.prenom} ${par1.nom}`, from_role: 'parent', to_role: 'admin', contenu: 'Bonjour, Lucas aura un peu de retard demain matin.', lu: false, created_at: new Date(Date.now() - 3600000) },
    { id: uuidv4(), creche_id: crecheId, from_id: admin.id, from_nom: `${admin.prenom} ${admin.nom}`, from_role: 'admin', to_role: 'parent', to_id: par1.id, contenu: 'Pas de souci Jean, à demain ! 🌺', lu: true, created_at: new Date(Date.now() - 3000000) },
  ]);

  return true;
}

async function handle(request, params) {
  const db = await getDb();
  await seedIfEmpty(db);

  const path = params?.path || [];
  const route = path.join('/');
  const method = request.method;

  if (route === 'auth/login' && method === 'POST') {
    const { email, password } = await request.json();
    if (!email || !password) return err('Email et mot de passe requis');
    const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
    if (!user) return err('Identifiants invalides', 401);
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return err('Identifiants invalides', 401);
    const token = signToken(user);
    return json({ token, user: { id: user.id, email: user.email, role: user.role, prenom: user.prenom, nom: user.nom, creche_id: user.creche_id } });
  }

  if (route === 'auth/register' && method === 'POST') {
    const { email, password, prenom, nom, role } = await request.json();
    if (!email || !password || !prenom || !nom) return err('Champs manquants');
    const exists = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
    if (exists) return err('Email déjà utilisé', 409);
    const hash = await bcrypt.hash(password, 8);
    const creche = await db.collection('creches').findOne({});
    const user = { id: uuidv4(), email: email.toLowerCase().trim(), password: hash, role: role || 'parent', creche_id: creche.id, prenom, nom, created_at: new Date() };
    await db.collection('users').insertOne(user);
    const token = signToken(user);
    return json({ token, user: { id: user.id, email: user.email, role: user.role, prenom, nom, creche_id: user.creche_id } });
  }

  if (route === 'auth/me' && method === 'GET') {
    const u = getAuth(request);
    if (!u) return err('Non authentifié', 401);
    return json({ user: u });
  }

  const user = getAuth(request);
  if (!user) return err('Non authentifié', 401);

  if (route === 'enfants' && method === 'GET') {
    let q = { creche_id: user.creche_id };
    if (user.role === 'parent') q.parent_ids = user.id;
    const enfants = await db.collection('enfants').find(q).sort({ prenom: 1 }).toArray();
    return json({ enfants: enfants.map(({ _id, ...e }) => e) });
  }

  if (route.startsWith('enfants/') && method === 'GET') {
    const id = path[1];
    const e = await db.collection('enfants').findOne({ id, creche_id: user.creche_id });
    if (!e) return err('Enfant introuvable', 404);
    if (user.role === 'parent' && !(e.parent_ids || []).includes(user.id)) return err('Accès refusé', 403);
    const { _id, ...rest } = e;
    return json({ enfant: rest });
  }

  if (route === 'enfants' && method === 'POST' && user.role === 'admin') {
    const b = await request.json();
    const e = {
      id: uuidv4(), creche_id: user.creche_id, prenom: b.prenom, nom: b.nom || '',
      date_naissance: b.date_naissance || null, groupe: b.groupe || 'Tournesol',
      contrat_heures: b.contrat_heures || 35, mensualite: b.mensualite || 500,
      avatar_color: b.avatar_color || '#3ECDB5', avatar_url: null,
      parent_ids: b.parent_ids || [], created_at: new Date()
    };
    await db.collection('enfants').insertOne(e);
    return json({ enfant: e });
  }

  if (route === 'transmissions' && method === 'GET') {
    const url = new URL(request.url);
    const enfant_id = url.searchParams.get('enfant_id');
    const date = url.searchParams.get('date');
    const q = { creche_id: user.creche_id };
    if (enfant_id) q.enfant_id = enfant_id;
    if (date) {
      const start = new Date(date + 'T00:00:00').toISOString();
      const end = new Date(date + 'T23:59:59').toISOString();
      q.heure = { $gte: start, $lte: end };
    }
    if (user.role === 'parent') {
      const ids = (await db.collection('enfants').find({ creche_id: user.creche_id, parent_ids: user.id }).toArray()).map(x => x.id);
      q.enfant_id = enfant_id && ids.includes(enfant_id) ? enfant_id : { $in: ids };
      q.visible_parents = true;
    }
    const list = await db.collection('transmissions').find(q).sort({ heure: -1 }).limit(200).toArray();
    return json({ transmissions: list.map(({ _id, ...x }) => x) });
  }

  if (route === 'transmissions' && method === 'POST' && (user.role === 'admin' || user.role === 'pro')) {
    const b = await request.json();
    const colorMap = { arrivee:'#3ECDB5', repas:'#FF6B6B', biberon:'#FF6B6B', change:'#66BB6A', sieste:'#42A5F5', activite:'#8B6BE8', note:'#FFA726', sortie:'#66BB6A', gouter:'#FFA726', bain:'#42A5F5', sante:'#FF6B6B' };
    const t = {
      id: uuidv4(), creche_id: user.creche_id, enfant_id: b.enfant_id,
      auteur_id: user.id, auteur_nom: `${user.prenom} ${user.nom}`,
      type: b.type || 'note', titre: b.titre || b.type, detail: b.detail || '',
      color: colorMap[b.type] || '#FFA726', heure: b.heure || new Date().toISOString(),
      visible_parents: b.visible_parents !== false, created_at: new Date()
    };
    await db.collection('transmissions').insertOne(t);
    const { _id, ...rest } = t;
    return json({ transmission: rest });
  }

  if (route.startsWith('transmissions/') && method === 'DELETE' && (user.role === 'admin' || user.role === 'pro')) {
    const id = path[1];
    await db.collection('transmissions').deleteOne({ id, creche_id: user.creche_id });
    return json({ ok: true });
  }

  if (route === 'dashboard/stats' && method === 'GET') {
    const today = todayKey();
    const start = new Date(today + 'T00:00:00').toISOString();
    const end = new Date(today + 'T23:59:59').toISOString();
    const trans = await db.collection('transmissions').find({ creche_id: user.creche_id, heure: { $gte: start, $lte: end } }).toArray();
    const enfants = await db.collection('enfants').countDocuments({ creche_id: user.creche_id });
    const employes = await db.collection('users').countDocuments({ creche_id: user.creche_id, role: 'pro' });
    const ptg = await db.collection('pointages').find({ creche_id: user.creche_id, date: today, type: 'arrivee' }).toArray();
    const factures = await db.collection('factures').find({ creche_id: user.creche_id }).toArray();
    const ca = factures.reduce((s,f) => s + (f.statut === 'payee' ? f.montant : 0), 0);
    return json({ stats: {
      siestes: trans.filter(t => t.type === 'sieste').length,
      biberons: trans.filter(t => t.type === 'biberon').length,
      changes: trans.filter(t => t.type === 'change').length,
      repas: trans.filter(t => t.type === 'repas').length,
      activites: trans.filter(t => t.type === 'activite').length,
      enfants_total: enfants, employes_total: employes, employes_presents: ptg.length,
      ca_mensuel: ca, taux_occupation: Math.min(100, Math.round((enfants / 24) * 100)),
      ca_attendu: factures.reduce((s,f)=>s+f.montant,0),
    }});
  }

  if (route === 'pointage' && method === 'POST' && user.role === 'pro') {
    const { type } = await request.json();
    const p = { id: uuidv4(), creche_id: user.creche_id, employe_id: user.id, type, heure: new Date().toISOString(), date: todayKey() };
    await db.collection('pointages').insertOne(p);
    const { _id, ...rest } = p;
    return json({ pointage: rest });
  }

  if (route === 'pointages' && method === 'GET') {
    const q = { creche_id: user.creche_id };
    if (user.role === 'pro') q.employe_id = user.id;
    const list = await db.collection('pointages').find(q).sort({ heure: -1 }).limit(100).toArray();
    return json({ pointages: list.map(({_id, ...x}) => x) });
  }

  if (route === 'factures' && method === 'GET') {
    const q = { creche_id: user.creche_id };
    if (user.role === 'parent') {
      const ids = (await db.collection('enfants').find({ creche_id: user.creche_id, parent_ids: user.id }).toArray()).map(x => x.id);
      q.enfant_id = { $in: ids };
    }
    const list = await db.collection('factures').find(q).sort({ date: -1 }).toArray();
    return json({ factures: list.map(({_id, ...x}) => x) });
  }

  if (route === 'employes' && method === 'GET' && user.role === 'admin') {
    const list = await db.collection('users').find({ creche_id: user.creche_id, role: 'pro' }).toArray();
    return json({ employes: list.map(({_id, password, ...x}) => x) });
  }

  if (route === 'messages' && method === 'GET') {
    const q = { creche_id: user.creche_id };
    if (user.role === 'parent') {
      q.$or = [ { from_id: user.id }, { to_id: user.id } ];
    }
    const list = await db.collection('messages').find(q).sort({ created_at: 1 }).limit(200).toArray();
    return json({ messages: list.map(({_id, ...x}) => x) });
  }

  if (route === 'messages' && method === 'POST') {
    const { contenu, to_role, to_id } = await request.json();
    if (!contenu) return err('Message vide');
    const m = {
      id: uuidv4(), creche_id: user.creche_id,
      from_id: user.id, from_nom: `${user.prenom} ${user.nom}`, from_role: user.role,
      to_role: to_role || (user.role === 'parent' ? 'admin' : 'parent'),
      to_id: to_id || null, contenu, lu: false, created_at: new Date()
    };
    await db.collection('messages').insertOne(m);
    const { _id, ...rest } = m;
    return json({ message: rest });
  }

  return err('Route introuvable: ' + route, 404);
}

export async function GET(request, { params }) { try { return await handle(request, params); } catch (e) { console.error(e); return err(e.message, 500); } }
export async function POST(request, { params }) { try { return await handle(request, params); } catch (e) { console.error(e); return err(e.message, 500); } }
export async function PUT(request, { params }) { try { return await handle(request, params); } catch (e) { console.error(e); return err(e.message, 500); } }
export async function DELETE(request, { params }) { try { return await handle(request, params); } catch (e) { console.error(e); return err(e.message, 500); } }
