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

## Configuration

En tête du `<script>` de `index.html` :
- `WA_NUM` : numéro WhatsApp du restaurant
- `STAFF_PIN` : code d'accès équipe
- `SVC` : services et heure par défaut
- `ZONES` : plan de salle (tables, capacités, `maxCap`, salons)

## Limites actuelles

- La synchronisation entre appareils, le scanner photo et le remplissage rapide reposent sur le runtime des artefacts claude.ai (`window.claude`). Ouvert ailleurs, les données restent sur l'appareil (localStorage) et ces deux fonctions IA sont désactivées.
- Les demandes clientes partent par WhatsApp uniquement : elles n'apparaissent pas automatiquement dans l'espace équipe.
- Le code PIN est visible dans le code source de la page : il ne protège pas réellement les données.
