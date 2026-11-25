# Ma Vie — dashboard personnel (PWA) · Vercel + Supabase

Suivi : poids (courbe animée), sport, repas, eau/sommeil/humeur, jours de travail, crédit. Installable PC + téléphone, synchro temps réel, utilisable hors-ligne.

## Mise en route (≈ 5 min)
1. **Supabase** : crée un nouveau projet → *SQL Editor* → colle `supabase/schema.sql` → Run.
2. *Authentication → Providers → Email* : désactive « Confirm email » (pratique en solo).
3. *Settings → API* : copie **Project URL** et clé **anon** dans `public/config.js`.
4. **Vercel** : importe le dépôt, *Root Directory* = `life-dashboard` (rien d'autre à régler), Deploy.
5. Ouvre l'URL, clique **Créer le compte**. Ensuite, désactive les inscriptions (*Authentication → Sign In / Providers → Allow new users to sign up = off*).
6. Téléphone : ouvre l'URL → « Ajouter à l'écran d'accueil ». PC : icône « Installer » de Chrome/Edge.

## Fonctionnement
- Données = champs `{valeur, horodatage}` dans la table `fields` (RLS : chacun ne voit que les siens). Fusion champ par champ, le plus récent gagne.
- Écriture locale d'abord (hors-ligne OK), envoi via `push_fields`, Realtime prévient les autres appareils.
- `⌘K` / `Ctrl+K` : palette de commandes. Réglages : export/import JSON.

## Notifications push (rappels)
Rappels : eau, exercice, repas, pesée (à jeun ou non), mensualité de crédit, loyer, autres charges, coucher, bilan du soir, dépenses du jour, bilan hebdo — paramétrables dans l'onglet **Rappels**.
1. **Vercel → Settings → Environment Variables** : ajoute `SUPABASE_SERVICE_ROLE_KEY` (la *secret key* de Supabase) et `CRON_SECRET` (un texte aléatoire long de ton choix), puis redéploie.
2. **Supabase → SQL Editor** : colle `supabase/push.sql` en remplaçant `VOTRE_CRON_SECRET` par la valeur de `CRON_SECRET`, puis Run. (Le serveur est appelé chaque minute par `pg_cron`.)
3. Dans l'app : **Rappels → Activer les notifications** sur chaque appareil, puis *Envoyer un test*. Sur iPhone, installe d'abord l'app sur l'écran d'accueil (iOS 16.4+).

## IA : Claude + secours Gemini (gratuit)
Les fonctions `api/kcal.js` (calories/macros) et `api/coach.js` (bilans, conseils) passent par `api/_ai.js` : Claude d'abord, puis **Gemini** si Claude échoue (crédit épuisé, panne) ou n'est pas configuré.
Variables Vercel : `ANTHROPIC_API_KEY` (optionnelle), `GEMINI_API_KEY` (gratuite sur https://aistudio.google.com/apikey), `AI_PROVIDER` = `auto` (défaut) | `claude` | `gemini`, `GEMINI_MODEL` (optionnelle).
