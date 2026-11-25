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
