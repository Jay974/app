# Ma Vie — dashboard personnel (PWA)

Suivi de ta vie : **poids** (courbe animée), **sport**, **repas/calories**, **eau, sommeil, humeur**, **jours de travail** (calendrier), **remboursement de crédit**, notes.
Installable sur PC et téléphone, **synchronisé en temps réel** (ce que tu saisis sur le téléphone apparaît sur le PC, et inversement), et **utilisable hors-ligne** (resynchronisation automatique au retour du réseau).

Zéro dépendance : Node ≥ 18 uniquement.

## Lancer en local
```bash
cd life-dashboard
npm start            # http://localhost:3000
npm test             # test d'intégration de l'API de synchro
```
Au premier lancement, tu choisis ton mot de passe (stocké haché avec scrypt).

## Mettre en ligne (nécessaire pour synchroniser PC ↔ téléphone)
Le téléphone doit joindre le serveur **en HTTPS** (obligatoire pour installer une PWA).
- **Render / Railway / Fly.io** : déploie ce dossier (un `Dockerfile` est fourni), ajoute un **disque persistant** monté sur `/data` et la variable `DATA_DIR=/data`.
- **VPS** : `node server.js` derrière Caddy/Nginx (HTTPS), `DATA_DIR` vers un dossier sauvegardé.
- Chez toi : Tailscale / Cloudflare Tunnel.

Puis ouvre l'URL sur le téléphone → *Ajouter à l'écran d'accueil* (iOS Safari : Partager → Sur l'écran d'accueil ; Android Chrome : Installer). Sur PC : icône « Installer » dans la barre d'adresse Chrome/Edge.

## Comment marche la synchro
- Chaque donnée est un document (`day:2026-11-24`, `credit`, `pay:<id>`, `cfg`) fait de champs `{valeur, horodatage}`.
- Le serveur fusionne **champ par champ, le plus récent gagne** → pas de conflit si tu modifies deux choses en même temps sur deux appareils.
- Les modifs sont d'abord écrites sur l'appareil (localStorage), envoyées dès que possible ; un flux SSE (`/api/events`) prévient les autres appareils instantanément.
- Sauvegarde : `DATA_DIR/data.json` (+ bouton *Exporter* dans Réglages).

## Raccourcis
`⌘K` / `Ctrl+K` : palette de commandes (aller à un onglet, « sport fait », « +1 verre », nouveau remboursement…).

## Structure
```
server.js           API + SSE + fichiers statiques
public/             PWA (index.html, app.js, style.css, sw.js, manifest)
scripts/gen-icons.js  régénère les icônes · scripts/test.js  tests API
```
