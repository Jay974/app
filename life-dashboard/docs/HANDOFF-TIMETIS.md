# Brief de refonte — Timetis, à partir du dashboard « Ma Vie »

> Document à transmettre à la session de développement **Timetis**.
> Source de référence : dépôt `Jay974/app`, dossier `life-dashboard/` (branche `main`).
> Prod de démonstration : https://app-life-dashboard.vercel.app (compte requis).
> ⚠️ Je n'ai pas vu le code de Timetis (app Next.js, dépôt privé). Ce brief décrit ce qu'il faut **reprendre** ; la session Timetis doit d'abord **inspecter l'existant** et adapter (voir §9).

## 1. Objectif
Refondre Timetis (visuel + structure) avec le langage de design, l'ergonomie et l'architecture éprouvés dans « Ma Vie » : interface verre dépoli moderne, responsive du téléphone au pliable au PC, rapide, installable (PWA), fonctionnant hors-ligne.

## 2. Identité visuelle (design tokens)
Fichier de référence : `life-dashboard/public/style.css` (variables en haut). Thème **sombre par défaut**, clair en option (réglage synchronisé).

| Token | Sombre | Clair |
|---|---|---|
| `--bg` | `#0a1514` | `#eef6f4` |
| `--text` | `#eaf5f3` | `#102422` |
| `--muted` / `--faint` | `#9db8b4` / `#62807b` | `#547470` / `#8fa9a5` |
| `--card` (verre) | `rgba(255,255,255,.065)` | `rgba(255,255,255,.6)` |
| `--card-b` (bordure) | `rgba(255,255,255,.12)` | `rgba(255,255,255,.9)` |
| `--field` | `rgba(255,255,255,.08)` | `rgba(60,20,10,.06)` |
| `--ok` / `--warn` / `--bad` | `#4ade80` / `#fbbf24` / `#f87171` | idem |

- **Accent** (`--acc`, `--acc-rgb`) changeable par l'utilisateur : Jade `0,168,150` (défaut), Corail, Violet, Océan, Menthe, Ambre, Rose. Tout le design dérive de l'accent (boutons, anneaux, dégradés, états actifs).
- **Rayons** : cartes 22 px, champs/boutons 14 px, pastilles 99 px. **Police** : pile système (`ui-sans-serif, system-ui, …`), titres `800` avec `letter-spacing:-.02em`, libellés de carte en capitales 13 px espacées.
- **Fond** : 3 grandes taches en `radial-gradient` (accent, violet, bleu) qui dérivent lentement — **sans `filter: blur`** (trop coûteux, cause de saccades).
- **Carte héro** : dégradé `accent → accent mélangé à #04201e` (`color-mix`), texte blanc, grand chiffre + petit anneau de progression.

## 3. Composants à reprendre (tous en HTML/CSS simples, portables en composants React)
- **Card** (verre : `backdrop-filter: blur(16px) saturate(1.3)`, bordure fine, ombre douce) ; variante **hero**.
- **Grille 12 colonnes** (`.c3 .c4 .c5 .c6 .c7 .c8 .c12`) avec `min-width:0` sur tous les enfants (indispensable, voir §7).
- **Segmented control** (`.seg`) : boutons à largeur de contenu, `white-space:nowrap`, défilement interne si trop large.
- **Chips** (filtres, états), **Chip statut** (vert/rouge), **Toggle** (`.sw`), **Stepper**, **Barre de progression**, **Anneau (ring)** SVG animé.
- **Graphiques SVG maison** : courbe lissée (Catmull-Rom) avec **morphing animé** quand les données changent, barres animées, info-bulle au survol. Aucune librairie.
- **Listes `.item`**, **tableaux** (défilement interne ; sur téléphone, convertir en **cartes**).
- **Modale** + **palette de commandes ⌘K / Ctrl+K** (navigation + actions rapides).
- **Toasts**, **états vides** soignés, **formulaires** (libellés au-dessus, focus avec halo accent).
- **PDF** générés côté navigateur (jsPDF) : même identité (accent, pastilles).

## 4. Mise en page / responsive (à reproduire à l'identique)
| Largeur | Navigation | Grille |
|---|---|---|
| > 900 px (PC) | barre latérale 248 px (logo, onglets, recherche ⌘K, état de synchro) | 12 colonnes |
| 600–900 px (**tablette / Galaxy Z Fold déplié ≈ 707×823**) | **rail d'icônes** 72 px | 2 colonnes (`c3/c4/c6` = 6, le reste 12) |
| < 600 px (téléphone, Fold replié ≈ 360 px) | **barre flottante en bas**, défilante, l'onglet actif est recentré | 1 colonne (KPI en 2 colonnes) |
| ≤ 480 px | formulaires empilés (`.f2` en 1 colonne), segments compacts | — |

Règles : `safe-area` (encoche/barre de gestes), pas de défilement horizontal de page, `prefers-reduced-motion` respecté, cibles tactiles ≥ 40 px.

## 5. Animations (peu mais fluides)
- Entrée des cartes : **opacité + translation uniquement** (0,5 s, léger décalage entre cartes), jouée **seulement au changement de page**, jamais à chaque sauvegarde (classe `.still`).
- Anneaux : transition du `stroke-dashoffset`. Courbes : interpolation 800 ms.
- ❌ À éviter : `filter: blur` animé, gros `backdrop-filter` sur de nombreuses cartes mobiles (réduit à 10 px < 900 px).

## 6. Architecture technique (ce qui rend l'app agréable)
- **PWA** : `manifest.webmanifest`, service worker (réseau d'abord, cache en secours), icônes + maskable, installable PC/Android/iOS.
- **Offline-first + synchro temps réel** : écriture locale immédiate (localStorage), file d'envoi, fusion **champ par champ « le plus récent gagne »**, abonnement temps réel + rattrapage périodique (20 s), indicateur d'état explicite (Synchronisé / Synchronisation… / Erreur : cause).
- **Supabase** : Auth email/mot de passe, table générique `fields(uid, doc, field, v jsonb, t, seq)` + RLS `uid = auth.uid()`, fonction `push_fields` (upsert conditionnel), `grant` explicites pour les rôles `authenticated` et `service_role` (piège rencontré : « permission denied »).
- **Vercel** : site statique + fonctions serveur (`api/*.js`) : IA (calories/macros, bilans) avec **secours Claude → Gemini** (`api/_ai.js`), notifications push (`api/cron.js` appelé chaque minute par `pg_cron`), toutes protégées (jeton Supabase vérifié ; cron par secret).
- **Rôle propriétaire** : `app_metadata.owner` + politique RLS dédiée pour un module réservé (facturation).
- **Notifications push (Web Push)** : clés VAPID dérivées d'un secret serveur, logique de rappels **pure et testée** (`api/_remind.js`), anti-doublon, fuseau de l'utilisateur, pas de rappel si l'action est déjà faite.
- **Rapports** : indicateurs verts/rouges avec conseil automatique (règles gratuites) + résumé IA optionnel, export PDF.
- **Pas de dépendance front** : JS vanilla. Pour Timetis (Next.js/React) : garder la même logique de données/sync, remplacer le rendu par des composants.

## 7. Pièges déjà rencontrés (à ne pas refaire)
1. **Débordement horizontal** : sans `min-width:0` sur `main`, enfants de grille et cartes, un tableau large élargit toute la page. Tables = `display:block; overflow-x:auto` ou cartes sur mobile.
2. **Listes déroulantes blanc sur blanc** sous Windows/Chrome : définir `color-scheme` selon le thème et colorer `select option`.
3. **PDF** : les espaces insécables fines (U+202F) produits par `toLocaleString('fr-FR')` s'affichent mal → remplacer par un espace normal ; formater SIREN/téléphone/IBAN avec espaces ; conserver retours à la ligne et lignes vides des textes libres.
4. **Claviers mobiles** : `inputmode="numeric"` retire la touche espace → ne pas l'imposer aux champs formatés.
5. **Re-rendu complet** : désactiver les animations d'entrée après la 1re page, ne pas re-rendre pendant la saisie dans un champ (reporter le rendu).
6. **Segments** : `flex:1 1 auto` + `nowrap`, sinon libellés coupés.
7. **Droits SQL** et **RLS** : toujours accorder explicitement (`grant`) et tester avec un vrai compte.
8. **Fuseaux/dates** : manipuler des dates `YYYY-MM-DD` locales, pas des `Date` UTC.

## 8. Principes UX à conserver
Saisie en **1 à 2 gestes** (boutons rapides, valeurs par défaut intelligentes) ; **verdicts lisibles** (vert = réussi, rouge = à rattraper + conseil concret) ; **jamais de rouge sans données** (état « pour information ») ; formulaires qui calculent à la volée ; mentions « estimation / pas un avis médical ou financier » quand pertinent ; données personnelles **jamais dans le code** (uniquement en base).

## 9. Plan de refonte suggéré pour la session Timetis
1. **Audit de l'existant** : pages, composants, données, routes, dépendances UI actuelles ; lister ce qui est à conserver (logique métier) vs refondre (présentation).
2. **Design system** : créer les tokens (§2) en variables CSS / thème, puis les composants du §3 (Card, Segmented, Chip, Ring, Chart, Modal, Palette, Toast, Table→Cards).
3. **Layout responsive** (§4) : sidebar / rail / barre du bas, grille 12 colonnes, safe-areas.
4. **Structure & données** : décider si l'on reprend le modèle offline-first + Supabase (recommandé si usage mobile/multi-appareils) ou on garde l'API actuelle ; PWA + service worker.
5. **Pages une par une**, en validant visuellement à **360 px, 707×823, 1280 px** (clair et sombre).
6. **Qualité** : zéro débordement horizontal (test automatisé sur chaque page), accessibilité (contrastes, focus, libellés), perf (pas de blur animé).
7. **Questions à poser à l'utilisateur** : quelles pages/fonctions de Timetis sont prioritaires ? identité de marque à garder (nom, logo, couleurs) ? comptes multi-utilisateurs ou personnel ? besoin d'IA, de notifications, de PDF ?

## 10. Fichiers de référence dans `life-dashboard/`
- `public/style.css` — tokens, composants, responsive, animations
- `public/app.js` — vues, synchro, graphiques SVG, rapports, rappels, palette
- `public/billing.js` — module réservé + PDF (jsPDF)
- `public/sw.js`, `public/manifest.webmanifest` — PWA
- `api/_ai.js`, `api/_remind.js`, `api/cron.js` — IA avec secours, rappels testés, cron
- `supabase/*.sql` — schéma, RLS, droits, push, facturation
- `ROADMAP.md` — idée produit (app téléchargeable, plan gratuit/payant)
