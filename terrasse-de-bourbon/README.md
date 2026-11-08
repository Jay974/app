# La Terrasse de Bourbon — Réservations & carte

Une seule page (`index.html`) pour deux publics :

| Adresse | Pour qui | Contenu |
|---|---|---|
| `…/index.html` | Clients | Accueil, carte digitale, réservation, « Mes résas », suivi du statut |
| `…/equipe` | Équipe | Hub : demandes à confirmer, agenda, plan de salle, service, fichier clients, ajout manuel |

## Parcours d'une réservation

1. Le client choisit jour, heure, nombre de personnes et préférence d'espace, puis envoie sa demande.
2. La demande arrive **automatiquement** dans le hub (onglet Demandes), avec alerte sonore, badge et notification si activée.
3. Un membre de l'équipe **confirme ou refuse à la main**. Une table est proposée, mais c'est l'équipe qui décide (ou place plus tard).
4. La page de suivi du client passe d'elle-même à « Confirmée » ou « Non disponible ». L'équipe ne contacte pas les clients par message ; un résumé de la réservation reste à copier pour le groupe WhatsApp de l'équipe.

Statuts : `pending` (en attente) → `confirmed` / `declined`, et `cancelled` si le client ou l'équipe annule.

- **Annulation par le client** : possible en ligne jusqu'à l'heure de la réservation (ensuite, il appelle). L'équipe est prévenue aussitôt (notification push, son, et section « Annulées par les clients » dans Demandes). Une annulation moins de 2 h avant est marquée **tardive**.
- **Modification par le client** : depuis sa page de suivi, jusqu'à l'heure de la réservation et 3 fois au plus. Changer le jour, l'heure ou le nombre de personnes remet la réservation **en attente** (table retirée) ; l'équipe est prévenue (notification « Réservation modifiée · à reconfirmer ») et voit l'ancien créneau sur la demande. Modifier seulement les notes la garde confirmée.
- **Tables libérées automatiquement** : après l'heure d'une réservation, sa table redevient libre sur le plan au bout d'un délai réglable (Réglages > Plan de salle : 1 h par défaut, jusqu'à 3 h, ou jamais). La table reste repérable en pointillés « Libérée · nom heure » ; si les clients sont encore là, la toucher puis « Marquer occupée ». Les tables marquées « Occupée » à la main restent à libérer à la main.

## Agenda des réservations (hub)

- Dans le hub, **happy hour et dîner forment un seul écran « Soir »** (17h–23h) : plan, liste, statistiques et agenda les regroupent. Côté client, les deux créneaux restent proposés séparément.

- Onglet **Agenda** : calendrier du mois, semaine du lundi au dimanche. Chaque jour montre le nombre de couverts, trois cases M · H · S (midi, happy hour, soir : foncée si le service a des réservations, barrée s'il est fermé) et, en rouge, les demandes à confirmer.
- Toucher un jour affiche le détail par service (réservations, couverts, tables prises) et la liste du jour. **Plan** ou **Liste** ouvre directement ce service avec les tables réservées déjà marquées ; **Ajouter** prépare une saisie à cette date.
- Tout est synchronisé en direct : demandes du site, confirmations, modifications et annulations des clients, saisies de l'équipe et du scanner apparaissent sans recharger.
- **Toucher une table** sur le plan : réservée → sa fiche ; marquée occupée → libérée ; libre → au choix **créer une réservation** sur cette table (formulaire prérempli : date, service, table, places), **placer une réservation existante** du service (sans table, ou déplacée depuis une autre table) ou **marquer occupée** (clients sans réservation).
- **Tables jumelées** : une réservation peut occuper plusieurs tables (ex. 108 + 108bis + 108ter pour 8). Quand un groupe dépasse la table choisie, les tables libres de son jumelage sont ajoutées d'office ; toutes apparaissent prises sur le plan et se libèrent ensemble. Dans la fiche, des boutons permettent d'ajouter ou de retirer une table voisine à la main. Jumelages réglables dans Réglages > Plan de salle : on choisit les tables dans une liste, et on touche une table pour la retirer.
- **Ajouter** : l'heure se choisit dans une liste par quart d'heure, groupée par service (d'après les horaires des réglages). Choisir une table remplit la zone et rappelle ses infos (numéro, zone, places).
- Plan et Service : flèches pour passer au jour précédent ou suivant ; un bandeau **À placer** liste les réservations du service sans table (toucher pour en attribuer une).
- Les mois passés se chargent à la demande quand on remonte dans l'agenda.

## Installer l'app (PWA)

- **Équipe** : ouvrir `…/equipe`, puis
  - iPad / iPhone (Safari) : **Partager → Sur l'écran d'accueil** ;
  - Android / Chrome / Edge : bouton **Installer** affiché dans le hub (ou menu ⋮ → Installer l'application).

  L'icône orange « Hub Terrasse » ouvre directement les demandes, en plein écran. La session reste connectée ; à chaque retour sur l'app, les demandes arrivées entre-temps sont rechargées et signalées. Le nombre de demandes en attente s'affiche en pastille sur l'icône quand l'appareil le permet.
- **Clients** : même manipulation depuis `…/` (icône verte « Terrasse »).
- Thème : fond blanc par défaut, bouton lune pour le mode nuit (fond noir), mémorisé sur chaque appareil.
- Notifications push, même app fermée : dans le hub installé, toucher la **cloche** puis autoriser. Sur iPad / iPhone, il faut iOS 16.4 ou plus récent et ouvrir le hub depuis l'icône de l'écran d'accueil (pas depuis Safari). Se déconnecter du hub désabonne l'appareil.

## Notifications push (mise en place, une seule fois)

1. Supabase > SQL Editor : lancer `supabase-push.sql`. Le résultat affiche **NOTIFY_SECRET**.
2. Vercel > projet > Settings > Environment Variables (Production), cocher *Sensitive* :
   - `VAPID_PRIVATE_KEY` : la clé privée VAPID (la clé publique correspondante est dans `index.html` et `api/notify.js`) ;
   - `NOTIFY_SECRET` : la valeur affichée à l'étape 1.
3. Redéployer (Deployments > ⋯ > Redeploy) pour que la fonction lise les variables.

Fonctionnement : une nouvelle demande du site déclenche `private.notify_new_request()` dans Supabase, qui appelle `/api/notify` (fonction Vercel) avec le secret ; la fonction envoie la notification à chaque appareil abonné et retire ceux qui ont été désinstallés.

## Prévenir les clients (e-mail et notification)

- **Désactivé par défaut** : l'interrupteur « Confirmation par e-mail aux clients » (Réglages → Informations du restaurant) affiche le champ e-mail du formulaire. À activer une fois Brevo configuré.
- Le client peut alors laisser son **e-mail** (facultatif) : il reçoit « Demande bien reçue » avec son lien de suivi, puis « Réservation confirmée » ou « Créneau non disponible » dès que l'équipe tranche.
- Sur sa page de suivi, **« Être prévenu sur cet appareil »** active une notification (Android, ordinateur, iPhone si le site est installé). Un appareil qui l'a déjà autorisée est abonné automatiquement à ses nouvelles demandes.
- Fonctionnement : `private.notify_client()` (dans `supabase-push.sql`) appelle `/api/notify-client`, qui envoie l'e-mail par Brevo et la notification. Rien n'est envoyé pour les réservations saisies par l'équipe.
- Mise en place : compte Brevo gratuit (300 e-mails par jour), expéditeur validé dans *Senders, Domains & Dedicated IPs*, clé API dans *SMTP & API*. Puis dans Vercel : `BREVO_API_KEY` et `MAIL_FROM` (l'adresse validée). Sans ces variables, les notifications fonctionnent quand même.
- Les offres restent envoyées à la main pour l'instant, aux clients qui les ont acceptées (onglet Clients, export CSV avec l'e-mail).

## Mise en production (Supabase, gratuit à cette échelle)

1. Créer un compte et un projet sur supabase.com (région Europe).
2. **SQL Editor** : coller le contenu de `supabase.sql`, puis Run.
3. **Authentication > Providers > Email** : désactiver « Allow new users to sign up ».
4. **Authentication > Users > Add user** pour chaque membre de l'équipe, puis dans le SQL Editor :
   `insert into public.staff (user_id) select id from auth.users where email = 'prenom@exemple.re';`
5. **Project Settings > API** : copier l'URL du projet et la clé `anon public` dans `SUPABASE_URL` et `SUPABASE_ANON_KEY`, en haut du script de `index.html`.
6. Héberger sur Vercel (voir ci-dessous). Il n'y a ni build ni serveur à gérer.

## Scripts SQL appliqués automatiquement

À chaque fusion sur `main` qui modifie `supabase.sql` ou `supabase-push.sql`, GitHub les relance sur Supabase (`.github/workflows/supabase-sql.yml`). Les scripts sont relançables sans perte de données ; chacun passe en entier ou pas du tout.

Mise en place, une seule fois :
1. Supabase > bouton **Connect** (en haut du projet) > **Session pooler** : copier la chaîne `postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-…pooler.supabase.com:5432/postgres` et y mettre le mot de passe de la base (Project Settings > Database > *Reset database password* si vous ne l'avez plus).
2. GitHub > dépôt `Jay974/app` > **Settings > Secrets and variables > Actions > New repository secret** : nom `SUPABASE_DB_URL`, valeur = la chaîne complète.
3. Pour lancer à la main : onglet **Actions > Supabase SQL > Run workflow**.

Ne jamais coller cette chaîne ailleurs que dans ce secret : elle donne un accès complet à la base.

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
- **Limite par appareil** (en attendant les comptes clients) : chaque appareil reçoit un identifiant anonyme. Au maximum 2 demandes en attente à venir et 4 demandes par 24 h par appareil ; 6 par heure et 12 par 24 h par connexion internet (pour la navigation privée). Au-delà, le client est invité à appeler. L'adresse IP n'est jamais conservée, seulement une empreinte salée.
- Dans le hub, un repère « Même appareil · N demandes » signale un appareil insistant. Dans la fiche, **Bloquer cet appareil** refuse ses demandes en attente et l'empêche d'en envoyer d'autres (sa connexion est aussi bloquée 24 h) ; **Débloquer** annule. La saisie par l'équipe n'est jamais limitée.

## Configuration dans `index.html`

- `SVC` : services, horaires et créneaux proposés aux clients
- `ZONES` : plan de salle (tables, capacités, `maxCap`, salons)
- `MENU_CATS` : la carte complète (16 rubriques, transcrite de la carte papier). Chaque ligne : nom, prix, description, allergènes, et `1` en dernier pour la mettre en avant sur l'accueil.
- `HAPPY_HOURS`, `svcClosed` : happy hour (12h–14h30 et 17h–19h) et fermeture du dimanche soir.

## Limites

- Le scanner du cahier et le remplissage par dictée utilisent l'IA de claude.ai : ils n'apparaissent que dans l'aperçu claude.ai, pas sur la version hébergée.
- Dans l'aperçu claude.ai, la page reste en mode démo (claude.ai bloque les connexions vers Supabase).

## Fichier clients et consentement

- Chaque réservation avec un téléphone crée ou met à jour une fiche dans `customers`, identifiée par le numéro au format international (`norm_phone`). Les réservations existantes sont reprises au premier lancement de `supabase.sql`.
- Compteurs : `requests` (demandes enregistrées) et `visits` (réservations confirmées, mis à jour à chaque changement de statut).
- Le client coche lui-même « J'accepte de recevoir les offres » (décochée par défaut) : `marketing_opt_in` et la date `opt_in_at` sont conservés comme preuve. L'équipe peut désinscrire un client à sa demande (`opt_out_at`).
- Onglet **Clients** du hub : recherche, filtre, export CSV limité aux clients qui ont accepté les offres.

## Vers l'app du restaurant (feuille de route)

Les fondations sont posées : fiches clients reliées aux réservations, consentement, notifications push, PWA, champ `customers.auth_user_id` réservé aux futurs comptes.

1. **Comptes clients** : connexion par code SMS ou lien e-mail (Supabase Auth), rattachée à la fiche par le numéro de téléphone ; « Mes résas » lit alors l'historique du compte au lieu de l'appareil.
2. **Carte de fidélité digitale** : table `loyalty_events` (un tampon par réservation honorée, validé par l'équipe dans le hub ou par QR code en salle), paliers et récompenses configurables, carte affichée dans l'app client.
3. **Offres temporaires** : table `offers` (titre, période, cible), envoi en notification push aux clients abonnés **et** ayant accepté les offres, en réutilisant `api/notify`.
4. **Site vitrine** : pages infos, horaires, accès, photos, avis, événements, au-dessus de la réservation et de la carte.
5. **Découpage du code** : passer du fichier unique à un projet structuré (Vite ou Next.js) quand ces modules arriveront, sans changer la base Supabase.


## À faire (prochaines étapes)

1. **Espace client, suite** : connexion par lien e-mail une fois le domaine acheté (historique sur tous les appareils).
2. **Domaine + e-mails** : achat du domaine, branchement Vercel, authentification du domaine dans Brevo, `MAIL_FROM`, puis activation de l'interrupteur e-mail.
3. **Hub de gestion complet** (remplacer L'Addition à terme) : prise de commande par table, envoi en cuisine et au bar, addition et encaissement, clôture de caisse, statistiques. À cadrer : conformité caisse (loi anti-fraude TVA, certification NF525 ou équivalent) avant tout encaissement.
4. **Version générique** pour d'autres restaurants (multi-établissements, abonnements, module RH).
