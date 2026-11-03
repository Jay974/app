# Fidélité — Programme de points restaurant

Projet indépendant (même logique que `ecommerce/` dans ce repo : app Next.js
autonome, son propre port). Pensé pour un restaurant à gros débit (~130
couverts simultanés) qui a 7 ans d'habitudes de caisse : le geste du staff
reste identique à aujourd'hui (montant → validation), la seule nouveauté est
la saisie du numéro de téléphone du client pour cumuler ses points.

## Pourquoi ce découpage

Trois surfaces séparées, chacune avec un rôle précis :

- **`/caisse`** — tablette staff. Flux en 3 écrans : montant réglé (clavier
  géant) → CTA "Encaisser" → numéro de téléphone du client → écran de
  confirmation (solde, statut, récompense éligible) → validation staff. Le
  caissier atteste le montant *avec le client* avant de l'enregistrer, comme
  demandé — rien n'est débité sans cette validation explicite.
- **`/` (racine)** — PWA installable côté client : carte de fidélité
  numérique (solde, statut Bronze/Argent/Or, progression), historique,
  récompenses débloquées, et activation des notifications push.
- **`/admin`** — réglages du restaurant : barème de points, seuils de
  statuts, catalogue de récompenses, cartes cadeaux, offres et équipe caisse
  (codes PIN).

## Modèle de fidélité

- **Points** : barème 100% configurable dans `/admin` (ex. 1 point / 1€
  dépensé). Calculé côté serveur à la validation de l'encaissement.
- **Statuts (Bronze / Argent / Or)** : basés sur les points *cumulés à vie*
  (`lifetime_points`), donc dépenser des points en récompense ne fait jamais
  redescendre de statut. Chaque statut peut porter un multiplicateur de
  points (ex. Or = ×1.25) comme avantage passif.
- **Récompenses** : produits offerts à seuils fixes en points, gérés dans
  `/admin`, appliqués par le staff directement dans l'écran de confirmation
  caisse au moment du paiement.

## Identification client & compte PWA

Comme demandé, l'identifiant est le **numéro de téléphone** (habitude déjà
connue du client type boulangerie/restaurant). Aucun fournisseur SMS n'étant
branché ici, l'activation du compte PWA se fait ainsi :

1. En caisse, le staff crée l'accès (`Numéro de téléphone` → code à 6
   chiffres généré, affiché sur la tablette).
2. Le client saisit ce code une seule fois dans la PWA (`Activer mon
   compte`) et choisit son propre code PIN à 4 chiffres.
3. Ensuite il se reconnecte avec téléphone + PIN, depuis n'importe quel
   appareil.

Si un fournisseur SMS (Twilio, Vonage…) est disponible plus tard, il suffit
de brancher l'envoi du code dans `POST /api/clients/access/init` au lieu de
l'afficher côté caisse.

## Cartes cadeaux

Sur le même modèle que la fidélité (numéro de téléphone comme identifiant,
tablette caisse comme point de validation), avec un QR code pour l'activer
et l'utiliser :

- **Créée par un client** (`/carte-cadeau` dans la PWA, après connexion) —
  il choisit le montant (préréglages + montant libre configurables dans
  `/admin`), personnalise entièrement la carte (destinataire, message,
  "de la part de"), et obtient un visuel avec QR code, partageable
  (`navigator.share` ou lien copié). La carte est créée au statut *en
  attente de règlement* : le montant n'a pas encore été payé.
- **Créée directement en caisse** (`/caisse` → onglet "Carte cadeau" →
  "Créer & activer") — pour une vente au comptoir : le staff encaisse le
  montant et personnalise si besoin, la carte est active immédiatement.
- **Activation** — si un client a créé une carte depuis la PWA, il la
  présente (QR ou code) en caisse ; le staff scanne ou saisit le code,
  confirme le règlement, la carte passe active.
- **Utilisation** — le staff scanne ou saisit le code, la carte affiche son
  solde, il déduit le montant de l'addition (usage partiel possible sur
  plusieurs visites tant qu'il reste du solde).
- Le QR encode un lien public `/carte-cadeau/{code}` (page de consultation,
  pas d'authentification requise — le code fait office de secret, comme une
  carte cadeau physique) ; l'image est générée à la volée par
  `GET /api/gift-cards/:code/qr`. Le scan en caisse utilise `jsQR` en local
  (aucune image envoyée à un service tiers).

## Notifications push (offres du jour)

- Web Push standard (VAPID), service worker dans `public/sw.js`.
- **Offres programmées** : créées dans `/admin`, envoyées manuellement
  (bouton d'envoi) faute de planificateur automatique branché ici — un cron
  externe peut appeler `POST /api/offers/:id/send-now` à l'heure prévue.
- **Offres de proximité** : la PWA, une fois ouverte et la géolocalisation
  autorisée, vérifie périodiquement la distance au restaurant
  (`POST /api/clients/proximity-checkin`) et déclenche une notification si le
  client entre dans le rayon configuré (une seule fois par jour).
  ⚠️ Limite connue : une PWA ne peut pas être réveillée en tâche de fond de
  façon fiable sur iOS pour du geofencing pur. Cette approche fonctionne tant
  que l'app est ouverte/active ; pour du vrai geofencing en arrière-plan il
  faudrait empaqueter l'app en natif (ex. Capacitor) plus tard — ce n'est pas
  un blocage pour un MVP, les offres programmées restent le canal fiable.

## Démarrage

```bash
cd restaurant-loyalty
cp .env.example .env.local   # renseigner MONGO_URL, JWT_SECRET, VAPID_*
yarn install                 # ou npm install
npx web-push generate-vapid-keys   # pour VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
yarn dev                     # http://localhost:3200
```

Premier lancement : ouvrir `/admin`, cliquer sur "Premier lancement ? Créer
le compte admin" pour créer le premier accès staff (rôle admin), puis créer
les codes PIN des autres caissiers depuis cet écran.

## Modèle de données (MongoDB, base `restaurant_loyalty`)

- `staff` — équipe caisse (PIN hashé, rôle `admin`/`caissier`)
- `clients` — `phone` comme identifiant, `points_balance`, `lifetime_points`,
  `pin_hash` (accès PWA)
- `transactions` — historique des encaissements (montant, points, staff,
  récompense éventuellement échangée)
- `rewards` — catalogue des récompenses à seuils de points
- `gift_cards` — `code` unique, `amount_cents`/`balance_cents`,
  personnalisation (destinataire, message, expéditeur), `status`
  (`awaiting_activation`/`active`/`used`/`cancelled`), historique des
  utilisations
- `offers` — offres programmées ou de proximité
- `push_subscriptions` — abonnements Web Push par client
- `settings` — document unique (barème, statuts, cartes cadeaux, position du
  restaurant)
