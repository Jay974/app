import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const runtime = 'nodejs';

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME && process.env.DB_NAME !== 'your_database_name' ? process.env.DB_NAME : 'timetis';
const JWT_SECRET = process.env.JWT_SECRET || 'timetis-dev-secret-974';

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
const clean = (arr) => arr.map(({ _id, password, ...x }) => x);
const one = (doc) => { if (!doc) return null; const { _id, password, ...x } = doc; return x; };

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, creche_ids: user.creche_ids || (user.creche_id ? [user.creche_id] : []), creche_id: user.creche_id, prenom: user.prenom, nom: user.nom },
    JWT_SECRET, { expiresIn: '30d' }
  );
}

function getAuth(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

const todayKey = () => new Date().toISOString().slice(0, 10);

// Get active crèche id from user + query param
function activeCrecheId(user, request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('creche_id');
  if (user.role === 'super_admin') return q || null;
  if (user.role === 'admin') {
    const ids = user.creche_ids || [];
    if (q && ids.includes(q)) return q;
    return ids[0] || null;
  }
  return user.creche_id || null;
}

// ===================== SEED =====================
async function seedIfEmpty(db) {
  const cnt = await db.collection('users').countDocuments();
  if (cnt > 0) return false;

  const hash = await bcrypt.hash('demo1234', 8);
  const superHash = await bcrypt.hash('TiMetis974!', 8);

  // Super admin
  const superAdmin = { id: uuidv4(), email: 'jeanchrisoulia@gmail.com', password: superHash, role: 'super_admin', prenom: 'Jean-Chris', nom: 'OULIA', pseudo: 'JayPro', creche_ids: [], created_at: new Date() };
  await db.collection('users').insertOne(superAdmin);

  // Client admin 1: Marie Hoarau (2 crèches)
  const marieId = uuidv4();
  const crecheA = { id: uuidv4(), owner_id: marieId, nom: "Les P'tits Bouts", ville: 'Saint-Denis', region: 'La Réunion', slug: 'les-ptits-bouts-sd', adresse: '12 rue des Flamboyants, 97400', telephone: '0262 21 00 00', email: 'sd@lesptitsbouts.re', capacite: 24, created_at: new Date() };
  const crecheB = { id: uuidv4(), owner_id: marieId, nom: "Les P'tits Bouts", ville: 'Saint-Paul', region: 'La Réunion', slug: 'les-ptits-bouts-sp', adresse: '5 chemin des Palmiers, 97460', telephone: '0262 45 00 00', email: 'sp@lesptitsbouts.re', capacite: 18, created_at: new Date() };
  await db.collection('creches').insertMany([crecheA, crecheB]);

  const marie = { id: marieId, email: 'admin@demo.re', password: hash, role: 'admin', prenom: 'Marie', nom: 'Hoarau', creche_ids: [crecheA.id, crecheB.id], subscription: { status: 'trialing', plan: 'timetis-79', created_at: new Date() }, created_at: new Date() };

  // Client admin 2: Sophie Dubois (1 crèche)
  const sophieId = uuidv4();
  const crecheC = { id: uuidv4(), owner_id: sophieId, nom: 'Doudou 974', ville: 'Saint-Pierre', region: 'La Réunion', slug: 'doudou-974', adresse: '8 rue du Port, 97410', telephone: '0262 35 00 00', email: 'contact@doudou974.re', capacite: 16, created_at: new Date() };
  await db.collection('creches').insertOne(crecheC);
  const sophie = { id: sophieId, email: 'admin2@demo.re', password: hash, role: 'admin', prenom: 'Sophie', nom: 'Dubois', creche_ids: [crecheC.id], subscription: { status: 'active', plan: 'timetis-79', created_at: new Date() }, created_at: new Date() };

  await db.collection('users').insertMany([marie, sophie]);

  // Pros for crecheA
  const defaultContrat = {
    heures_hebdo: 35,
    jours: {
      lundi: { arrivee: '08:00', depart: '15:00', pause_min: 30 },
      mardi: { arrivee: '08:00', depart: '15:00', pause_min: 30 },
      mercredi: { arrivee: '08:00', depart: '15:00', pause_min: 30 },
      jeudi: { arrivee: '08:00', depart: '15:00', pause_min: 30 },
      vendredi: { arrivee: '08:00', depart: '15:00', pause_min: 30 },
      samedi: null, dimanche: null,
    }
  };
  const pro1 = { id: uuidv4(), email: 'pro@demo.re', password: hash, role: 'pro', creche_id: crecheA.id, prenom: 'Aurélie', nom: 'Payet', poste: 'Auxiliaire de puériculture', contrat_horaires: defaultContrat, taux_horaire: 12.5, created_at: new Date() };
  const pro2 = { id: uuidv4(), email: 'pro2@demo.re', password: hash, role: 'pro', creche_id: crecheA.id, prenom: 'Sandra', nom: 'Grondin', poste: 'Éducatrice de jeunes enfants', contrat_horaires: { ...defaultContrat, heures_hebdo: 30, jours: { ...defaultContrat.jours, vendredi: null } }, taux_horaire: 14, created_at: new Date() };
  // Parents
  const par1 = { id: uuidv4(), email: 'parent@demo.re', password: hash, role: 'parent', creche_id: crecheA.id, prenom: 'Jean', nom: 'Bègue', tel: '0692 11 22 33', created_at: new Date() };
  const par2 = { id: uuidv4(), email: 'parent2@demo.re', password: hash, role: 'parent', creche_id: crecheA.id, prenom: 'Élodie', nom: 'Técher', tel: '0692 44 55 66', created_at: new Date() };
  await db.collection('users').insertMany([pro1, pro2, par1, par2]);

  // Groupes for crecheA
  const groupes = [
    { id: uuidv4(), creche_id: crecheA.id, nom: 'Tournesol', couleur: '#FFA726', capacite: 8, tranche_age: '3-12 mois' },
    { id: uuidv4(), creche_id: crecheA.id, nom: 'Coquelicot', couleur: '#FF6B6B', capacite: 8, tranche_age: '12-24 mois' },
    { id: uuidv4(), creche_id: crecheA.id, nom: 'Marguerite', couleur: '#66BB6A', capacite: 8, tranche_age: '24-36 mois' },
  ];
  await db.collection('groupes').insertMany(groupes);

  // Tags
  const tags = ['Allergie lait', 'Allergie gluten', 'Sieste longue', 'Sensible bruit', 'Aime la musique', 'Végétarien'].map((n,i) => ({
    id: uuidv4(), creche_id: crecheA.id, nom: n, couleur: ['#FF6B6B','#FFA726','#8B6BE8','#42A5F5','#66BB6A','#F06292'][i]
  }));
  await db.collection('tags').insertMany(tags);

  // Familles
  const fam1 = { id: uuidv4(), creche_id: crecheA.id, nom: 'Famille Bègue', parents: [par1.id], adresse: '10 rue Jean Jaurès, Saint-Denis', tel: par1.tel, created_at: new Date() };
  const fam2 = { id: uuidv4(), creche_id: crecheA.id, nom: 'Famille Técher', parents: [par2.id], adresse: '25 avenue de la Mer, Saint-Denis', tel: par2.tel, created_at: new Date() };
  await db.collection('familles').insertMany([fam1, fam2]);

  // Enfants
  const childColors = ['#FF6B6B', '#FFA726', '#8B6BE8', '#42A5F5', '#66BB6A'];
  const childData = [
    { prenom: 'Lucas',  age_mois: 14, groupe_id: groupes[1].id, groupe: 'Coquelicot', contrat: 35, mens: 520, famille: fam1, tags: [tags[2].id] },
    { prenom: 'Emma',   age_mois: 8,  groupe_id: groupes[0].id, groupe: 'Tournesol',  contrat: 30, mens: 460, famille: fam2, tags: [tags[0].id] },
    { prenom: 'Chloé',  age_mois: 18, groupe_id: groupes[1].id, groupe: 'Coquelicot', contrat: 40, mens: 580, famille: fam2, tags: [tags[4].id] },
    { prenom: 'Noah',   age_mois: 10, groupe_id: groupes[0].id, groupe: 'Tournesol',  contrat: 35, mens: 520, famille: fam1, tags: [] },
    { prenom: 'Léa',    age_mois: 30, groupe_id: groupes[2].id, groupe: 'Marguerite', contrat: 40, mens: 580, famille: fam2, tags: [tags[5].id] },
  ];
  const childDocs = childData.map((c,i) => {
    const b = new Date(); b.setMonth(b.getMonth()-c.age_mois);
    return {
      id: uuidv4(), creche_id: crecheA.id, famille_id: c.famille.id,
      prenom: c.prenom, nom: c.famille.nom.replace('Famille ',''),
      date_naissance: b.toISOString().slice(0,10),
      groupe_id: c.groupe_id, groupe: c.groupe,
      contrat_heures: c.contrat, mensualite: c.mens,
      avatar_color: childColors[i], avatar_url: null,
      parent_ids: c.famille.parents, tags: c.tags,
      notes: '', allergies: c.tags.includes(tags[0].id) ? 'Lait de vache' : '',
      created_at: new Date(),
    };
  });
  await db.collection('enfants').insertMany(childDocs);
  // Update familles with enfants ids
  await db.collection('familles').updateOne({ id: fam1.id }, { $set: { enfants: [childDocs[0].id, childDocs[3].id] } });
  await db.collection('familles').updateOne({ id: fam2.id }, { $set: { enfants: [childDocs[1].id, childDocs[2].id, childDocs[4].id] } });

  // Transmissions
  const lucas = childDocs[0], noah = childDocs[3];
  const now = new Date();
  const mk = (eid, h, m, type, titre, detail, color) => ({
    id: uuidv4(), creche_id: crecheA.id, enfant_id: eid,
    auteur_id: pro1.id, auteur_nom: `${pro1.prenom} ${pro1.nom}`,
    type, titre, detail, color,
    heure: new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).toISOString(),
    visible_parents: true, created_at: new Date(),
  });
  await db.collection('transmissions').insertMany([
    mk(lucas.id, 8, 15, 'arrivee', 'Arrivée à la crèche', 'Lucas est arrivé tout souriant 🌞', '#3ECDB5'),
    mk(lucas.id, 9, 30, 'biberon', 'Biberon du matin', '180ml — bu entièrement', '#FF6B6B'),
    mk(lucas.id, 10, 15, 'change', 'Change', 'Couche propre, peau OK', '#66BB6A'),
    mk(lucas.id, 10, 45, 'activite', 'Atelier peinture', 'Lucas a adoré 🎨', '#8B6BE8'),
    mk(lucas.id, 12, 0, 'repas', 'Déjeuner', 'Purée carotte + compote pomme — assiette finie 🍽️', '#FF6B6B'),
    mk(lucas.id, 13, 0, 'sieste', 'Sieste', 'Endormi à 13h, réveil vers 15h 😴', '#42A5F5'),
    mk(noah.id, 8, 30, 'arrivee', 'Arrivée', 'Noah un peu fatigué', '#3ECDB5'),
    mk(noah.id, 9, 45, 'biberon', 'Biberon', '150ml bu', '#FF6B6B'),
    mk(noah.id, 11, 30, 'sieste', 'Sieste matin', '1h30 de sommeil', '#42A5F5'),
  ]);

  // Pointages
  await db.collection('pointages').insertMany([
    { id: uuidv4(), creche_id: crecheA.id, employe_id: pro1.id, type: 'arrivee', heure: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 50).toISOString(), date: todayKey() },
    { id: uuidv4(), creche_id: crecheA.id, employe_id: pro2.id, type: 'arrivee', heure: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 5).toISOString(), date: todayKey() },
  ]);

  // Factures
  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  await db.collection('factures').insertMany(childDocs.map(c => ({
    id: uuidv4(), creche_id: crecheA.id, enfant_id: c.id, famille_id: c.famille_id,
    famille: `Famille ${c.nom}`, numero: 'F-' + Math.floor(1000 + Math.random()*9000),
    articles: [{ description: `Accueil régulier ${c.prenom} · ${monthLabel}`, quantite: 1, prix_unit: c.mensualite, tva: 0 }],
    montant: c.mensualite, total_ht: c.mensualite, total_ttc: c.mensualite,
    mois: monthLabel, echeance: new Date(Date.now()+15*86400000).toISOString().slice(0,10),
    statut: Math.random() > 0.3 ? 'payee' : 'en_attente', envoyee: true, date: new Date(),
  })));

  // Devis exemple
  await db.collection('devis').insertOne({
    id: uuidv4(), creche_id: crecheA.id, numero: 'D-2401',
    famille_id: fam2.id, famille: 'Famille Técher',
    articles: [
      { description: 'Frais d\'inscription', quantite: 1, prix_unit: 150, tva: 0 },
      { description: 'Accueil régulier · 40h/sem', quantite: 1, prix_unit: 580, tva: 0 },
    ],
    total_ht: 730, total_ttc: 730, statut: 'envoye',
    valide_jusqu: new Date(Date.now()+30*86400000).toISOString().slice(0,10),
    date: new Date(), created_at: new Date(),
  });

  // Messages (broadcast — legacy)
  await db.collection('messages').insertMany([
    { id: uuidv4(), creche_id: crecheA.id, from_id: par1.id, from_nom: `${par1.prenom} ${par1.nom}`, from_role: 'parent', to_role: 'admin', contenu: 'Bonjour, Lucas aura un peu de retard demain matin.', lu: false, created_at: new Date(Date.now() - 3600000) },
    { id: uuidv4(), creche_id: crecheA.id, from_id: marieId, from_nom: 'Marie Hoarau', from_role: 'admin', to_role: 'parent', to_id: par1.id, contenu: 'Pas de souci Jean, à demain ! 🌺', lu: true, created_at: new Date(Date.now() - 3000000) },
  ]);

  // Threads pro <-> parent (1-to-1)
  const thread1 = {
    id: uuidv4(), creche_id: crecheA.id, participants: [pro1.id, par1.id],
    enfant_id: lucas.id, last_message_at: new Date(),
    labels: { [pro1.id]: `${par1.prenom} ${par1.nom} · ${lucas.prenom}`, [par1.id]: `${pro1.prenom} (crèche)` },
    created_at: new Date()
  };
  await db.collection('threads').insertOne(thread1);
  await db.collection('thread_messages').insertMany([
    { id: uuidv4(), thread_id: thread1.id, from_id: pro1.id, from_nom: `${pro1.prenom} ${pro1.nom}`, contenu: 'Bonjour Jean ! Voici une photo de Lucas ce matin 📸', media: null, created_at: new Date(Date.now()-2400000) },
    { id: uuidv4(), thread_id: thread1.id, from_id: par1.id, from_nom: `${par1.prenom} ${par1.nom}`, contenu: 'Merci Aurélie, il a l\'air ravi ! 🌸', media: null, created_at: new Date(Date.now()-2100000) },
  ]);

  // Nourriture (menu semaine)
  const jours = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi'];
  const menus = [
    { midi: 'Poulet rôti, purée de courgette', gouter: 'Yaourt nature + banane' },
    { midi: 'Poisson vapeur, riz basmati', gouter: 'Compote pomme-poire' },
    { midi: 'Boulettes bœuf, semoule légumes', gouter: 'Fromage blanc + miel' },
    { midi: 'Colombo poulet, riz créole', gouter: 'Fruits de saison' },
    { midi: 'Cari végétarien, patate douce', gouter: 'Cake maison' },
  ];
  await db.collection('nourriture').insertOne({
    id: uuidv4(), creche_id: crecheA.id, semaine: new Date().toISOString().slice(0,10),
    repas: jours.map((j,i) => ({ jour: j, ...menus[i] })), created_at: new Date()
  });

  // Rappels
  await db.collection('rappels').insertMany([
    { id: uuidv4(), creche_id: crecheA.id, titre: 'Vaccin ROR — Lucas', echeance: new Date(Date.now()+15*86400000).toISOString().slice(0,10), cible: 'admin', enfant_id: lucas.id, statut: 'actif', priorite: 'moyenne', created_at: new Date() },
    { id: uuidv4(), creche_id: crecheA.id, titre: 'Renouveler assurance crèche', echeance: new Date(Date.now()+30*86400000).toISOString().slice(0,10), cible: 'admin', statut: 'actif', priorite: 'haute', created_at: new Date() },
    { id: uuidv4(), creche_id: crecheA.id, titre: 'Sortie parc — permission parents', echeance: new Date(Date.now()+5*86400000).toISOString().slice(0,10), cible: 'pros', statut: 'actif', priorite: 'basse', created_at: new Date() },
  ]);

  // News
  await db.collection('news').insertMany([
    { id: uuidv4(), creche_id: crecheA.id, titre: '🌺 Fête créole vendredi', contenu: 'Nous organisons une petite fête créole ce vendredi. Vos enfants peuvent venir en tenue traditionnelle !', image_url: null, cible: 'parents', pinned: true, created_at: new Date() },
    { id: uuidv4(), creche_id: crecheA.id, titre: 'Fermeture du 15 au 20', contenu: 'La crèche sera fermée pour travaux du 15 au 20. Merci de votre compréhension.', image_url: null, cible: 'tous', pinned: false, created_at: new Date(Date.now()-86400000) },
  ]);

  // Documents (metadata seulement, url null pour l'instant)
  await db.collection('documents').insertMany([
    { id: uuidv4(), creche_id: crecheA.id, titre: 'Règlement intérieur 2025', type: 'pdf', url: null, cible: 'tous', taille: 245000, created_at: new Date() },
    { id: uuidv4(), creche_id: crecheA.id, titre: 'Protocole évacuation', type: 'pdf', url: null, cible: 'pros', taille: 128000, created_at: new Date() },
  ]);

  return true;
}

// ===================== ROUTER =====================
async function handle(request, params) {
  const db = await getDb();
  await seedIfEmpty(db);

  const path = params?.path || [];
  const route = path.join('/');
  const method = request.method;

  // ---- AUTH PUBLIC ----
  if (route === 'auth/login' && method === 'POST') {
    const { email, password } = await request.json();
    if (!email || !password) return err('Email et mot de passe requis');
    const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
    if (!user) return err('Identifiants invalides', 401);
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return err('Identifiants invalides', 401);
    const token = signToken(user);
    return json({ token, user: {
      id: user.id, email: user.email, role: user.role, prenom: user.prenom, nom: user.nom,
      creche_ids: user.creche_ids || (user.creche_id ? [user.creche_id] : []),
      creche_id: user.creche_id, pseudo: user.pseudo,
      subscription: user.subscription || null,
    }});
  }

  if (route === 'auth/register' && method === 'POST') {
    const { email, password, prenom, nom, role, creche_nom, creche_ville } = await request.json();
    if (!email || !password || !prenom || !nom) return err('Champs manquants');
    const exists = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
    if (exists) return err('Email déjà utilisé', 409);
    const hash = await bcrypt.hash(password, 8);
    const finalRole = role || 'admin';
    const userId = uuidv4();
    let creche_ids = [];
    let creche_id = null;

    if (finalRole === 'admin') {
      // Créer une nouvelle crèche pour ce client admin
      const c = {
        id: uuidv4(), owner_id: userId,
        nom: creche_nom || 'Ma crèche', ville: creche_ville || 'Saint-Denis',
        region: 'La Réunion', slug: (creche_nom || 'creche').toLowerCase().replace(/\s+/g,'-'),
        capacite: 20, created_at: new Date()
      };
      await db.collection('creches').insertOne(c);
      creche_ids = [c.id];
    } else {
      const cre = await db.collection('creches').findOne({});
      creche_id = cre?.id;
    }
    const user = {
      id: userId, email: email.toLowerCase().trim(), password: hash,
      role: finalRole, prenom, nom,
      creche_ids: finalRole === 'admin' ? creche_ids : [],
      creche_id, subscription: finalRole === 'admin' ? { status: 'trialing', plan: 'timetis-79', created_at: new Date() } : null,
      created_at: new Date()
    };
    await db.collection('users').insertOne(user);
    const token = signToken(user);
    return json({ token, user: {
      id: user.id, email: user.email, role: user.role, prenom, nom,
      creche_ids: user.creche_ids, creche_id: user.creche_id, subscription: user.subscription
    }});
  }

  if (route === 'auth/me' && method === 'GET') {
    const u = getAuth(request);
    if (!u) return err('Non authentifié', 401);
    const full = await db.collection('users').findOne({ id: u.id });
    return json({ user: one(full) });
  }

  // ---- AUTH REQUIRED ----
  const user = getAuth(request);
  if (!user) return err('Non authentifié', 401);
  const activeCId = activeCrecheId(user, request);

  // ---- SUPER ADMIN ----
  if (route === 'super/clients' && method === 'GET' && user.role === 'super_admin') {
    const admins = await db.collection('users').find({ role: 'admin' }).toArray();
    const enrich = await Promise.all(admins.map(async (a) => {
      const creches = await db.collection('creches').find({ owner_id: a.id }).toArray();
      const nbEnfants = await db.collection('enfants').countDocuments({ creche_id: { $in: creches.map(c=>c.id) } });
      return { ...one(a), creches: clean(creches), nb_enfants: nbEnfants };
    }));
    return json({ clients: enrich });
  }

  if (route === 'super/stats' && method === 'GET' && user.role === 'super_admin') {
    const admins = await db.collection('users').countDocuments({ role: 'admin' });
    const active = await db.collection('users').countDocuments({ role: 'admin', 'subscription.status': 'active' });
    const trialing = await db.collection('users').countDocuments({ role: 'admin', 'subscription.status': 'trialing' });
    const creches = await db.collection('creches').countDocuments();
    const enfants = await db.collection('enfants').countDocuments();
    return json({ stats: {
      clients: admins, actifs: active, essais: trialing,
      creches, enfants, mrr: active * 79
    }});
  }

  // ---- CRECHES (admin manages own) ----
  if (route === 'creches' && method === 'GET') {
    let q = {};
    if (user.role === 'admin') q.owner_id = user.id;
    else if (user.role !== 'super_admin') q.id = user.creche_id;
    const list = await db.collection('creches').find(q).toArray();
    return json({ creches: clean(list) });
  }

  if (route === 'creches' && method === 'POST' && user.role === 'admin') {
    const b = await request.json();
    const c = { id: uuidv4(), owner_id: user.id, nom: b.nom, ville: b.ville, region: 'La Réunion',
      slug: (b.nom||'creche').toLowerCase().replace(/\s+/g,'-'), adresse: b.adresse||'', capacite: b.capacite||20, created_at: new Date() };
    await db.collection('creches').insertOne(c);
    await db.collection('users').updateOne({ id: user.id }, { $addToSet: { creche_ids: c.id } });
    return json({ creche: c });
  }

  // ---- ENFANTS ----
  if (route === 'enfants' && method === 'GET') {
    let q = {};
    if (user.role === 'admin') q.creche_id = { $in: activeCId ? [activeCId] : (user.creche_ids || []) };
    else if (user.role === 'super_admin') q.creche_id = activeCId || { $exists: true };
    else if (user.role === 'parent') { q.creche_id = user.creche_id; q.parent_ids = user.id; }
    else q.creche_id = user.creche_id;
    const list = await db.collection('enfants').find(q).sort({ prenom: 1 }).toArray();
    return json({ enfants: clean(list) });
  }
  if (route.startsWith('enfants/') && path.length === 2 && method === 'GET') {
    const e = await db.collection('enfants').findOne({ id: path[1] });
    if (!e) return err('Introuvable', 404);
    if (user.role === 'parent' && !(e.parent_ids||[]).includes(user.id)) return err('Accès refusé', 403);
    return json({ enfant: one(e) });
  }
  if (route === 'enfants' && method === 'POST' && (user.role === 'admin' || user.role === 'super_admin')) {
    const b = await request.json();
    const cid = b.creche_id || activeCId;
    const e = { id: uuidv4(), creche_id: cid, prenom: b.prenom, nom: b.nom||'',
      date_naissance: b.date_naissance||null, groupe_id: b.groupe_id||null, groupe: b.groupe||'Tournesol',
      contrat_heures: b.contrat_heures||35, mensualite: b.mensualite||500,
      avatar_color: b.avatar_color||'#3ECDB5', avatar_url: null,
      parent_ids: b.parent_ids||[], famille_id: b.famille_id||null, tags: b.tags||[],
      notes: b.notes||'', allergies: b.allergies||'', created_at: new Date() };
    await db.collection('enfants').insertOne(e);
    return json({ enfant: e });
  }
  if (route.startsWith('enfants/') && path.length === 2 && method === 'PUT') {
    const b = await request.json();
    delete b._id; delete b.id; delete b.created_at;
    await db.collection('enfants').updateOne({ id: path[1] }, { $set: b });
    const upd = await db.collection('enfants').findOne({ id: path[1] });
    return json({ enfant: one(upd) });
  }

  // ---- TRANSMISSIONS ----
  if (route === 'transmissions' && method === 'GET') {
    const url = new URL(request.url);
    const enfant_id = url.searchParams.get('enfant_id');
    const date = url.searchParams.get('date');
    const q = {};
    if (user.role === 'admin') q.creche_id = { $in: activeCId ? [activeCId] : (user.creche_ids||[]) };
    else if (user.role !== 'super_admin') q.creche_id = user.creche_id;
    if (enfant_id) q.enfant_id = enfant_id;
    if (date) { q.heure = { $gte: new Date(date+'T00:00:00').toISOString(), $lte: new Date(date+'T23:59:59').toISOString() }; }
    if (user.role === 'parent') {
      const ids = (await db.collection('enfants').find({ parent_ids: user.id }).toArray()).map(x=>x.id);
      q.enfant_id = enfant_id && ids.includes(enfant_id) ? enfant_id : { $in: ids };
      q.visible_parents = true;
    }
    const list = await db.collection('transmissions').find(q).sort({ heure: -1 }).limit(200).toArray();
    return json({ transmissions: clean(list) });
  }
  if (route === 'transmissions' && method === 'POST' && (user.role === 'admin' || user.role === 'pro')) {
    const b = await request.json();
    const colorMap = { arrivee:'#3ECDB5', repas:'#FF6B6B', biberon:'#FF6B6B', change:'#66BB6A', sieste:'#42A5F5', activite:'#8B6BE8', note:'#FFA726', sortie:'#66BB6A', gouter:'#FFA726', bain:'#42A5F5', sante:'#FF6B6B' };
    const enfant = await db.collection('enfants').findOne({ id: b.enfant_id });
    const t = { id: uuidv4(), creche_id: enfant?.creche_id || user.creche_id, enfant_id: b.enfant_id,
      auteur_id: user.id, auteur_nom: `${user.prenom} ${user.nom}`,
      type: b.type||'note', titre: b.titre||b.type, detail: b.detail||'',
      color: colorMap[b.type]||'#FFA726', heure: b.heure||new Date().toISOString(),
      visible_parents: b.visible_parents !== false, created_at: new Date() };
    await db.collection('transmissions').insertOne(t);
    return json({ transmission: one(t) });
  }
  if (route.startsWith('transmissions/') && method === 'DELETE') {
    await db.collection('transmissions').deleteOne({ id: path[1] });
    return json({ ok: true });
  }

  // ---- DASHBOARD ----
  if (route === 'dashboard/stats' && method === 'GET') {
    const today = todayKey();
    const start = new Date(today+'T00:00:00').toISOString();
    const end = new Date(today+'T23:59:59').toISOString();
    let cQ = {};
    if (user.role === 'admin') cQ.creche_id = { $in: activeCId ? [activeCId] : (user.creche_ids||[]) };
    else if (user.role !== 'super_admin') cQ.creche_id = user.creche_id;
    const trans = await db.collection('transmissions').find({ ...cQ, heure: { $gte: start, $lte: end } }).toArray();
    const enfants = await db.collection('enfants').countDocuments(cQ);
    const uQ = user.role === 'admin' ? { role: 'pro', creche_id: { $in: activeCId ? [activeCId] : (user.creche_ids||[]) } } : { role: 'pro', creche_id: user.creche_id };
    const employes = await db.collection('users').countDocuments(uQ);
    const ptg = await db.collection('pointages').find({ ...cQ, date: today, type: 'arrivee' }).toArray();
    const factures = await db.collection('factures').find(cQ).toArray();
    const ca = factures.reduce((s,f)=>s+(f.statut==='payee'?f.montant:0),0);
    const capacite = await db.collection('creches').find(user.role==='admin'?{owner_id:user.id}:{}).toArray();
    const totalCap = capacite.reduce((s,c)=>s+(c.capacite||20),0) || 24;
    return json({ stats: {
      siestes: trans.filter(t=>t.type==='sieste').length,
      biberons: trans.filter(t=>t.type==='biberon').length,
      changes: trans.filter(t=>t.type==='change').length,
      repas: trans.filter(t=>t.type==='repas').length,
      activites: trans.filter(t=>t.type==='activite').length,
      enfants_total: enfants, employes_total: employes, employes_presents: ptg.length,
      ca_mensuel: ca, ca_attendu: factures.reduce((s,f)=>s+f.montant,0),
      taux_occupation: Math.min(100, Math.round((enfants/totalCap)*100)),
    }});
  }

  // ---- POINTAGES ----
  if (route === 'pointage' && method === 'POST' && user.role === 'pro') {
    const { type } = await request.json();
    const p = { id: uuidv4(), creche_id: user.creche_id, employe_id: user.id, type, heure: new Date().toISOString(), date: todayKey() };
    await db.collection('pointages').insertOne(p);
    return json({ pointage: one(p) });
  }
  if (route === 'pointages' && method === 'GET') {
    const q = user.role==='pro' ? { employe_id: user.id } : (user.role==='admin' ? { creche_id: { $in: activeCId?[activeCId]:(user.creche_ids||[]) } } : {});
    const list = await db.collection('pointages').find(q).sort({ heure: -1 }).limit(100).toArray();
    return json({ pointages: clean(list) });
  }

  // ---- FAMILLES ----
  if (route === 'familles' && method === 'GET') {
    let q = {};
    if (user.role === 'admin') q.creche_id = { $in: activeCId?[activeCId]:(user.creche_ids||[]) };
    else if (user.role !== 'super_admin') q.creche_id = user.creche_id;
    const list = await db.collection('familles').find(q).toArray();
    return json({ familles: clean(list) });
  }
  if (route === 'familles' && method === 'POST' && (user.role === 'admin')) {
    const b = await request.json();
    const f = { id: uuidv4(), creche_id: b.creche_id||activeCId, nom: b.nom, parents: b.parents||[], adresse: b.adresse||'', tel: b.tel||'', email: b.email||'', enfants: b.enfants||[], notes: b.notes||'', created_at: new Date() };
    await db.collection('familles').insertOne(f);
    return json({ famille: f });
  }

  if (route.startsWith('familles/') && path.length === 2 && method === 'PUT' && (user.role === 'admin' || user.role === 'pro')) {
    const b = await request.json();
    delete b._id; delete b.id; delete b.created_at;
    await db.collection('familles').updateOne({ id: path[1] }, { $set: b });
    const fresh = await db.collection('familles').findOne({ id: path[1] });
    return json({ famille: one(fresh) });
  }

  if (route.startsWith('familles/') && path.length === 2 && method === 'DELETE' && user.role === 'admin') {
    await db.collection('familles').deleteOne({ id: path[1] });
    return json({ ok: true });
  }

  // ---- GROUPES ----
  if (route === 'groupes' && method === 'GET') {
    let q = {};
    if (user.role === 'admin') q.creche_id = { $in: activeCId?[activeCId]:(user.creche_ids||[]) };
    else if (user.role !== 'super_admin') q.creche_id = user.creche_id;
    const list = await db.collection('groupes').find(q).toArray();
    return json({ groupes: clean(list) });
  }
  if (route === 'groupes' && method === 'POST' && user.role === 'admin') {
    const b = await request.json();
    const g = { id: uuidv4(), creche_id: b.creche_id||activeCId, nom: b.nom, couleur: b.couleur||'#3ECDB5', capacite: b.capacite||8, tranche_age: b.tranche_age||'', created_at: new Date() };
    await db.collection('groupes').insertOne(g);
    return json({ groupe: g });
  }

  // ---- TAGS ----
  if (route === 'tags' && method === 'GET') {
    let q = {};
    if (user.role === 'admin') q.creche_id = { $in: activeCId?[activeCId]:(user.creche_ids||[]) };
    else if (user.role !== 'super_admin') q.creche_id = user.creche_id;
    const list = await db.collection('tags').find(q).toArray();
    return json({ tags: clean(list) });
  }
  if (route === 'tags' && method === 'POST' && (user.role === 'admin' || user.role === 'pro')) {
    const b = await request.json();
    const t = { id: uuidv4(), creche_id: b.creche_id||activeCId||user.creche_id, nom: b.nom, couleur: b.couleur||'#3ECDB5', created_at: new Date() };
    await db.collection('tags').insertOne(t);
    return json({ tag: t });
  }

  // ---- DEVIS ----
  if (route === 'devis' && method === 'GET') {
    let q = {};
    if (user.role === 'admin') q.creche_id = { $in: activeCId?[activeCId]:(user.creche_ids||[]) };
    else if (user.role !== 'super_admin') q.creche_id = user.creche_id;
    const list = await db.collection('devis').find(q).sort({ created_at: -1 }).toArray();
    return json({ devis: clean(list) });
  }
  if (route === 'devis' && method === 'POST' && user.role === 'admin') {
    const b = await request.json();
    const total_ht = (b.articles||[]).reduce((s,a)=>s+((+a.prix_unit||0)*(+a.quantite||1)),0);
    const total_ttc = (b.articles||[]).reduce((s,a)=>s+((+a.prix_unit||0)*(+a.quantite||1))*(1+((+a.tva||0)/100)),0);
    const d = { id: uuidv4(), creche_id: b.creche_id||activeCId, numero: 'D-'+Math.floor(1000+Math.random()*9000),
      famille_id: b.famille_id||null, famille: b.famille||'', articles: b.articles||[],
      total_ht, total_ttc, statut: b.statut||'brouillon',
      valide_jusqu: b.valide_jusqu||new Date(Date.now()+30*86400000).toISOString().slice(0,10),
      date: new Date(), created_at: new Date() };
    await db.collection('devis').insertOne(d);
    return json({ devis: d });
  }
  if (route.startsWith('devis/') && path.length === 2 && method === 'PUT') {
    const b = await request.json();
    delete b._id; delete b.id;
    if (b.articles) {
      b.total_ht = b.articles.reduce((s,a)=>s+((+a.prix_unit||0)*(+a.quantite||1)),0);
      b.total_ttc = b.articles.reduce((s,a)=>s+((+a.prix_unit||0)*(+a.quantite||1))*(1+((+a.tva||0)/100)),0);
    }
    await db.collection('devis').updateOne({ id: path[1] }, { $set: b });
    return json({ ok: true });
  }

  // ---- FACTURES (extended) ----
  if (route === 'factures' && method === 'GET') {
    let q = {};
    if (user.role === 'admin') q.creche_id = { $in: activeCId?[activeCId]:(user.creche_ids||[]) };
    else if (user.role === 'parent') {
      const ids = (await db.collection('enfants').find({ parent_ids: user.id }).toArray()).map(x=>x.id);
      q.enfant_id = { $in: ids };
    } else if (user.role !== 'super_admin') q.creche_id = user.creche_id;
    const list = await db.collection('factures').find(q).sort({ date: -1 }).toArray();
    return json({ factures: clean(list) });
  }
  if (route === 'factures' && method === 'POST' && user.role === 'admin') {
    const b = await request.json();
    const total_ht = (b.articles||[]).reduce((s,a)=>s+((+a.prix_unit||0)*(+a.quantite||1)),0);
    const total_ttc = total_ht; // 0 TVA crèche
    const f = { id: uuidv4(), creche_id: b.creche_id||activeCId, numero: 'F-'+Math.floor(1000+Math.random()*9000),
      famille_id: b.famille_id||null, famille: b.famille||'', enfant_id: b.enfant_id||null,
      articles: b.articles||[], montant: total_ttc, total_ht, total_ttc,
      mois: b.mois||new Date().toLocaleDateString('fr-FR',{month:'long',year:'numeric'}),
      echeance: b.echeance||new Date(Date.now()+15*86400000).toISOString().slice(0,10),
      statut: 'en_attente', envoyee: false, date: new Date(), created_at: new Date() };
    await db.collection('factures').insertOne(f);
    return json({ facture: f });
  }
  if (route.startsWith('factures/') && path.length === 3 && path[2] === 'send' && method === 'POST' && user.role === 'admin') {
    await db.collection('factures').updateOne({ id: path[1] }, { $set: { envoyee: true, envoyee_at: new Date() } });
    return json({ ok: true });
  }
  if (route.startsWith('factures/') && path.length === 3 && path[2] === 'pay' && method === 'POST') {
    await db.collection('factures').updateOne({ id: path[1] }, { $set: { statut: 'payee', paid_at: new Date() } });
    return json({ ok: true });
  }

  // ---- THREADS (Pro <-> Parent 1-to-1) ----
  if (route === 'threads' && method === 'GET') {
    const q = { participants: user.id };
    const list = await db.collection('threads').find(q).sort({ last_message_at: -1 }).toArray();
    // Enrichir avec autre participant
    const enrich = await Promise.all(list.map(async (t) => {
      const others = t.participants.filter(p => p !== user.id);
      const otherUsers = await db.collection('users').find({ id: { $in: others } }).toArray();
      const enfant = t.enfant_id ? await db.collection('enfants').findOne({ id: t.enfant_id }) : null;
      return { ...one(t), others: clean(otherUsers), enfant: one(enfant) };
    }));
    return json({ threads: enrich });
  }
  if (route === 'threads' && method === 'POST' && (user.role === 'pro' || user.role === 'admin')) {
    const b = await request.json();
    // Créer thread entre user + parent (b.parent_id) autour enfant (b.enfant_id)
    const existing = await db.collection('threads').findOne({
      participants: { $all: [user.id, b.parent_id] }, enfant_id: b.enfant_id||null
    });
    if (existing) return json({ thread: one(existing) });
    const t = { id: uuidv4(), creche_id: user.creche_id||activeCId, participants: [user.id, b.parent_id],
      enfant_id: b.enfant_id||null, last_message_at: new Date(), created_at: new Date() };
    await db.collection('threads').insertOne(t);
    return json({ thread: t });
  }
  if (route.startsWith('threads/') && path.length === 3 && path[2] === 'messages' && method === 'GET') {
    const list = await db.collection('thread_messages').find({ thread_id: path[1] }).sort({ created_at: 1 }).limit(500).toArray();
    return json({ messages: clean(list) });
  }
  if (route.startsWith('threads/') && path.length === 3 && path[2] === 'messages' && method === 'POST') {
    const b = await request.json();
    const m = { id: uuidv4(), thread_id: path[1], from_id: user.id, from_nom: `${user.prenom} ${user.nom}`,
      contenu: b.contenu||'', media: b.media||null, media_type: b.media_type||null, created_at: new Date() };
    await db.collection('thread_messages').insertOne(m);
    await db.collection('threads').updateOne({ id: path[1] }, { $set: { last_message_at: new Date() } });
    return json({ message: one(m) });
  }

  // ---- MESSAGES broadcast (legacy) ----
  if (route === 'messages' && method === 'GET') {
    const q = { creche_id: user.role==='admin' ? { $in: activeCId?[activeCId]:(user.creche_ids||[]) } : user.creche_id };
    if (user.role === 'parent') q.$or = [ { from_id: user.id }, { to_id: user.id } ];
    const list = await db.collection('messages').find(q).sort({ created_at: 1 }).limit(200).toArray();
    return json({ messages: clean(list) });
  }
  if (route === 'messages' && method === 'POST') {
    const { contenu, to_role, to_id, priority, alert_type, heure_prevue } = await request.json();
    if (!contenu) return err('Message vide');
    const m = { id: uuidv4(), creche_id: user.creche_id||activeCId,
      from_id: user.id, from_nom: `${user.prenom} ${user.nom}`, from_role: user.role,
      to_role: to_role||(user.role==='parent'?'admin':'parent'), to_id: to_id||null,
      contenu, lu: false,
      priority: priority || 'normal',
      alert_type: alert_type || null,
      heure_prevue: heure_prevue || null,
      created_at: new Date() };
    await db.collection('messages').insertOne(m);
    return json({ message: one(m) });
  }

  // ---- ALERTES RAPIDES PARENT ----
  if (route === 'parent/alertes' && method === 'GET' && (user.role === 'admin' || user.role === 'pro')) {
    const cid = activeCId || user.creche_id;
    const list = await db.collection('messages').find({ creche_id: cid, priority: 'urgent' }).sort({ created_at: -1 }).limit(50).toArray();
    return json({ alertes: clean(list) });
  }

  if (route === 'parent/alertes' && method === 'POST' && user.role === 'parent') {
    const { alert_type, contenu, heure_prevue, enfant_id } = await request.json();
    const labels = {
      retard: 'Retard prévu',
      changement_horaire: 'Changement horaire',
      medical: 'Info médicale / alimentation',
      recuperation: 'Récupération anticipée',
    };
    const m = {
      id: uuidv4(), creche_id: user.creche_id,
      from_id: user.id, from_nom: `${user.prenom} ${user.nom}`, from_role: 'parent',
      to_role: 'admin', enfant_id: enfant_id || null,
      contenu: contenu || labels[alert_type] || 'Alerte',
      priority: 'urgent', alert_type, heure_prevue: heure_prevue || null,
      lu: false, created_at: new Date()
    };
    await db.collection('messages').insertOne(m);
    return json({ alerte: one(m) });
  }

  if (route.startsWith('parent/alertes/') && path.length === 3 && path[2] && method === 'PUT' && (user.role === 'admin' || user.role === 'pro')) {
    await db.collection('messages').updateOne({ id: path[2], priority: 'urgent' }, { $set: { lu: true, lu_at: new Date(), lu_par: user.id } });
    return json({ ok: true });
  }

  // ---- EMPLOYES ----
  if (route === 'employes' && method === 'GET' && (user.role === 'admin' || user.role === 'pro')) {
    const q = user.role==='admin' ? { role: 'pro', creche_id: { $in: activeCId?[activeCId]:(user.creche_ids||[]) } } : { role: 'pro', creche_id: user.creche_id };
    const list = await db.collection('users').find(q).toArray();
    return json({ employes: clean(list) });
  }
  if (route === 'employes' && method === 'POST' && user.role === 'admin') {
    const b = await request.json();
    const exists = await db.collection('users').findOne({ email: b.email });
    if (exists) return err('Email déjà utilisé', 409);
    const hash = await bcrypt.hash(b.password || 'demo1234', 8);
    const u = { id: uuidv4(), email: b.email, password: hash, role: 'pro', creche_id: b.creche_id||activeCId, prenom: b.prenom, nom: b.nom, tel: b.tel||'', created_at: new Date() };
    await db.collection('users').insertOne(u);
    return json({ employe: one(u) });
  }

  // ---- PARENTS listing (for pro/admin to open threads) ----
  if (route === 'parents' && method === 'GET' && (user.role === 'admin' || user.role === 'pro')) {
    const cid = activeCId || user.creche_id;
    const enfants = await db.collection('enfants').find({ creche_id: cid }).toArray();
    const parentIds = [...new Set(enfants.flatMap(e => e.parent_ids || []))];
    const parents = await db.collection('users').find({ id: { $in: parentIds } }).toArray();
    const enriched = parents.map(p => ({
      ...one(p),
      enfants: enfants.filter(e => (e.parent_ids||[]).includes(p.id)).map(e => ({ id: e.id, prenom: e.prenom, avatar_color: e.avatar_color }))
    }));
    return json({ parents: enriched });
  }

  // ---- NOURRITURE ----
  if (route === 'nourriture' && method === 'GET') {
    let q = {};
    if (user.role === 'admin') q.creche_id = { $in: activeCId?[activeCId]:(user.creche_ids||[]) };
    else if (user.role !== 'super_admin') q.creche_id = user.creche_id;
    const list = await db.collection('nourriture').find(q).sort({ semaine: -1 }).limit(4).toArray();
    return json({ menus: clean(list) });
  }
  if (route === 'nourriture' && method === 'POST' && (user.role === 'admin' || user.role === 'pro')) {
    const b = await request.json();
    const n = { id: uuidv4(), creche_id: b.creche_id||activeCId||user.creche_id, semaine: b.semaine||new Date().toISOString().slice(0,10), repas: b.repas||[], created_at: new Date() };
    await db.collection('nourriture').insertOne(n);
    return json({ menu: n });
  }

  // ---- RAPPELS ----
  if (route === 'rappels' && method === 'GET') {
    let q = {};
    if (user.role === 'admin') q.creche_id = { $in: activeCId?[activeCId]:(user.creche_ids||[]) };
    else if (user.role !== 'super_admin') q.creche_id = user.creche_id;
    const list = await db.collection('rappels').find(q).sort({ echeance: 1 }).toArray();
    return json({ rappels: clean(list) });
  }
  if (route === 'rappels' && method === 'POST' && (user.role === 'admin' || user.role === 'pro')) {
    const b = await request.json();
    const r = { id: uuidv4(), creche_id: b.creche_id||activeCId||user.creche_id, titre: b.titre, echeance: b.echeance, cible: b.cible||'admin', enfant_id: b.enfant_id||null, statut: 'actif', priorite: b.priorite||'moyenne', created_at: new Date() };
    await db.collection('rappels').insertOne(r);
    return json({ rappel: r });
  }
  if (route.startsWith('rappels/') && path.length === 2 && method === 'PUT') {
    const b = await request.json();
    await db.collection('rappels').updateOne({ id: path[1] }, { $set: b });
    return json({ ok: true });
  }

  // ---- NEWS ----
  if (route === 'news' && method === 'GET') {
    let q = {};
    if (user.role === 'admin') q.creche_id = { $in: activeCId?[activeCId]:(user.creche_ids||[]) };
    else if (user.role !== 'super_admin') q.creche_id = user.creche_id;
    const list = await db.collection('news').find(q).sort({ pinned: -1, created_at: -1 }).toArray();
    return json({ news: clean(list) });
  }
  if (route === 'news' && method === 'POST' && user.role === 'admin') {
    const b = await request.json();
    const n = { id: uuidv4(), creche_id: b.creche_id||activeCId, titre: b.titre, contenu: b.contenu, image_url: b.image_url||null, cible: b.cible||'parents', pinned: b.pinned||false, created_at: new Date() };
    await db.collection('news').insertOne(n);
    return json({ news: n });
  }

  // ---- DOCUMENTS ----
  if (route === 'documents' && method === 'GET') {
    let q = {};
    if (user.role === 'admin') q.creche_id = { $in: activeCId?[activeCId]:(user.creche_ids||[]) };
    else if (user.role !== 'super_admin') q.creche_id = user.creche_id;
    if (user.role === 'parent') q.cible = { $in: ['tous', 'parents'] };
    if (user.role === 'pro') q.cible = { $in: ['tous', 'pros'] };
    const list = await db.collection('documents').find(q).sort({ created_at: -1 }).toArray();
    return json({ documents: clean(list) });
  }
  if (route === 'documents' && method === 'POST' && (user.role === 'admin' || user.role === 'pro')) {
    const b = await request.json();
    const d = { id: uuidv4(), creche_id: b.creche_id||activeCId||user.creche_id, titre: b.titre, type: b.type||'pdf', url: b.url||null, cible: b.cible||'tous', taille: b.taille||0, created_at: new Date() };
    await db.collection('documents').insertOne(d);
    return json({ document: d });
  }

  // ---- FEEDBACKS ----
  if (route === 'feedbacks' && method === 'GET' && user.role === 'super_admin') {
    const list = await db.collection('feedbacks').find({}).sort({ created_at: -1 }).toArray();
    return json({ feedbacks: clean(list) });
  }
  if (route === 'feedbacks' && method === 'POST') {
    const b = await request.json();
    const f = { id: uuidv4(), from_id: user.id, from_nom: `${user.prenom} ${user.nom}`, from_role: user.role, message: b.message, rating: b.rating||5, category: b.category||'general', resolu: false, created_at: new Date() };
    await db.collection('feedbacks').insertOne(f);
    return json({ feedback: f });
  }

  // ---- ALARME ÉVACUATION ----
  if (route === 'alarme/evacuation' && method === 'GET') {
    const cid = activeCId || user.creche_id;
    const today = todayKey();
    const start = new Date(today+'T00:00:00').toISOString();
    const end = new Date(today+'T23:59:59').toISOString();
    const arrives = await db.collection('transmissions').find({ creche_id: cid, type: 'arrivee', heure: { $gte: start, $lte: end } }).toArray();
    const arrivedIds = [...new Set(arrives.map(a => a.enfant_id))];
    const enfants = await db.collection('enfants').find({ creche_id: cid, id: { $in: arrivedIds } }).toArray();
    const ptg = await db.collection('pointages').find({ creche_id: cid, date: today, type: 'arrivee' }).toArray();
    const employesIds = [...new Set(ptg.map(p => p.employe_id))];
    const employes = await db.collection('users').find({ id: { $in: employesIds } }).toArray();
    const creche = await db.collection('creches').findOne({ id: cid });
    return json({ creche: one(creche), date: today, enfants_presents: clean(enfants), employes_presents: clean(employes) });
  }

  // ---- EMPLOYE CONTRAT + PLANNING HEBDO (avec prorata via pointages) ----
  if (route.startsWith('employes/') && path.length === 2 && method === 'PUT' && user.role === 'admin') {
    const b = await request.json();
    const allowed = ['prenom', 'nom', 'poste', 'contrat_horaires', 'taux_horaire', 'tel', 'creche_id'];
    const upd = {};
    for (const k of allowed) if (b[k] !== undefined) upd[k] = b[k];
    await db.collection('users').updateOne({ id: path[1], role: 'pro' }, { $set: upd });
    const fresh = await db.collection('users').findOne({ id: path[1] });
    return json({ employe: one(fresh) });
  }

  if (route.startsWith('employes/') && path.length === 3 && path[2] === 'planning' && method === 'GET') {
    const empId = path[1];
    // Sécurité : pro ne voit que son propre planning
    if (user.role === 'pro' && empId !== user.id) return err('Accès refusé', 403);
    const emp = await db.collection('users').findOne({ id: empId, role: 'pro' });
    if (!emp) return err('Employé introuvable', 404);

    const url = new URL(request.url);
    const semaineParam = url.searchParams.get('semaine'); // YYYY-MM-DD (any day in week)
    const anchor = semaineParam ? new Date(semaineParam) : new Date();
    // Lundi de la semaine
    const day = anchor.getDay() || 7;
    const monday = new Date(anchor); monday.setDate(anchor.getDate() - (day - 1)); monday.setHours(0,0,0,0);

    const jourNoms = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
    const contrat = emp.contrat_horaires || { heures_hebdo: 35, jours: {} };

    const semaine = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().slice(0,10);
      const jourNom = jourNoms[i];
      const jourContrat = contrat.jours?.[jourNom] || null;
      // Pointages du jour
      const ptgs = await db.collection('pointages').find({ employe_id: empId, date: dateStr }).sort({ heure: 1 }).toArray();
      const arriveePtg = ptgs.find(p => p.type === 'arrivee');
      const departPtg = ptgs.find(p => p.type === 'depart');

      const toMin = (t) => { if (!t) return 0; const [h,m] = t.split(':').map(Number); return h*60 + (m||0); };
      const timeOf = (iso) => { if (!iso) return null; const dt = new Date(iso); return `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`; };

      const prevu_min = jourContrat ? Math.max(0, toMin(jourContrat.depart) - toMin(jourContrat.arrivee) - (jourContrat.pause_min||0)) : 0;

      let effectif_min = 0, statut = 'repos', delta_min = 0;
      const arriveeT = timeOf(arriveePtg?.heure);
      const departT = timeOf(departPtg?.heure);

      if (!jourContrat) statut = 'repos';
      else if (!arriveePtg && dateStr < todayKey()) statut = 'absent';
      else if (!arriveePtg && dateStr === todayKey()) statut = 'a_venir';
      else if (!arriveePtg) statut = 'a_venir';
      else if (arriveePtg && !departPtg) statut = 'en_cours';
      else if (arriveePtg && departPtg) {
        effectif_min = Math.max(0, toMin(departT) - toMin(arriveeT) - (jourContrat.pause_min||0));
        delta_min = effectif_min - prevu_min;
        if (Math.abs(delta_min) <= 5) statut = 'a_l_heure';
        else if (delta_min < -5) statut = 'court';
        else statut = 'depasse';
      }

      semaine.push({
        date: dateStr, jour: jourNom,
        prevu: jourContrat ? { arrivee: jourContrat.arrivee, depart: jourContrat.depart, minutes: prevu_min } : null,
        effectif: (arriveeT || departT) ? { arrivee: arriveeT, depart: departT, minutes: effectif_min } : null,
        delta_min, statut,
      });
    }
    const total_prevu = semaine.reduce((s,x)=>s+(x.prevu?.minutes||0),0);
    const total_effectif = semaine.reduce((s,x)=>s+(x.effectif?.minutes||0),0);
    const prorata = total_prevu > 0 ? Math.round((total_effectif/total_prevu)*100) : 0;
    const salaire_est = emp.taux_horaire ? Math.round((total_effectif/60) * emp.taux_horaire * 100)/100 : null;
    return json({
      employe: one(emp), semaine_du: monday.toISOString().slice(0,10),
      jours: semaine, total_prevu_min: total_prevu, total_effectif_min: total_effectif,
      prorata_pct: prorata, salaire_estime: salaire_est
    });
  }

  // ---- ENFANT AVATAR ----
  if (route.startsWith('enfants/') && path.length === 3 && path[2] === 'avatar' && method === 'PUT') {
    const b = await request.json();
    // b.url (Cloudinary) OR b.data (base64 data URL)
    if (user.role === 'parent') {
      const e = await db.collection('enfants').findOne({ id: path[1] });
      if (!e || !(e.parent_ids||[]).includes(user.id)) return err('Accès refusé', 403);
    }
    let upd = { avatar_url: b.url || b.data || null };
    if (b.color) upd.avatar_color = b.color;
    await db.collection('enfants').updateOne({ id: path[1] }, { $set: upd });
    const fresh = await db.collection('enfants').findOne({ id: path[1] });
    return json({ enfant: one(fresh) });
  }

  // ---- ENFANT FICHE SANTÉ (contacts urgence, allergies, vaccins) ----
  if (route.startsWith('enfants/') && path.length === 3 && path[2] === 'sante' && method === 'PUT') {
    const b = await request.json();
    if (user.role === 'parent') {
      const e = await db.collection('enfants').findOne({ id: path[1] });
      if (!e || !(e.parent_ids||[]).includes(user.id)) return err('Accès refusé', 403);
    }
    const upd = {};
    ['allergies','regime_alimentaire','medecin','contacts_urgence','vaccins','notes_sante','poids_naissance','taille_naissance'].forEach(k => { if (b[k]!==undefined) upd[k] = b[k]; });
    await db.collection('enfants').updateOne({ id: path[1] }, { $set: upd });
    const fresh = await db.collection('enfants').findOne({ id: path[1] });
    return json({ enfant: one(fresh) });
  }

  // ---- NOURRITURE UPDATE ----
  if (route.startsWith('nourriture/') && path.length === 2 && method === 'PUT' && (user.role === 'admin' || user.role === 'pro')) {
    const b = await request.json();
    delete b._id; delete b.id;
    await db.collection('nourriture').updateOne({ id: path[1] }, { $set: b });
    return json({ ok: true });
  }

  // ---- USER PROFILE + PASSWORD ----
  if (route === 'me' && method === 'PUT') {
    const b = await request.json();
    const allowed = ['prenom','nom','tel','poste','avatar_url','pseudo'];
    const upd = {};
    for (const k of allowed) if (b[k] !== undefined) upd[k] = b[k];
    if (b.password && b.password.length >= 6) upd.password = await bcrypt.hash(b.password, 8);
    await db.collection('users').updateOne({ id: user.id }, { $set: upd });
    const fresh = await db.collection('users').findOne({ id: user.id });
    return json({ user: one(fresh) });
  }

  // Super admin ou admin peut modifier des users (leurs pros/parents/clients)
  if (route.startsWith('users/') && path.length === 2 && method === 'PUT') {
    const targetId = path[1];
    const target = await db.collection('users').findOne({ id: targetId });
    if (!target) return err('Introuvable', 404);
    if (user.role === 'admin') {
      // Admin peut modifier uniquement pros/parents de ses crèches
      if (target.role === 'super_admin') return err('Accès refusé', 403);
      if (target.creche_id && !(user.creche_ids||[]).includes(target.creche_id)) return err('Accès refusé', 403);
    } else if (user.role !== 'super_admin') return err('Accès refusé', 403);
    const b = await request.json();
    const allowed = ['prenom','nom','email','tel','poste','role','subscription','avatar_url','creche_id','creche_ids','plan_prix','notes_admin'];
    const upd = {};
    for (const k of allowed) if (b[k] !== undefined) upd[k] = b[k];
    if (b.password && b.password.length >= 6) upd.password = await bcrypt.hash(b.password, 8);
    await db.collection('users').updateOne({ id: targetId }, { $set: upd });
    const fresh = await db.collection('users').findOne({ id: targetId });
    return json({ user: one(fresh) });
  }

  // ---- FICHES DE PAIE ----
  if (route === 'fiches-paie' && method === 'GET') {
    let q = {};
    if (user.role === 'pro') q.employe_id = user.id;
    else if (user.role === 'admin') q.creche_id = { $in: activeCId?[activeCId]:(user.creche_ids||[]) };
    else if (user.role !== 'super_admin') return err('Accès refusé', 403);
    const list = await db.collection('fiches_paie').find(q).sort({ periode: -1 }).toArray();
    return json({ fiches: clean(list) });
  }
  if (route === 'fiches-paie' && method === 'POST' && user.role === 'admin') {
    const b = await request.json();
    const f = { id: uuidv4(), creche_id: b.creche_id||activeCId, employe_id: b.employe_id,
      employe_nom: b.employe_nom||'', periode: b.periode, url: b.url||null,
      montant_brut: b.montant_brut||0, montant_net: b.montant_net||0,
      created_at: new Date() };
    await db.collection('fiches_paie').insertOne(f);
    return json({ fiche: f });
  }

  // ---- PRE-INSCRIPTIONS ENFANTS (côté admin) ----
  if (route === 'preinscriptions' && method === 'GET' && (user.role === 'admin' || user.role === 'pro')) {
    const q = { creche_id: user.role==='admin' ? { $in: activeCId?[activeCId]:(user.creche_ids||[]) } : user.creche_id };
    const list = await db.collection('preinscriptions').find(q).sort({ created_at: -1 }).toArray();
    return json({ preinscriptions: clean(list) });
  }
  if (route === 'preinscriptions' && method === 'POST') {
    const b = await request.json();
    const p = { id: uuidv4(), creche_id: b.creche_id||activeCId||user.creche_id,
      enfant_prenom: b.enfant_prenom, enfant_nom: b.enfant_nom||'', date_naissance: b.date_naissance,
      parent_nom: b.parent_nom, parent_email: b.parent_email, parent_tel: b.parent_tel,
      date_souhaitee: b.date_souhaitee, contrat_heures: b.contrat_heures||35,
      notes: b.notes||'', statut: 'nouveau', created_at: new Date() };
    await db.collection('preinscriptions').insertOne(p);
    return json({ preinscription: p });
  }
  if (route.startsWith('preinscriptions/') && path.length === 2 && method === 'PUT' && user.role === 'admin') {
    const b = await request.json();
    delete b._id; delete b.id;
    await db.collection('preinscriptions').updateOne({ id: path[1] }, { $set: b });
    return json({ ok: true });
  }

  // ---- SUPER ADMIN: prospects crèches ----
  if (route === 'super/prospects' && method === 'GET' && user.role === 'super_admin') {
    const list = await db.collection('prospects').find({}).sort({ created_at: -1 }).toArray();
    return json({ prospects: clean(list) });
  }
  if (route === 'super/prospects' && method === 'POST' && user.role === 'super_admin') {
    const b = await request.json();
    const p = { id: uuidv4(), nom: b.nom, contact: b.contact||'', email: b.email||'', tel: b.tel||'', ville: b.ville||'', notes: b.notes||'', statut: b.statut||'prospect', created_at: new Date() };
    await db.collection('prospects').insertOne(p);
    return json({ prospect: p });
  }

  // ---- NOTIFICATIONS BROADCAST ----
  if (route === 'notifications' && method === 'GET') {
    let q = {};
    if (user.role === 'admin') q.creche_id = { $in: activeCId?[activeCId]:(user.creche_ids||[]) };
    else if (user.role !== 'super_admin') {
      q.creche_id = user.creche_id;
      q.cible = { $in: [user.role, 'tous'] };
    }
    const list = await db.collection('notifications').find(q).sort({ created_at: -1 }).limit(50).toArray();
    return json({ notifications: clean(list) });
  }
  if (route === 'notifications' && method === 'POST' && user.role === 'admin') {
    const b = await request.json();
    const n = { id: uuidv4(), creche_id: b.creche_id||activeCId, titre: b.titre, contenu: b.contenu, cible: b.cible||'tous', from_id: user.id, from_nom: `${user.prenom} ${user.nom}`, created_at: new Date() };
    await db.collection('notifications').insertOne(n);
    return json({ notification: n });
  }

  // ---- STATISTIQUES ----
  if (route === 'statistiques' && method === 'GET' && user.role === 'admin') {
    const cids = activeCId ? [activeCId] : (user.creche_ids||[]);
    const enfants = await db.collection('enfants').find({ creche_id: { $in: cids } }).toArray();
    const employes = await db.collection('users').find({ role: 'pro', creche_id: { $in: cids } }).toArray();
    const factures = await db.collection('factures').find({ creche_id: { $in: cids } }).toArray();
    const trans = await db.collection('transmissions').find({ creche_id: { $in: cids } }).toArray();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const facturesMois = factures.filter(f => new Date(f.date).toISOString() >= monthStart);
    return json({ stats: {
      enfants: enfants.length,
      enfants_par_groupe: enfants.reduce((a,e)=>{a[e.groupe]=(a[e.groupe]||0)+1;return a;},{}),
      employes: employes.length,
      ca_mois: facturesMois.filter(f=>f.statut==='payee').reduce((s,f)=>s+f.montant,0),
      ca_attendu_mois: facturesMois.reduce((s,f)=>s+f.montant,0),
      factures_impayees: factures.filter(f=>f.statut==='en_attente').length,
      transmissions_total: trans.length,
      transmissions_par_type: trans.reduce((a,t)=>{a[t.type]=(a[t.type]||0)+1;return a;},{}),
    }});
  }

  // ---- STATS SUPER ADMIN par client ----
  if (route.startsWith('super/clients/') && path.length === 3 && path[2] === 'invoice' && method === 'POST' && user.role === 'super_admin') {
    // Facture manuelle pour un client (arrangement/ajustement)
    const b = await request.json();
    const clientId = path[1];
    const f = { id: uuidv4(), super_admin_invoice: true, client_id: clientId,
      description: b.description||'Abonnement TiMétis',
      montant: b.montant, mois: b.mois||new Date().toLocaleDateString('fr-FR',{month:'long',year:'numeric'}),
      statut: 'en_attente', date: new Date(), created_at: new Date() };
    await db.collection('factures_saas').insertOne(f);
    return json({ facture: f });
  }
  if (route === 'super/factures' && method === 'GET' && user.role === 'super_admin') {
    const list = await db.collection('factures_saas').find({}).sort({ created_at: -1 }).toArray();
    return json({ factures: clean(list) });
  }

  // ---- MEDIA UPLOAD (Cloudinary signed) ----
  if (route === 'media/sign' && method === 'POST') {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return json({ configured: false, error: 'Cloudinary non configuré. Ajoutez les clés dans /app/.env' }, 200);
    }
    const timestamp = Math.round(Date.now()/1000);
    const b = await request.json();
    const folder = `timetis/${user.creche_id||activeCId||'default'}/${b.folder||'chat'}`;
    const paramsToSign = { timestamp, folder };
    const str = Object.keys(paramsToSign).sort().map(k => `${k}=${paramsToSign[k]}`).join('&') + apiSecret;
    const signature = crypto.createHash('sha1').update(str).digest('hex');
    return json({ configured: true, cloud_name: cloudName, api_key: apiKey, timestamp, signature, folder });
  }

  // ---- STRIPE ----
  if (route === 'stripe/status' && method === 'GET') {
    const configured = !!process.env.STRIPE_SECRET_KEY;
    const full = await db.collection('users').findOne({ id: user.id });
    return json({ configured, subscription: full?.subscription || null });
  }

  if (route === 'stripe/checkout' && method === 'POST' && user.role === 'admin') {
    if (!process.env.STRIPE_SECRET_KEY) {
      // Mode démo : simule la souscription
      await db.collection('users').updateOne({ id: user.id }, { $set: { subscription: { status: 'active', plan: 'timetis-79-demo', activated_at: new Date() } } });
      return json({ demo_mode: true, message: 'Abonnement activé en mode démo (Stripe non configuré)' });
    }
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const b = await request.json();
    // Ensure customer
    let customerId = (await db.collection('users').findOne({ id: user.id }))?.subscription?.customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, name: `${user.prenom} ${user.nom}`, metadata: { userId: user.id } });
      customerId = customer.id;
      await db.collection('users').updateOne({ id: user.id }, { $set: { 'subscription.customer_id': customerId } });
    }
    // Ensure price
    let priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      const product = await stripe.products.create({ name: 'TiMétis · 79€/mois' });
      const price = await stripe.prices.create({ product: product.id, currency: 'eur', unit_amount: 7900, recurring: { interval: 'month' } });
      priceId = price.id;
      process.env.STRIPE_PRICE_ID = priceId; // in-memory only
    }
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      payment_method_types: ['card', 'sepa_debit'],
      success_url: `${baseUrl}?stripe=success&sid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}?stripe=cancel`,
      metadata: { userId: user.id }, subscription_data: { metadata: { userId: user.id } },
    });
    return json({ url: session.url });
  }

  if (route === 'stripe/portal' && method === 'POST' && user.role === 'admin') {
    if (!process.env.STRIPE_SECRET_KEY) return err('Stripe non configuré');
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const full = await db.collection('users').findOne({ id: user.id });
    const cid = full?.subscription?.customer_id;
    if (!cid) return err('Pas de client Stripe');
    const portal = await stripe.billingPortal.sessions.create({ customer: cid, return_url: process.env.NEXT_PUBLIC_BASE_URL });
    return json({ url: portal.url });
  }

  return err('Route introuvable: ' + route, 404);
}

export async function GET(request, { params }) { try { return await handle(request, params); } catch (e) { console.error('API error:', e); return err(e.message, 500); } }
export async function POST(request, { params }) { try { return await handle(request, params); } catch (e) { console.error('API error:', e); return err(e.message, 500); } }
export async function PUT(request, { params }) { try { return await handle(request, params); } catch (e) { console.error('API error:', e); return err(e.message, 500); } }
export async function DELETE(request, { params }) { try { return await handle(request, params); } catch (e) { console.error('API error:', e); return err(e.message, 500); } }
