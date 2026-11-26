# Feuille de route / idées

## 💡 Idée produit : « Ma Vie » en application téléchargeable (plan gratuit + payant)
_Note du 26/11/2026 — idée à explorer, rien n'est engagé._

Ce type de dashboard personnel (suivi poids / sport / repas / macros / eau / sommeil, budget, crédit, rapports hebdo avec conseils, rappels push, coach IA) peut être optimisé puis proposé comme **application téléchargeable** avec un **plan gratuit et un plan payant**.

### Pistes de découpage (à valider)
- **Gratuit** : suivi de base (poids, sport, repas, eau, sommeil, humeur), objectif, rapports hebdo simples, rappels de base, sync multi-appareils.
- **Payant** : IA (estimation calories/macros, bilans, conseils nutrition/budget), rapports journaliers + PDF, budget complet et crédit, rappels avancés, export, éventuellement module facturation (devis/factures PDF).

### Ce qui existe déjà et aide
- PWA installable (PC, téléphone, pliable), hors-ligne + synchronisation temps réel.
- Données isolées par compte (Supabase Auth + RLS) : prêt pour le multi-utilisateurs.
- IA avec secours (Claude puis Gemini) ; fonctions serveur sur Vercel.

### Chantiers pour en faire un produit
1. **Comptes & onboarding** : inscription ouverte (aujourd'hui désactivée), confirmation email, mot de passe oublié, questionnaire de démarrage (objectif, profil).
2. **Abonnements** : paiement (Stripe ou stores), plans, essai gratuit, gestion des quotas.
3. **Coût IA** : limites par plan (nombre d'estimations/bilans), mise en cache, modèle économique (marge vs coût des appels).
4. **Distribution** : PWA (Play Store via TWA, App Store via Capacitor) ou app native ; icônes, captures, fiches de store.
5. **Légal & confiance** : RGPD (données de santé = sensibles), CGU/CGV, politique de confidentialité, suppression/export des données, mentions « pas un avis médical / financier ».
6. **Qualité** : tests automatisés, suivi d'erreurs, monitoring, sauvegardes, accessibilité, traductions (FR/EN…).
7. **Produit** : tableau de bord d'analytics (rétention), parcours « première semaine », partage de rapports.

### Questions ouvertes
- Cible : grand public fitness/budget, ou niche (indépendants, étudiants…) ?
- Positionnement face aux apps existantes (suivi nutrition, budget) : quel différenciateur ? (tout-en-un + coach IA + rapports de lundi)
- Prix et modèle : abonnement mensuel/annuel, paiement unique, freemium avec IA payante ?
