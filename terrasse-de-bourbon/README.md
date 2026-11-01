# La Terrasse de Bourbon — Réservations & carte

Une seule page (`index.html`) pour deux publics :

| Adresse | Pour qui | Contenu |
|---|---|---|
| `…/index.html` | Clients | Accueil, carte digitale, réservation, « Mes résas », suivi du statut |
| `…/index.html#equipe` | Équipe | Hub : demandes à confirmer, plan de salle, service, ajout manuel |

## Parcours d'une réservation

1. Le client choisit jour, heure, nombre de personnes et préférence d'espace, puis envoie sa demande.
2. La demande arrive **automatiquement** dans le hub (onglet Demandes), avec alerte sonore, badge et notification si activée.
3. Un membre de l'équipe **confirme ou refuse à la main**. Une table est proposée, mais c'est l'équipe qui décide (ou place plus tard).
4. La page de suivi du client passe d'elle-même à « Confirmée » ou « Non disponible ». Un message WhatsApp pré-rédigé reste disponible si l'équipe veut prévenir le client directement.

Statuts : `pending` (en attente) → `confirmed` / `declined`, et `cancelled` si le client ou l'équipe annule.

## Mise en production (Supabase, gratuit à cette échelle)

1. Créer un compte et un projet sur supabase.com (région Europe).
2. **SQL Editor** : coller le contenu de `supabase.sql`, puis Run.
3. **Authentication > Providers > Email** : désactiver « Allow new users to sign up ».
4. **Authentication > Users > Add user** pour chaque membre de l'équipe, puis dans le SQL Editor :
   `insert into public.staff (user_id) select id from auth.users where email = 'prenom@exemple.re';`
5. **Project Settings > API** : copier l'URL du projet et la clé `anon public` dans `SUPABASE_URL` et `SUPABASE_ANON_KEY`, en haut du script de `index.html`.
6. Héberger sur Vercel (voir ci-dessous). Il n'y a ni build ni serveur à gérer.

## Déploiement sur Vercel

1. vercel.com > **Add New… > Project** > importer le dépôt GitHub `Jay974/app`.
2. **Root Directory** : `terrasse-de-bourbon`. **Framework Preset** : `Other`. Laisser Build Command et Output Directory vides.
3. **Deploy**. Chaque push sur la branche de production redéploie automatiquement.
4. Facultatif : **Settings > Domains** pour brancher votre nom de domaine.

`vercel.json` ajoute quelques en-têtes de sécurité ; `.vercelignore` évite de publier ce README et `supabase.sql`.

Sans ces deux valeurs, la page tourne en **mode démo** : tout reste dans le navigateur de l'appareil, ce qui permet de tester le parcours en ouvrant la page client et `#equipe` dans deux onglets.

## Sécurité

- Le public ne lit ni n'écrit jamais directement dans les tables. Il passe par trois fonctions : envoyer une demande, suivre sa demande avec un jeton secret, l'annuler.
- Seuls les comptes de la table `staff` voient les réservations (téléphones compris).
- Garde-fous : 3 demandes en attente maximum par numéro et par heure, 40 demandes par tranche de 10 minutes, date entre aujourd'hui et 6 mois.

## Configuration dans `index.html`

- `SVC` : services, horaires et créneaux proposés aux clients
- `ZONES` : plan de salle (tables, capacités, `maxCap`, salons)
- `MENU_CATS` : la carte complète (16 rubriques, transcrite de la carte papier). Chaque ligne : nom, prix, description, allergènes, et `1` en dernier pour la mettre en avant sur l'accueil.
- `HAPPY_HOURS`, `svcClosed` : happy hour (12h–14h30 et 17h–19h) et fermeture du dimanche soir.

## Limites

- Le scanner du cahier et le remplissage par dictée utilisent l'IA de claude.ai : ils n'apparaissent que dans l'aperçu claude.ai, pas sur la version hébergée.
- Dans l'aperçu claude.ai, la page reste en mode démo (claude.ai bloque les connexions vers Supabase).
