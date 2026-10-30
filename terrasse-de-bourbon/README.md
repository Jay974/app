# La Terrasse de Bourbon — Réservations

Plateforme de réservation autonome (un seul fichier `index.html`, sans dépendance à installer).

## Fonctionnement

**Côté client (« Réserver »)**
- Formulaire : nom, téléphone, date, horaire (Midi / Happy Hour / Soir), nombre de personnes, zone (Intérieur, Terrasse, Rooftop), notes.
- À l'envoi, un message pré-rempli s'ouvre dans WhatsApp vers le restaurant ; le client voit un écran « En attente de confirmation ».

**Côté équipe (« Équipe », code PIN)**
- Vue par date et par service (midi, happy hour, soir) avec compteurs : réservations, couverts, tables et places libres.
- **Plan** : tables par zone (libre / réservée / cochée à la main). Toucher une table libre la coche ; toucher une table réservée ouvre la réservation.
- **Réservations** : liste du service, attribution / changement de table, message WhatsApp, suppression.
- **Ajouter** : saisie manuelle, proposition automatique de table (zone respectée, capacité adaptée, salons gardés pour les groupes), remplissage rapide par dictée.
- **Scanner** : photo du cahier ou de l'addition → tables déjà prises cochées, réservations sans table placées automatiquement, vérification avant application.

## Parcours d'une demande

1. Le client remplit la page et envoie le message WhatsApp déjà rédigé.
2. L'équipe copie ce message dans **Ajouter → Importer une demande WhatsApp** : le formulaire se remplit et une table est proposée.
3. Après l'enregistrement, **Confirmer au client sur WhatsApp** ouvre la conversation avec le client et un message de confirmation.

Dans claude.ai, si la personne qui réserve a accès à la base, la demande arrive directement avec le statut « À confirmer ».

## Configuration

En tête du `<script>` de `index.html` :
- `WA_NUM` : numéro WhatsApp du restaurant
- `PIN_HASH` : empreinte du code équipe (la commande pour la régénérer est en commentaire)
- `SVC` : services et heure par défaut
- `ZONES` : plan de salle (tables, capacités, `maxCap`, salons)

## Accès et données

- Dans claude.ai, la base partagée n'est lisible et modifiable que par les personnes à qui la page est partagée en **contributeur** ou plus. Ces personnes entrent dans l'espace équipe sans code.
- Hors de claude.ai, le code PIN n'est que dissuasif et les données restent sur chaque appareil (localStorage). Le scanner et le remplissage rapide n'y fonctionnent pas.
- Un client qui n'a pas accès à la base passe obligatoirement par WhatsApp.
